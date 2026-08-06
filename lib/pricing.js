/**
 * Pricing Module — Quote-Based Booking System
 *
 * FORMULA:
 *   PLATFORM_FEE = BASE_PRICE × PLATFORM_FEE_PERCENT / 100
 *   GST          = PLATFORM_FEE × GST_PERCENT / 100   ← GST ONLY on platform fee
 *   FINAL_PRICE  = BASE_PRICE + PLATFORM_FEE + GST
 *
 * GST is NEVER applied on the worker's agreed price (BASE_PRICE).
 * GST applies ONLY to the platform fee.
 *
 * Example: Agreed ₹1000, Platform fee 10% = ₹100, GST 18% on ₹100 = ₹18 → Total ₹1118
 *
 * The worker receives BASE_PRICE.
 * The customer pays FINAL_PRICE (always shown inclusive of all charges).
 */

// ─── Defaults (overridden by Firestore settings) ──────────────────────────────

export const DEFAULT_PLATFORM_FEE_PERCENT = 10;
export const DEFAULT_PLATFORM_FEE_FIXED   = 0;    // flat ₹ when feeType='fixed'
export const DEFAULT_PLATFORM_FEE_TYPE    = 'percent'; // 'percent' | 'fixed'
export const DEFAULT_GST_PERCENT          = 18;

// Part 6 — Admin GST Mode System.
// Controls whether GST/CGST/SGST/IGST terminology and breakdown rows are
// shown to customers/workers. The underlying math (gstAmount, finalPrice)
// is ALWAYS computed and stored identically regardless of this setting —
// only DISPLAY labels change. Default OFF (simplified labels).
export const DEFAULT_GST_MODE_ENABLED     = false;

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * Calculates the complete price breakdown from a worker's base quote.
 *
 * @param {number} basePrice         — Worker's quoted base price (₹)
 * @param {number} [platformPercent] — Platform fee % (default: 10)
 * @param {number} [gstPercent]      — GST % applied ONLY on platform fee
 * @returns {{
 *   basePrice:       number,   — What worker quoted (worker receives this)
 *   platformFee:     number,   — Platform commission
 *   platformPercent: number,   — % used for display
 *   gstAmount:       number,   — GST amount
 *   gstPercent:      number,   — % used for display
 *   finalPrice:      number,   — What customer pays (ALWAYS show this)
 *   workerReceives:  number,   — Same as basePrice — for clarity
 * }}
 */
export function calculateFinalPrice(
  basePrice,
  platformPercent = DEFAULT_PLATFORM_FEE_PERCENT,
  gstPercent      = DEFAULT_GST_PERCENT,
  platformFeeType = DEFAULT_PLATFORM_FEE_TYPE,
  platformFixed   = DEFAULT_PLATFORM_FEE_FIXED,
) {
  const base        = Math.max(0, parseFloat(basePrice) || 0);
  const pfPct       = Math.max(0, parseFloat(platformPercent) || 0);
  const gstPct      = Math.max(0, parseFloat(gstPercent)      || 0);

  // Platform fee: % of base OR flat fixed amount (admin-configured)
  const platformFee = platformFeeType === 'fixed'
    ? parseFloat((Math.max(0, parseFloat(platformFixed) || 0)).toFixed(2))
    : parseFloat((base * pfPct / 100).toFixed(2));
  // GST applies ONLY on platform fee — never on the worker's agreed price
  const gstAmount   = parseFloat((platformFee * gstPct / 100).toFixed(2));
  const finalPrice  = parseFloat((base + platformFee + gstAmount).toFixed(2));

  return {
    basePrice:       base,
    platformFee,
    platformPercent: pfPct,
    platformFeeType,
    platformFixed:   Math.max(0, parseFloat(platformFixed) || 0),
    gstAmount,
    gstPercent:      gstPct,
    finalPrice,
    workerReceives:  base,  // Explicit alias for UI clarity
  };
}

/**
 * Returns the "fee" line-item(s) of a price breakdown — the portion that
 * varies based on GST Mode (Part 6 — Admin GST Mode System).
 *
 *   GST Mode ON  → 2 rows: "Platform fee (X%)" + "GST on platform fee (Y%)"
 *   GST Mode OFF → 1 row:  "Platform Fee" (platformFee + gstAmount combined,
 *                           no percentage, no GST/CGST/SGST/IGST wording)
 *
 * IMPORTANT: `finalPrice` (basePrice + platformFee + gstAmount) is identical
 * in both modes — only how the fee portion is DISPLAYED changes. gstAmount
 * remains computed and stored on every booking/quote/transaction regardless
 * of this setting, so historical data and future GST-ready invoicing are
 * unaffected (requirements 5–8 of Part 6).
 *
 * @param {{platformFee:number, platformPercent:number,
 *          gstAmount:number, gstPercent:number}} pricing
 * @param {boolean} [gstModeEnabled]
 * @returns {{label:string, value:number, hint:string}[]}
 */
