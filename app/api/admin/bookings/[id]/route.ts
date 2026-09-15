import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      worker: { select: { id: true, name: true, email: true, phone: true } },
      jobPost: { select: { id: true, title: true } },
      review: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ booking });
}

const CANCELLABLE_STATUSES = ["PENDING_RESPONSE", "DISCUSSING", "PRICE_PENDING", "READY_FOR_PAYMENT"];

const cancelSchema = z.object({ reason: z.string().min(3).max(500) });

/**
 * Deliberately limited to pre-payment statuses. Force-cancelling a PAID
 * or COMPLETED booking has real refund implications this Part doesn't
 * solve (the Part 1 audit flagged V1 as having no refund process either
 * — still MANUAL VERIFICATION REQUIRED, not something to invent here).
 * This does close the operational half of V1's Bug B8, though: a
 * booking stuck before payment (e.g. an unresponsive worker) is no
 * longer a dead end with no admin action available.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!CANCELLABLE_STATUSES.includes(booking.status)) {
    return NextResponse.json(
      { error: "Only bookings that haven't been paid yet can be cancelled from here." },
      { status: 409 },
    );
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: `Admin: ${parsed.data.reason}` },
  });

  for (const recipientId of [booking.customerId, booking.workerId].filter((x): x is string => Boolean(x))) {
    await notify({
      userId: recipientId,
      type: "booking_cancelled",
      title: "Booking cancelled",
      body: `An admin cancelled this booking: ${parsed.data.reason}`,
      data: { bookingId: id },
    });
  }

  const convo = await prisma.conversation.findUnique({ where: { bookingId: id }, select: { id: true } });
  if (convo) {
    getIO()?.to(`conversation:${convo.id}`).emit("booking-updated", { bookingId: id, status: "CANCELLED" });
  }

  await logAdminAction({
    actorId: user.id,
    action: "booking.admin_cancel",
    entity: "Booking",
    entityId: id,
    metadata: { reason: parsed.data.reason, previousStatus: booking.status },
  });

  return NextResponse.json({ booking: updated });
}