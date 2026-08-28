import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { sendMessageSchema } from "@/lib/chat-validators";
import { getSettings } from "@/lib/settings";
import { computePriceBreakdown } from "@/lib/pricing";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";

async function loadConversationForParticipant(id: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { booking: true },
  });
  if (!conversation) return null;
  if (conversation.customerId !== userId && conversation.workerId !== userId) return null;
  return conversation;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const conversation = await loadConversationForParticipant(id, user.id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const before = url.searchParams.get("before");

  const messages = await prisma.message.findMany({
    where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const limit = await rateLimit(`message:send:${user.id}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Sending too fast — slow down a little." }, { status: 429 });
  }

  const { id } = await params;
  const conversation = await loadConversationForParticipant(id, user.id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { type, content, priceAmount } = parsed.data;
  const isCustomer = user.id === conversation.customerId;
  const isWorker = user.id === conversation.workerId;

  // Direct-booking gate: chat is unusable until the worker accepts.
  // Job-post threads (no booking yet, or booking already past this point)
  // are never blocked here — schema-documented "no gating, by design" for
  // pre-selection job-post chat.
  if (conversation.booking && conversation.booking.status === "PENDING_RESPONSE") {
    return NextResponse.json(
      { error: "This booking hasn't been accepted yet — chat isn't open." },
      { status: 403 },
    );
  }
  if (conversation.status === "CLOSED") {
    return NextResponse.json({ error: "This conversation is closed." }, { status: 403 });
  }

  let updatedBooking: { id: string; status: string } | null = null;

  if (type === "PRICE_PROPOSAL") {
    if (!isWorker) {
      return NextResponse.json({ error: "Only the worker can propose a price." }, { status: 403 });
    }
    if (priceAmount === undefined) {
      return NextResponse.json({ error: "priceAmount is required for a price proposal." }, { status: 400 });
    }
    await prisma.conversation.update({
      where: { id },
      data: { status: "PRICE_PROPOSED", proposedPrice: priceAmount, customerConfirmed: false, workerConfirmed: false },
    });
  } else if (type === "PRICE_ACCEPTED") {
    if (!isCustomer) {
      return NextResponse.json({ error: "Only the customer can accept a price." }, { status: 403 });
    }
    if (conversation.status !== "PRICE_PROPOSED") {
      return NextResponse.json({ error: "There's no active price proposal to accept." }, { status: 409 });
    }
    if (!conversation.booking) {
      return NextResponse.json(
        { error: "Select this worker for the job before confirming a price." },
        { status: 409 },
      );
    }
    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { customerConfirmed: true } }),
      prisma.booking.update({ where: { id: conversation.booking.id }, data: { status: "PRICE_PENDING" } }),
    ]);
    updatedBooking = { id: conversation.booking.id, status: "PRICE_PENDING" };
  } else if (type === "PRICE_CONFIRMED") {
    if (!isWorker) {
      return NextResponse.json({ error: "Only the worker can give the final confirmation." }, { status: 403 });
    }
    if (!conversation.customerConfirmed || conversation.proposedPrice === null) {
      return NextResponse.json(
        { error: "The customer needs to accept the proposed price first." },
        { status: 409 },
      );
    }
    if (!conversation.booking) {
      return NextResponse.json(
        { error: "Select this worker for the job before confirming a price." },
        { status: 409 },
      );
    }
    const settings = await getSettings();
    const breakdown = computePriceBreakdown(Number(conversation.proposedPrice), settings);
    await prisma.$transaction([
      prisma.conversation.update({ where: { id }, data: { workerConfirmed: true, status: "PRICE_CONFIRMED" } }),
      prisma.booking.update({
        where: { id: conversation.booking.id },
        data: {
          status: "READY_FOR_PAYMENT",
          finalPrice: breakdown.agreedPrice,
          platformFee: breakdown.platformFee,
          gstAmount: breakdown.gstAmount,
        },
      }),
    ]);
    updatedBooking = { id: conversation.booking.id, status: "READY_FOR_PAYMENT" };
  } else {
    // Plain TEXT — still touch the conversation row so "my chats" ordering
    // (sorted by Conversation.updatedAt) reflects real activity, not just
    // price events.
    await prisma.conversation.update({ where: { id }, data: { status: conversation.status } });
  }

  const message = await prisma.message.create({
    data: { conversationId: id, senderId: user.id, type, content, priceAmount },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  const io = getIO();
  io?.to(`conversation:${id}`).emit("new-message", message);
  if (updatedBooking) {
    io?.to(`conversation:${id}`).emit("booking-updated", updatedBooking);
  }

  const otherPartyId = isCustomer ? conversation.workerId : conversation.customerId;
  if (type !== "TEXT") {
    // Price events are worth a persisted notification; every individual
    // chat message is not (that would be noisy, not useful).
    await notify({
      userId: otherPartyId,
      type: `chat_${type.toLowerCase()}`,
      title: type === "PRICE_PROPOSAL" ? "New price proposed" : type === "PRICE_ACCEPTED" ? "Price accepted" : "Price confirmed",
      body: content,
      data: { conversationId: id },
    });
  }

  return NextResponse.json({ message, booking: updatedBooking }, { status: 201 });
}