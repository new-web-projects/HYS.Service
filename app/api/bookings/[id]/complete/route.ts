import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { completeBookingSchema } from "@/lib/chat-validators";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";

const MAX_OTP_ATTEMPTS = 5;
const OTP_WINDOW_SECONDS = 15 * 60;

/**
 * Worker submits the OTP the customer received at payment time
 * (mark-paid.ts, Part 8). This closes a gap the Part 9 dependency check
 * found: Parts 1-8 issue and hash the completion OTP but never built a
 * route to verify it, so no booking could ever reach COMPLETED and no
 * Earning could ever leave HELD — Part 9 would have had nothing to
 * operate on without this. Fixed here per that check's own "missing but
 * required by an earlier Part" case, not pulled forward from a later Part
 * — job completion was always implicitly Part 7/8's territory (see the
 * schema's own comment on Booking.completionOtpHash).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const { id } = await params;

  // Rate-limited per booking, not per worker/IP — a 6-digit OTP is only
  // 1,000,000 combinations, so this must be tight regardless of who's
  // asking or from where. 5 tries per 15 minutes mirrors the login
  // brute-force lock in lib/rate-limit.ts.
  const { allowed } = await rateLimit(`otp:${id}`, MAX_OTP_ATTEMPTS, OTP_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many incorrect attempts. Wait 15 minutes and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = completeBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { worker: { select: { name: true } } },
  });
  if (!booking || booking.workerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status === "COMPLETED") {
    return NextResponse.json({ booking }); // idempotent — already done, not an error
  }
  if (booking.status !== "PAID" || !booking.completionOtpHash) {
    return NextResponse.json({ error: "This booking isn't awaiting OTP completion." }, { status: 409 });
  }

  const valid = await bcrypt.compare(parsed.data.otp, booking.completionOtpHash);
  if (!valid) {
    await prisma.booking.update({ where: { id }, data: { otpAttempts: { increment: 1 } } });
    return NextResponse.json({ error: "Incorrect OTP." }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date(), otpVerifiedAt: new Date() },
    }),
    prisma.earning.update({
      where: { bookingId: id },
      data: { status: "AVAILABLE", availableAt: new Date() },
    }),
    prisma.workerProfile.update({
      where: { userId: user.id },
      data: { ordersCompleted: { increment: 1 } },
    }),
  ]);

  await notify({
    userId: booking.customerId,
    type: "job_completed",
    title: "Job marked complete",
    body: `${booking.worker?.name ?? "The worker"} confirmed this job is done. Let others know how it went — leave a review.`,
    data: { bookingId: id },
  });

  const convo = await prisma.conversation.findUnique({ where: { bookingId: id }, select: { id: true } });
  if (convo) {
    getIO()?.to(`conversation:${convo.id}`).emit("booking-updated", { bookingId: id, status: "COMPLETED" });
  }

  return NextResponse.json({ booking: updated });
}