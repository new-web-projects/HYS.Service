import { NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/lib/payment-gateways/razorpay";
import { prisma } from "@/lib/prisma";
import { markBookingPaid } from "@/lib/payment-gateways/mark-paid";

// Webhooks are called by Razorpay's servers directly, never by a
// browser — same-origin/CSRF checks don't apply here, signature
// verification is the actual authentication mechanism for this route.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as {
    event: string;
    payload: { payment?: { entity: { id: string; order_id: string; status: string } } };
  };

  if (payload.event !== "payment.captured" && payload.event !== "order.paid") {
    // Acknowledge and ignore anything else (payment.failed, refund
    // events, etc.) — 200 so Razorpay doesn't keep retrying a webhook
    // this route deliberately isn't acting on.
    return NextResponse.json({ ok: true });
  }

  const payment = payload.payload.payment?.entity;
  if (!payment) return NextResponse.json({ ok: true });

  const txn = await prisma.transaction.findFirst({
    where: { gateway: "RAZORPAY", gatewayOrderId: payment.order_id },
  });
  if (!txn) {
    // Nothing on file for this order — acknowledge anyway; retrying
    // won't make a Transaction row appear that this app never created.
    return NextResponse.json({ ok: true });
  }

  await markBookingPaid(txn.bookingId, "RAZORPAY", payment.id, payment as unknown as Record<string, unknown>);

  return NextResponse.json({ ok: true });
}