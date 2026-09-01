import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { env } from "@/lib/env";
import { validatePaymentRequest, totalAmountFor } from "@/lib/payment-gateways/validate-request";
import { createPhonePePayment } from "@/lib/payment-gateways/phonepe";

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
  const { booking, error } = await validatePaymentRequest(id, user.id, "phonepe");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const totalAmount = totalAmountFor(booking);
  // merchantOrderId must be unique per attempt — PhonePe doesn't accept
  // retrying the same id after a terminal state, so this includes a
  // timestamp rather than reusing booking.id bare.
  const merchantOrderId = `${booking.id}-${Date.now()}`;
  const redirectUrl = `${env.NEXT_PUBLIC_APP_URL}/customer-bookings/${booking.id}/payment-result`;

  const { orderId, redirectUrl: phonepeRedirectUrl } = await createPhonePePayment(
    merchantOrderId,
    totalAmount,
    redirectUrl,
  );

  await prisma.transaction.create({
    data: {
      bookingId: booking.id,
      gateway: "PHONEPE",
      gatewayOrderId: orderId,
      amount: totalAmount,
      status: "CREATED",
    },
  });

  return NextResponse.json({ redirectUrl: phonepeRedirectUrl });
}