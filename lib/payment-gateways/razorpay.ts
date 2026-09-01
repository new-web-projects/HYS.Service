import Razorpay from "razorpay";
import crypto from "node:crypto";
import { getRazorpayCredentials } from "./credentials";

export async function createRazorpayOrder(
  amountRupees: number,
  receipt: string,
  notes?: Record<string, string>,
): Promise<{ orderId: string; keyId: string; amountPaise: number }> {
  const { keyId, keySecret } = await getRazorpayCredentials();
  const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const amountPaise = Math.round(amountRupees * 100);
  const order = await instance.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes,
  });
  // keyId is returned alongside the order because Razorpay's client-side
  // Checkout needs it directly — it's a public identifier, not a secret
  // (the secret itself never leaves this module).
  return { orderId: order.id, keyId, amountPaise };
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  // timingSafeEqual throws on mismatched buffer lengths rather than
  // returning false, which a tampered/malformed signature could easily
  // trigger — length-check first so that case fails clean instead of
  // throwing an unhandled error out of a payment-verification path.
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * Verifies the razorpay_order_id/razorpay_payment_id/razorpay_signature
 * Checkout returns directly to the client on success. This is the fast
 * path for instant UI feedback — the webhook below is still the durable
 * source of truth (Razorpay's own docs recommend both).
 */
export async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const { keySecret } = await getRazorpayCredentials();
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

/** Verify against the raw request body string — re-serialised JSON won't match. */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}