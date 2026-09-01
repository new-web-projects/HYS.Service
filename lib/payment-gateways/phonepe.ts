import { redis } from "@/lib/redis";
import { getPhonePeCredentials, isLiveMode } from "./credentials";
import crypto from "node:crypto";

// Sandbox values confirmed directly against PhonePe's current API
// reference (developer.phonepe.com). Live values follow the same
// documented naming pattern but should be double-checked against the
// PhonePe Business Dashboard before going live — see
// MANUAL-VERIFICATION.md. Both are env-overridable for exactly that
// reason, rather than hardcoded.
const TEST_AUTH_URL =
  process.env.PHONEPE_TEST_AUTH_URL ?? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
const TEST_API_BASE = process.env.PHONEPE_TEST_API_BASE_URL ?? "https://api-preprod.phonepe.com/apis/pg-sandbox";
const LIVE_AUTH_URL =
  process.env.PHONEPE_LIVE_AUTH_URL ?? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
const LIVE_API_BASE = process.env.PHONEPE_LIVE_API_BASE_URL ?? "https://api.phonepe.com/apis/pg";

async function getUrls() {
  const live = await isLiveMode();
  return { authUrl: live ? LIVE_AUTH_URL : TEST_AUTH_URL, apiBase: live ? LIVE_API_BASE : TEST_API_BASE };
}

/**
 * O-Bearer tokens are valid for a fixed window (PhonePe returns
 * expires_at as a Unix timestamp) — cached in Redis so concurrent
 * payment attempts don't each fetch a fresh token, and refreshed a
 * couple of minutes early to avoid a request racing right past expiry.
 */
async function getAccessToken(): Promise<string> {
  const live = await isLiveMode();
  const cacheKey = `phonepe:token:${live ? "live" : "test"}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const { clientId, clientSecret, clientVersion } = await getPhonePeCredentials();
  const { authUrl } = await getUrls();

  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_version: clientVersion,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    throw new Error(`PhonePe auth token request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_at: number };

  const ttlSeconds = Math.max(60, data.expires_at - Math.floor(Date.now() / 1000) - 120);
  await redis.set(cacheKey, data.access_token, "EX", ttlSeconds);
  return data.access_token;
}

export async function createPhonePePayment(
  merchantOrderId: string,
  amountRupees: number,
  redirectUrl: string,
): Promise<{ orderId: string; redirectUrl: string }> {
  const token = await getAccessToken();
  const { apiBase } = await getUrls();

  const res = await fetch(`${apiBase}/checkout/v2/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `O-Bearer ${token}` },
    body: JSON.stringify({
      merchantOrderId,
      amount: Math.round(amountRupees * 100), // paise
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: `HYS Services booking payment`,
        merchantUrls: { redirectUrl },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`PhonePe create-payment failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { orderId: string; redirectUrl: string };
  return data;
}

export async function checkPhonePeOrderStatus(
  merchantOrderId: string,
): Promise<{ state: string; raw: unknown }> {
  const token = await getAccessToken();
  const { apiBase } = await getUrls();

  const res = await fetch(`${apiBase}/checkout/v2/order/${merchantOrderId}/status`, {
    headers: { Authorization: `O-Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`PhonePe order-status check failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { state: string };
  return { state: data.state, raw: data };
}

/**
 * PhonePe's webhook auth: the Authorization header is
 * SHA256("username:password") using the credentials configured on the
 * PhonePe dashboard for this webhook — not a request HYS Services makes,
 * a Basic-auth-style credential PhonePe echoes back for us to check.
 */
export function verifyPhonePeWebhookAuth(authorizationHeader: string | null): boolean {
  const username = process.env.PHONEPE_WEBHOOK_USERNAME;
  const password = process.env.PHONEPE_WEBHOOK_PASSWORD;
  if (!username || !password || !authorizationHeader) return false;
  const expected = crypto.createHash("sha256").update(`${username}:${password}`).digest("hex");
  if (expected.length !== authorizationHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(authorizationHeader));
}