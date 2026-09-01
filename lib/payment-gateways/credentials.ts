import { getSettings } from "@/lib/settings";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name} — this gateway is enabled in Settings but its credentials aren't configured.`,
    );
  }
  return value;
}

export type RazorpayCredentials = { keyId: string; keySecret: string };
export type PhonePeCredentials = { clientId: string; clientSecret: string; clientVersion: string };
export type PaytmCredentials = { merchantId: string; merchantKey: string; website: string };

/**
 * TEST vs LIVE is a DB toggle (Settings.paymentMode), not an env var —
 * see .env.example's Part 8 section for why: switching modes shouldn't
 * need a redeploy. The actual secret values for either mode still only
 * ever come from env vars, never from the database.
 */
async function isLiveMode(): Promise<boolean> {
  const settings = await getSettings();
  return settings.paymentMode === "LIVE";
}

export async function getRazorpayCredentials(): Promise<RazorpayCredentials> {
  const live = await isLiveMode();
  return {
    keyId: required(
      live ? "RAZORPAY_LIVE_KEY_ID" : "RAZORPAY_TEST_KEY_ID",
      live ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_TEST_KEY_ID,
    ),
    keySecret: required(
      live ? "RAZORPAY_LIVE_KEY_SECRET" : "RAZORPAY_TEST_KEY_SECRET",
      live ? process.env.RAZORPAY_LIVE_KEY_SECRET : process.env.RAZORPAY_TEST_KEY_SECRET,
    ),
  };
}

export async function getPhonePeCredentials(): Promise<PhonePeCredentials> {
  const live = await isLiveMode();
  return {
    clientId: required(
      live ? "PHONEPE_LIVE_CLIENT_ID" : "PHONEPE_TEST_CLIENT_ID",
      live ? process.env.PHONEPE_LIVE_CLIENT_ID : process.env.PHONEPE_TEST_CLIENT_ID,
    ),
    clientSecret: required(
      live ? "PHONEPE_LIVE_CLIENT_SECRET" : "PHONEPE_TEST_CLIENT_SECRET",
      live ? process.env.PHONEPE_LIVE_CLIENT_SECRET : process.env.PHONEPE_TEST_CLIENT_SECRET,
    ),
    clientVersion:
      (live ? process.env.PHONEPE_LIVE_CLIENT_VERSION : process.env.PHONEPE_TEST_CLIENT_VERSION) ?? "1",
  };
}

export async function getPaytmCredentials(): Promise<PaytmCredentials> {
  const live = await isLiveMode();
  return {
    merchantId: required(
      live ? "PAYTM_LIVE_MERCHANT_ID" : "PAYTM_TEST_MERCHANT_ID",
      live ? process.env.PAYTM_LIVE_MERCHANT_ID : process.env.PAYTM_TEST_MERCHANT_ID,
    ),
    merchantKey: required(
      live ? "PAYTM_LIVE_MERCHANT_KEY" : "PAYTM_TEST_MERCHANT_KEY",
      live ? process.env.PAYTM_LIVE_MERCHANT_KEY : process.env.PAYTM_TEST_MERCHANT_KEY,
    ),
    website:
      (live ? process.env.PAYTM_LIVE_WEBSITE : process.env.PAYTM_TEST_WEBSITE) ??
      (live ? "DEFAULT" : "WEBSTAGING"),
  };
}

export { isLiveMode };