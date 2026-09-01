import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { checkPhonePeOrderStatus } from "@/lib/payment-gateways/phonepe";
import { checkPaytmTransactionStatus } from "@/lib/payment-gateways/paytm";
import { markBookingPaid } from "@/lib/payment-gateways/mark-paid";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || (booking.customerId !== user.id && booking.workerId !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (booking.status === "PAID" || booking.status === "COMPLETED") {
    return NextResponse.json({ status: booking.status });
  }
  if (booking.status !== "READY_FOR_PAYMENT") {
    return NextResponse.json({ status: booking.status });
  }

  // Still READY_FOR_PAYMENT — a payment may genuinely be pending, or a
  // completed one just hasn't had its webhook arrive yet. Browser
  // redirects/callbacks are never trusted as proof on their own (a
  // customer's browser isn't a trusted channel); this reconciles with
  // the gateway's own server-to-server status API instead, for whichever
  // gateway has the most recent CREATED/pending transaction on record.
  const pendingTxn = await prisma.transaction.findFirst({
    where: { bookingId: id, status: "CREATED" },
    orderBy: { createdAt: "desc" },
  });
  if (!pendingTxn || !pendingTxn.gatewayOrderId) {
    return NextResponse.json({ status: booking.status });
  }

  try {
    if (pendingTxn.gateway === "PHONEPE") {
      const { state, raw } = await checkPhonePeOrderStatus(pendingTxn.gatewayOrderId);
      if (state === "COMPLETED") {
        const result = await markBookingPaid(id, "PHONEPE", pendingTxn.gatewayOrderId, raw as Record<string, unknown>);
        return NextResponse.json({ status: "PAID", otp: result.otp });
      }
      if (state === "FAILED" || state === "EXPIRED") {
        await prisma.transaction.update({ where: { id: pendingTxn.id }, data: { status: "FAILED" } });
      }
    } else if (pendingTxn.gateway === "PAYTM") {
      const { status, raw } = await checkPaytmTransactionStatus(pendingTxn.gatewayOrderId);
      if (status === "TXN_SUCCESS") {
        const result = await markBookingPaid(id, "PAYTM", pendingTxn.gatewayOrderId, raw as Record<string, unknown>);
        return NextResponse.json({ status: "PAID", otp: result.otp });
      }
      if (status === "TXN_FAILURE") {
        await prisma.transaction.update({ where: { id: pendingTxn.id }, data: { status: "FAILED" } });
      }
    }
    // RAZORPAY isn't reconciled here — its direct-callback verify route
    // is fast enough that this poll path is a Phone Pe/Paytm-specific
    // safety net; Razorpay also has its own webhook as a backstop.
  } catch (err: unknown) {
    // A transient failure calling the gateway's status API shouldn't
    // surface as "payment failed" — just report current state and let
    // the next poll (or the webhook, if it arrives first) resolve it.
    console.error(`[payment-status] ${pendingTxn.gateway} status check failed:`, err);
  }

  return NextResponse.json({ status: booking.status });
}