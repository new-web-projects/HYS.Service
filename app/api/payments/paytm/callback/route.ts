/** File Path: app/api/payments/paytm/callback/route.ts */

import { NextResponse } from "next/server";
import { verifyPaytmChecksum, checkPaytmTransactionStatus } from "@/lib/payment-gateways/paytm";
import { prisma } from "@/lib/prisma";
import { markBookingPaid } from "@/lib/payment-gateways/mark-paid";
import { env } from "@/lib/env";
import { logError } from "@/lib/log-error";

// This arrives as a browser form POST (the customer's browser, redirected
// here by Paytm after checkout) — not a trusted server-to-server channel,
// unlike the other two gateways' webhooks. The checksum proves Paytm
// produced these specific values, but the claimed status still isn't
// trusted on its own: this always re-confirms via the server-to-server
// Transaction Status API before marking anything paid.
export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }
  const checksum = params.CHECKSUMHASH;
  const orderId = params.ORDERID;

  let bookingId: string | null = null;
  try {
    if (checksum && orderId && (await verifyPaytmChecksum(params, checksum))) {
      const txn = await prisma.transaction.findFirst({ where: { gateway: "PAYTM", gatewayOrderId: orderId } });
      if (txn) {
        bookingId = txn.bookingId;
        const { status, raw } = await checkPaytmTransactionStatus(orderId);
        if (status === "TXN_SUCCESS") {
          await markBookingPaid(txn.bookingId, "PAYTM", params.TXNID ?? orderId, raw as Record<string, unknown>);
        } else if (status === "TXN_FAILURE") {
          await prisma.transaction.update({ where: { id: txn.id }, data: { status: "FAILED" } });
        }
      }
    }
  } catch (err: unknown) {
    console.error("[paytm callback] processing failed:", err);
    // This route already catches everything internally so it can always
    // fall through to a redirect (a customer's browser is on the other
    // end, not an API consumer) — a generic withErrorLogging wrapper
    // would never actually see an exception here, since none escapes
    // this catch. Logging it here directly is the correct fix instead.
    await logError({
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      route: "payments/paytm/callback",
    });
  }

  const resultUrl = bookingId
    ? `${env.NEXT_PUBLIC_APP_URL}/customer-bookings/${bookingId}/payment-result`
    : `${env.NEXT_PUBLIC_APP_URL}/customer-bookings`;
  return NextResponse.redirect(resultUrl, { status: 303 });
}