export function getFeeRows(pricing, gstModeEnabled = DEFAULT_GST_MODE_ENABLED) {
  // Platform-fee row label: percent-based (default) or fixed-amount (admin
  // preview only — other callers never pass platformFeeType, so this is a
  // no-op for them).
  const platformLabel = pricing.platformFeeType === 'fixed'
    ? `Platform fee (fixed ₹${pricing.platformFixed ?? 0})`
    : `Platform fee (${pricing.platformPercent}%)`;

  if (gstModeEnabled) {
    return [
      {
        label: platformLabel,
        value: pricing.platformFee,
        hint:  'Service platform commission',
      },
      {
        label: `GST on platform fee (${pricing.gstPercent}%)`,
        value: pricing.gstAmount,
        hint:  'Applied on platform fee only (not on worker earnings)',
      },
    ];
  }

  // GST Mode OFF: fold platform fee + GST into one simplified, tax-free line.
  const combined = parseFloat(((pricing.platformFee || 0) + (pricing.gstAmount || 0)).toFixed(2));
  return [
    {
      label: 'Platform Fee',
      value: combined,
      hint:  'Service charge for using the platform',
    },
  ];
}

/**
 * Fetches current platform fee % and GST % from Firestore.
 * Uses a module-level cache so we don't read Firestore on every calculation.
 * Cache TTL: 60 seconds.
 *
 * @returns {Promise<{ platformFeePercent: number, gstPercent: number }>}
 */
const ratesCache = { data: null, expiresAt: 0 };

/**
 * Invalidates the pricing rates cache.
 * Call this after admin saves settings so new fee rates apply immediately.
 */
export function invalidatePricingCache() {
  ratesCache.data      = null;
  ratesCache.expiresAt = 0;
}

export async function getPricingRates() {
  const now = Date.now();

  if (ratesCache.data && now < ratesCache.expiresAt) {
    return ratesCache.data;
  }

  try {
    const { db }          = await import('@/lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');

    const snap = await getDoc(doc(db, 'settings', 'global'));
    const data = snap.exists() ? snap.data() : {};

    const rates = {
      platformFeePercent: data.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT,
      platformFeeType:    data.platformFeeType    ?? DEFAULT_PLATFORM_FEE_TYPE,
      platformFixed:      data.platformFixed      ?? DEFAULT_PLATFORM_FEE_FIXED,
      gstPercent:         data.gstPercent         ?? DEFAULT_GST_PERCENT,
      gstModeEnabled:     data.gstModeEnabled     ?? DEFAULT_GST_MODE_ENABLED,
    };

    ratesCache.data      = rates;
    ratesCache.expiresAt = now + 60_000; // 60-second cache

    return rates;
  } catch (err) {
    console.warn('[pricing] Failed to fetch rates from Firestore, using defaults:', err.message);
    return {
      platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
      platformFeeType:    DEFAULT_PLATFORM_FEE_TYPE,
      platformFixed:      DEFAULT_PLATFORM_FEE_FIXED,
      gstPercent:         DEFAULT_GST_PERCENT,
      gstModeEnabled:     DEFAULT_GST_MODE_ENABLED,
    };
  }
}

/**
 * Convenience: fetches current rates from Firestore and calculates breakdown.
 * Use this when creating a quote.
 *
 * @param {number} basePrice
 * @returns {Promise<ReturnType<typeof calculateFinalPrice>>}
 */
export async function calculateFinalPriceWithCurrentRates(basePrice) {
  const { platformFeePercent, platformFeeType, platformFixed, gstPercent } = await getPricingRates();
  return calculateFinalPrice(basePrice, platformFeePercent, gstPercent, platformFeeType, platformFixed);
}

/**
 * Formats a ₹ amount for display (Indian number formatting).
 * @param {number} amount
 * @returns {string}
 */
