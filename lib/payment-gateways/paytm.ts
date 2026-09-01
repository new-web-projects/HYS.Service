import PaytmChecksum from "paytmchecksum";
import { getPaytmCredentials, isLiveMode } from "./credentials";

// Staging value confirmed directly against Paytm's own docs
// (paytmpayments.com). The live value follows their documented naming
// convention but wasn't reachable as an exact quoted string during
// development — double-check against the Paytm Business Dashboard
// before going live (see MANUAL-VERIFICATION.md).
const TEST_BASE_URL = process.env.PAYTM_TEST_BASE_URL ?? "https://securestage.paytmpayments.com";
const LIVE_BASE_URL = process.env.PAYTM_LIVE_BASE_URL ?? "https://securegw.paytmpayments.com";

async function getBaseUrl(): Promise<string> {
  return (await isLiveMode()) ? LIVE_BASE_URL : TEST_BASE_URL;
}

type InitiateTransactionResult = {
  orderId: string;
  txnToken: string;
  paymentPageUrl: string;
  mid: string;
};

export async function initiatePaytmTransaction(
  orderId: string,
  amountRupees: number,
  callbackUrl: string,
  customer: { id: string; email: string; phone: string | null },
): Promise<InitiateTransactionResult> {
  const { merchantId, merchantKey, website } = await getPaytmCredentials();
  const baseUrl = await getBaseUrl();

  const body = {
    requestType: "Payment",
    mid: merchantId,
    websiteName: website,
    orderId,
    callbackUrl,
    txnAmount: { value: amountRupees.toFixed(2), currency: "INR" },
    userInfo: { custId: customer.id, email: customer.email, mobile: customer.phone ?? undefined },
  };

  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), merchantKey);

  const res = await fetch(`${baseUrl}/theia/api/v1/initiateTransaction?mid=${merchantId}&orderId=${orderId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ head: { signature }, body }),
  });
  if (!res.ok) {
    throw new Error(`Paytm initiate-transaction failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    body: { txnToken?: string; resultInfo: { resultStatus: string; resultCode: string; resultMsg: string } };
  };
  if (data.body.resultInfo.resultStatus !== "S" || !data.body.txnToken) {
    throw new Error(`Paytm initiate-transaction rejected: ${data.body.resultInfo.resultMsg}`);
  }

  return {
    orderId,
    txnToken: data.body.txnToken,
    // The client builds a hidden form POST to this URL with mid/orderId/
    // txnToken — Paytm's website flow doesn't hand back a ready-made
    // redirect URL the way PhonePe/Razorpay do.
    paymentPageUrl: `${baseUrl}/theia/api/v1/showPaymentPage`,
    mid: merchantId,
  };
}

export async function checkPaytmTransactionStatus(orderId: string): Promise<{ status: string; raw: unknown }> {
  const { merchantId, merchantKey } = await getPaytmCredentials();
  const baseUrl = await getBaseUrl();

  const body = { mid: merchantId, orderId };
  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), merchantKey);

  const res = await fetch(`${baseUrl}/v3/order/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ head: { signature }, body }),
  });
  if (!res.ok) {
    throw new Error(`Paytm status check failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { body: { resultInfo: { resultStatus: string } } };
  return { status: data.body.resultInfo.resultStatus, raw: data };
}

/** Verifies a callback/webhook payload's CHECKSUMHASH field against the merchant key. */
export async function verifyPaytmChecksum(
  params: Record<string, string>,
  checksum: string,
): Promise<boolean> {
  const { merchantKey } = await getPaytmCredentials();
  const rest = { ...params };
  delete rest.CHECKSUMHASH;
  return PaytmChecksum.verifySignature(rest, merchantKey, checksum);
}