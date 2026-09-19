/** File Path: app/api/payments/phonepe/webhook/route.ts */

import { NextResponse } from "next/server";
import { verifyPhonePeWebhookAuth } from "@/lib/payment-gateways/phonepe";
import { prisma } from "@/lib/prisma";
import { markBookingPaid } from "@/lib/payment-gateways/mark-paid";
import { withErrorLogging } from "@/lib/with-error-logging";

async function handlePost(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!verifyPhonePeWebhookAuth(authHeader)) {
    return NextResponse.json({ error: "Invalid auth" }, { status: 400 });
  }

  const payload = (await request.json()) as {
    payload?: { orderId?: string; state?: string; paymentDetails?: Array<{ transactionId?: string }> };
  };
  const orderId = payload.payload?.orderId;
  if (!orderId || payload.payload?.state !== "COMPLETED") {
    return NextResponse.json({ ok: true });
  }

  const txn = await prisma.transaction.findFirst({ where: { gateway: "PHONEPE", gatewayOrderId: orderId } });
  if (!txn) return NextResponse.json({ ok: true });

  const gatewayPaymentId = payload.payload?.paymentDetails?.[0]?.transactionId ?? orderId;
  await markBookingPaid(txn.bookingId, "PHONEPE", gatewayPaymentId, payload as unknown as Record<string, unknown>);

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(handlePost, "payments/phonepe/webhook");