export function formatPrice(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// Re-export for existing code that imports from lib/payment.js
export { formatPrice as formatPaymentPrice };

// ─── Payment integration (Razorpay) ──────────────────────────────────────────

export const PAYMENT_CONFIG = {
  enabled:  process.env.NEXT_PUBLIC_PAYMENT_ENABLED === 'true',
  currency: 'INR',
  symbol:   '₹',
};

export async function createPaymentOrder({ bookingId, amountInPaise }) {
  // PART 2 FIX: the server now derives the charge amount itself from the
  // booking record and verifies the caller via their Firebase ID token
  // (see app/api/payments/create-order/route.js) rather than trusting
  // amountInPaise from this call — so it must be attached here. Kept as a
  // parameter for backward compatibility with existing call sites; the
  // server no longer uses its value to decide what gets charged.
  const { getAuth }  = await import('firebase/auth');
  const currentUser  = getAuth().currentUser;
  if (!currentUser) throw new Error('Session expired. Please log in again.');
  const idToken = await currentUser.getIdToken();

  const res = await fetch('/api/payments/create-order', {
    method:      'POST',
    headers:     {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    credentials: 'include',
    body:        JSON.stringify({ bookingId, amountInPaise }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Failed to create payment order.');
  }
  return res.json();
}

export async function openRazorpayCheckout(options) {
  await new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script     = document.createElement('script');
    script.src       = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload    = resolve;
    script.onerror   = () => reject(new Error('Failed to load Razorpay checkout.'));
    document.body.appendChild(script);
  });

  const rzp = new window.Razorpay({
    key:         options.keyId,
    amount:      options.amountInPaise,
    currency:    PAYMENT_CONFIG.currency,
    order_id:    options.orderId,
    name:        options.merchantName || 'HYS Services',
    description: options.description,
    prefill: {
      name:  options.customerName,
      email: options.customerEmail,
    },
    theme:   { color: '#2563eb' },
    handler: (response) => options.onSuccess({
      paymentId: response.razorpay_payment_id,
      orderId:   response.razorpay_order_id,
      signature: response.razorpay_signature,
    }),
    modal: { ondismiss: options.onDismiss },
  });

  rzp.open();
}

export async function verifyPayment({ paymentId, orderId, signature, bookingId }) {
  const res = await fetch('/api/payments/verify', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify({ paymentId, orderId, signature, bookingId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Payment verification failed.');
  }
}

/**
 * PART 3 FIX: handlePayment's onSuccess handler used to catch any failure
 * from verifyPayment()/markBookingPaid() with a bare `catch {}` — the
 * error itself was never even captured, let alone logged anywhere. A
 * customer could be charged, see "Payment received but verification
 * failed. Contact support," and there would be zero record of what
 * actually went wrong: no booking id, no payment id, no error message,
 * nothing to act on. This writes exactly what's needed to investigate:
 * the booking/payment/order ids, both parties' ids, the error message and
 * stack, and when it happened. This write itself is wrapped in try/catch
 * and never throws — a logging failure must never mask the original
 * payment error from the customer-facing toast.
 */
export async function logPaymentError({
  bookingId, paymentId, orderId, userId, workerId, error, stage,
}) {
  try {
    const { db }                             = await import('@/lib/firebase/config');
    const { collection, addDoc, Timestamp }  = await import('firebase/firestore');
    await addDoc(collection(db, 'payment_error_log'), {
      bookingId:    bookingId ?? null,
      paymentId:    paymentId ?? null,
      orderId:      orderId   ?? null,
      userId:       userId    ?? null,
      workerId:     workerId  ?? null,
      stage:        stage     ?? 'unknown',   // 'verify' | 'mark_paid' | 'unknown'
      errorMessage: error?.message ?? String(error ?? 'Unknown error'),
      stackTrace:   error?.stack   ?? null,
      timestamp:    Timestamp.now(),
    });
  } catch (logErr) {
    // Never let a logging failure hide the original payment error.
    console.error('[logPaymentError] Failed to write payment_error_log:', logErr.message);
  }
}

/**
 * Client-side counterpart to lib/paymentLog.js's writePaymentLog() (which
 * creates the entry, server-side, when the order is created). This updates
 * that same entry — merge only, never creates one from scratch — once
 * bookingStore.markBookingPaid() actually completes, so the log reflects
 * the full lifecycle (order_created -> paid) instead of stopping at
 * "order created" forever. Never throws: logging must never block the
 * actual payment flow it's describing.
 */
export async function updatePaymentLog(orderId, fields) {
  if (!orderId) return;
  try {
    const { db }                          = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp }   = await import('firebase/firestore');
    await updateDoc(doc(db, 'paymentLogs', orderId), {
      ...fields,
      updatedAt: Timestamp.now(),
    });
  } catch (err) {
    console.warn('[updatePaymentLog] Failed to update paymentLogs:', err.message);
  }
}