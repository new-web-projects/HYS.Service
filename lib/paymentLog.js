/**
 * lib/paymentLog.js — Server-only Part 6 payment debugging log
 *
 * Writes to the `paymentLogs` collection: one document per payment
 * attempt, keyed by orderId, updated across its lifecycle (order created
 * -> verified -> completed, or failed at any stage). Distinct from
 * payment_error_log (lib/pricing.js's logPaymentError) — that one is
 * written only when something goes wrong, with a stack trace, for
 * investigating a specific failure. This one is written for every
 * attempt, successful or not, as an ongoing diagnostic trail.
 *
 * Server-only: uses the Admin SDK. Do not import from a 'use client'
 * component — see lib/pricing.js's updatePaymentLog() for the
 * client-side counterpart used by bookingStore.markBookingPaid().
 */
export async function writePaymentLog(orderId, fields) {
  if (!orderId) return;
  try {
    const { getAdminDb } = await import('@/lib/firebase/admin');
    await getAdminDb().collection('paymentLogs').doc(orderId).set(
      { ...fields, updatedAt: new Date() },
      { merge: true },
    );
  } catch (err) {
    // Never let logging failures block the actual payment flow.
    console.warn('[paymentLog] Failed to write paymentLogs:', err.message);
  }
}