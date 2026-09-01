import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { env } from "@/lib/env";
import { validatePaymentRequest, totalAmountFor } from "@/lib/payment-gateways/validate-request";
import { initiatePaytmTransaction } from "@/lib/payment-gateways/paytm";

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
  const { booking, error } = await validatePaymentRequest(id, user.id, "paytm");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const totalAmount = totalAmountFor(booking);
  const orderId = `${booking.id}-${Date.now()}`;
  const callbackUrl = `${env.NEXT_PUBLIC_APP_URL}/api/payments/paytm/callback`;

  const { txnToken, paymentPageUrl, mid } = await initiatePaytmTransaction(orderId, totalAmount, callbackUrl, {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
  });

  await prisma.transaction.create({
    data: {
      bookingId: booking.id,
      gateway: "PAYTM",
      gatewayOrderId: orderId,
      amount: totalAmount,
      status: "CREATED",
    },
  });

  // Paytm's website flow needs a hidden-form POST, not a plain redirect —
  // the client builds that form from these three fields.
  return NextResponse.json({ orderId, txnToken, paymentPageUrl, mid });
}