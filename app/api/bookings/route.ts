import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { createBookingSchema } from "@/lib/chat-validators";
import { computeBookingBasePrice } from "@/lib/pricing";
import { notify } from "@/lib/notifications";

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const limit = await rateLimit(`booking:create:${user.id}`, 10, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many booking requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { workerId, description, address, scheduledAt, notes, latitude, longitude } = parsed.data;

  const worker = await prisma.workerProfile.findUnique({
    where: { userId: workerId },
    select: {
      userId: true,
      startingPrice: true,
      latitude: true,
      longitude: true,
      user: { select: { role: true, name: true, email: true } },
    },
  });
  if (!worker || worker.user.role !== "WORKER") {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }
  if (worker.userId === user.id) {
    return NextResponse.json({ error: "You can't book yourself." }, { status: 400 });
  }

  // Block duplicate/spam requests to the same worker while one is already
  // in flight, rather than letting a customer queue several at once.
  const existingActive = await prisma.booking.findFirst({
    where: {
      customerId: user.id,
      workerId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    select: { id: true },
  });
  if (existingActive) {
    return NextResponse.json(
      { error: "You already have an active booking with this worker.", bookingId: existingActive.id },
      { status: 409 },
    );
  }

  // Location for the travel-surcharge reference price: prefer coordinates
  // sent with this request, fall back to the customer's saved profile
  // location so they don't have to re-share it every time they book.
  let customerLocation: { latitude: number; longitude: number } | null =
    latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;
  if (!customerLocation) {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { latitude: true, longitude: true },
    });
    if (profile?.latitude !== null && profile?.longitude !== null && profile) {
      customerLocation = { latitude: Number(profile.latitude), longitude: Number(profile.longitude) };
    }
  }

  const { basePrice } = computeBookingBasePrice(
    {
      startingPrice: Number(worker.startingPrice),
      latitude: worker.latitude !== null ? Number(worker.latitude) : null,
      longitude: worker.longitude !== null ? Number(worker.longitude) : null,
    },
    customerLocation,
  );

  const { booking } = await prisma.$transaction(async (tx: TransactionClient) => {
    const booking = await tx.booking.create({
      data: {
        origin: "DIRECT",
        customerId: user.id,
        workerId,
        status: "PENDING_RESPONSE",
        description,
        address,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        basePrice,
      },
    });
    // Conversation exists from the start (schema design — see
    // schema.prisma's booking/chat comment block) but stays unusable
    // until the worker accepts: every message-send checks
    // booking.status !== 'PENDING_RESPONSE' rather than a separate flag,
    // so there's one source of truth for whether chat is open.
    const conversation = await tx.conversation.create({
      data: {
        customerId: user.id,
        workerId,
        bookingId: booking.id,
        status: "OPEN",
      },
    });
    return { booking, conversation };
  });

  await notify({
    userId: workerId,
    type: "booking_request",
    title: "New booking request",
    body: `${user.name} wants to book you for: ${description.slice(0, 100)}`,
    data: { bookingId: booking.id },
    email: {
      to: worker.user.email,
      subject: "New booking request — HYS Services",
      text: `${user.name} wants to book you.\n\n${description}\n\nRespond from your worker dashboard.`,
    },
  });

  return NextResponse.json({ booking }, { status: 201 });
}