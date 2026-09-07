import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";
import type { PaymentGateway } from "@/lib/generated/prisma/client";
import { Prisma } from "@/lib/generated/prisma/client";

function generateOtp(): string {
  // crypto.randomInt, not Math.random() — this OTP is the sole gate
  // before a worker's earnings become withdrawable (Part 9 builds the
  // verification side), so it needs a real random source. Hashed with
  // bcrypt below, never stored plaintext — V1 stored this in plaintext;
  // this is a deliberate, confirmed improvement, not an oversight.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

type MarkPaidResult = { alreadyProcessed: boolean; otp?: string };

/**
 * Called by every gateway's verification path (direct client callback
 * AND webhook alike) once a payment is confirmed successful. Must be
 * idempotent: webhooks retry on their own schedule, and a client-side
 * verify call can race a webhook for the same payment — only the first
 * call that finds the booking still READY_FOR_PAYMENT does anything;
 * every call after that is a safe, cheap no-op.
 */
export async function markBookingPaid(
  bookingId: string,
  gateway: PaymentGateway,
  gatewayPaymentId: string,
  rawResponse: Record<string, unknown>,
): Promise<MarkPaidResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, worker: true },
  });
  if (!booking) throw new Error(`markBookingPaid: booking ${bookingId} not found`);

  if (booking.status === "PAID" || booking.status === "COMPLETED") {
    return { alreadyProcessed: true };
  }
  if (booking.status !== "READY_FOR_PAYMENT") {
    throw new Error(`markBookingPaid: booking ${bookingId} is ${booking.status}, not READY_FOR_PAYMENT`);
  }
  if (!booking.workerId || !booking.finalPrice) {
    throw new Error(`markBookingPaid: booking ${bookingId} is missing workerId/finalPrice`);
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const totalAmount =
    Number(booking.finalPrice) + Number(booking.platformFee ?? 0) + Number(booking.gstAmount ?? 0);

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "PAID", paidAt: new Date(), completionOtpHash: otpHash, otpAttempts: 0 },
    }),
    prisma.transaction.updateMany({
      where: { bookingId, gateway, status: "CREATED" },
      data: { status: "SUCCESS", gatewayPaymentId, rawResponse: rawResponse as Prisma.InputJsonValue },
    }),
    // Worker earns the agreed price, not the customer's total — platform
    // fee + GST is platform revenue, never part of the worker's earning.
    prisma.earning.create({
      data: { bookingId, workerId: booking.workerId, amount: booking.finalPrice, status: "HELD" },
    }),
  ]);

  await notify({
    userId: booking.customerId,
    type: "payment_success",
    title: "Payment successful",
    body: `Payment of ₹${totalAmount.toFixed(2)} received. Share the OTP with ${booking.worker?.name ?? "the worker"} only once the job is fully done.`,
    data: { bookingId, otp },
    email: {
      to: booking.customer.email,
      subject: "Payment confirmed — HYS Services",
      text: `Payment of ₹${totalAmount.toFixed(2)} confirmed.\n\nYour job-completion OTP: ${otp}\n\nShare this with the worker ONLY once the job is fully done — it's what releases their payment.`,
    },
  });
  await notify({
    userId: booking.workerId,
    type: "payment_received",
    title: "Payment received",
    body: `${booking.customer.name} completed payment — you can now see their contact details.`,
    data: { bookingId },
  });

  const convo = await prisma.conversation.findUnique({ where: { bookingId }, select: { id: true } });
  if (convo) {
    getIO()?.to(`conversation:${convo.id}`).emit("booking-updated", { bookingId, status: "PAID" });
  }

  return { alreadyProcessed: false, otp };
}