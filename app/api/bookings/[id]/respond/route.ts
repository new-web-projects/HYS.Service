import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { respondToBookingSchema } from "@/lib/chat-validators";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = respondToBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { action, reason } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, email: true } } },
  });
  if (!booking || booking.workerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "PENDING_RESPONSE") {
    return NextResponse.json({ error: "This request has already been responded to." }, { status: 409 });
  }

  if (action === "accept") {
    // Confirmed business rule: a worker can't take on a new paid job while
    // another is still awaiting OTP completion (status PAID = payment
    // received, job not yet OTP-verified). Doesn't block accepting a
    // *different* PENDING_RESPONSE/DISCUSSING one — only PAID specifically.
    const blockingJob = await prisma.booking.findFirst({
      where: { workerId: user.id, status: "PAID" },
      select: { id: true },
    });
    if (blockingJob) {
      return NextResponse.json(
        {
          error:
            "You have a paid job awaiting completion (OTP from the customer) — finish that before accepting a new one.",
        },
        { status: 409 },
      );
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "DISCUSSING" },
    });

    await notify({
      userId: booking.customerId,
      type: "booking_accepted",
      title: "Booking accepted",
      body: `${user.name} accepted your booking request. You can now chat to agree on a final price.`,
      data: { bookingId: id },
      email: {
        to: booking.customer.email,
        subject: "Your booking was accepted — HYS Services",
        text: `${user.name} accepted your booking request. Open the chat to agree on a final price.`,
      },
    });

    const convo = await prisma.conversation.findUnique({ where: { bookingId: id }, select: { id: true } });
    if (convo) {
      getIO()?.to(`conversation:${convo.id}`).emit("booking-updated", { bookingId: id, status: "DISCUSSING" });
    }

    return NextResponse.json({ booking: updated });
  }

  // action === "reject"
  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason ?? "Declined by worker" },
    }),
    prisma.conversation.updateMany({ where: { bookingId: id }, data: { status: "CLOSED" } }),
  ]);

  await notify({
    userId: booking.customerId,
    type: "booking_rejected",
    title: "Booking declined",
    body: reason ? `${user.name} declined: ${reason}` : `${user.name} declined this booking request.`,
    data: { bookingId: id },
  });

  return NextResponse.json({ booking: updated });
}