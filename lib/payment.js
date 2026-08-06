/**
 * lib/payment.js — Compatibility shim
 *
 * lib/pricing.js is the source of truth for all pricing and payment logic.
 *
 * This file exists because earlier parts of the build imported from
 * lib/payment.js. Rather than hunting down every import across the codebase,
 * this file re-exports everything from lib/pricing.js so all existing
 * imports continue to work without changes.
 *
 * DO NOT add new logic here. Add it to lib/pricing.js instead.
 *
 * Bugs fixed vs previous version:
 */

// ─── Re-export all symbols from lib/pricing.js ───────────────────────────────

export {
  PAYMENT_CONFIG,
  DEFAULT_PLATFORM_FEE_PERCENT,
  DEFAULT_GST_PERCENT,
  DEFAULT_GST_MODE_ENABLED,
  calculateFinalPrice,
  calculateFinalPriceWithCurrentRates,
  getFeeRows,
  getPricingRates,
  formatPrice,
  formatPaymentPrice,
  createPaymentOrder,
  openRazorpayCheckout,
  verifyPayment,
  logPaymentError,
  updatePaymentLog,
} from '@/lib/pricing';

// calculateBookingPrice (hourly) has been removed.
// Use calculateFinalPrice(basePrice) from lib/pricing.js directly.