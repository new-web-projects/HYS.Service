import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { cancelBookingSchema } from "@/lib/chat-validators";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";

async function loadBookingForParticipant(id: string, userId: string, role: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      worker: { select: { id: true, name: true, email: true, phone: true } },
      conversation: { select: { id: true } },
    },
  });
  if (!booking) return { booking: null, forbidden: false };
  const isParticipant = booking.customerId === userId || booking.workerId === userId;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  if (!isParticipant && !isAdmin) return { booking: null, forbidden: true };

  // Contact details only reveal once payment is complete — matches the
  // master prompt's booking flow exactly ("After successful payment: …
  // Contact information is revealed"). Not implemented yet (Part 8 is
  // when PAID actually becomes reachable) but the gate is correct now so
  // nothing needs to change here once it is.
  const revealContact = ["PAID", "COMPLETED"].includes(booking.status);
  return {
    booking: {
      ...booking,
      customer: revealContact ? booking.customer : { ...booking.customer, phone: null },
      worker: revealContact ? booking.worker : { ...booking.worker, phone: null },
    },
    forbidden: false,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const { booking, forbidden } = await loadBookingForParticipant(id, user.id, user.role);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ booking });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cancelBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.workerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (["PAID", "COMPLETED", "CANCELLED"].includes(booking.status)) {
    return NextResponse.json(
      { error: "This booking can no longer be cancelled." },
      { status: 409 },
    );
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: parsed.data.reason },
  });

  const otherPartyId = user.id === booking.customerId ? booking.workerId : booking.customerId;
  if (otherPartyId) {
    await notify({
      userId: otherPartyId,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: parsed.data.reason ? `Cancelled: ${parsed.data.reason}` : "The other party cancelled this booking.",
      data: { bookingId: id },
    });
  }

  const io = getIO();
  const convo = await prisma.conversation.findUnique({ where: { bookingId: id }, select: { id: true } });
  if (convo) io?.to(`conversation:${convo.id}`).emit("booking-updated", { bookingId: id, status: "CANCELLED" });

  return NextResponse.json({ booking: updated });
}