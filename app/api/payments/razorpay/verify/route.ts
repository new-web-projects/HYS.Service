import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi } from "@/lib/auth-guard";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { prisma } from "@/lib/prisma";
import { verifyRazorpaySignature } from "@/lib/payment-gateways/razorpay";
import { markBookingPaid } from "@/lib/payment-gateways/mark-paid";

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification payload." }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const valid = await verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }

  const txn = await prisma.transaction.findFirst({
    where: { gateway: "RAZORPAY", gatewayOrderId: razorpay_order_id },
    include: { booking: true },
  });
  if (!txn || txn.booking.customerId !== user.id) {
    return NextResponse.json({ error: "No matching transaction found." }, { status: 404 });
  }

  const result = await markBookingPaid(txn.bookingId, "RAZORPAY", razorpay_payment_id, {
    razorpay_order_id,
    razorpay_payment_id,
  });

  return NextResponse.json({ status: "PAID", otp: result.otp, alreadyProcessed: result.alreadyProcessed });
}