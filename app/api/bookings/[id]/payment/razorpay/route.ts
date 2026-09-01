import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { validatePaymentRequest, totalAmountFor } from "@/lib/payment-gateways/validate-request";
import { createRazorpayOrder } from "@/lib/payment-gateways/razorpay";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const limit = await rateLimit(`payment:create:${user.id}`, 10, 60 * 10);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many payment attempts. Try again shortly." }, { status: 429 });
  }

  const { id } = await params;
  const { booking, error } = await validatePaymentRequest(id, user.id, "razorpay");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const totalAmount = totalAmountFor(booking);
  const { orderId, keyId, amountPaise } = await createRazorpayOrder(totalAmount, booking.id, {
    bookingId: booking.id,
  });

  // Recorded before the client ever sees a live order — if the customer
  // abandons checkout, there's still a durable CREATED row showing a
  // payment was attempted, not just silence.
  await prisma.transaction.create({
    data: {
      bookingId: booking.id,
      gateway: "RAZORPAY",
      gatewayOrderId: orderId,
      amount: totalAmount,
      status: "CREATED",
    },
  });

  return NextResponse.json({ orderId, keyId, amountPaise, currency: "INR" });
}