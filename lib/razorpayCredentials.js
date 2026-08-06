/**
 * lib/razorpayCredentials.js — Server-only Razorpay credential resolution
 *
 * Shared by app/api/payments/create-order and app/api/payments/verify so
 * both routes agree on where credentials come from. This file uses
 * firebase-admin and the Prisma client, both server-only — do not import
 * it from a 'use client' component.
 *
 * Resolution order:
 *   1. Environment variables RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
 *      (Option A — recommended, works in either backend mode).
 *   2. Admin-panel-configured settings (Option B) — Firestore in firebase
 *      mode, the Prisma Settings row in server mode.
 *
 * BUG FIX: this resolution logic previously lived only inside
 * create-order/route.js, and its Option B branch only ever checked
 * Firestore — it was skipped entirely outside firebase mode, so Option B
 * had no server-mode implementation at all. Separately, verify/route.js
 * never had an Option B path of its own — it only ever read the env var.
 * The combination meant: an admin using Option B (configuring keys via
 * Settings instead of .env) could successfully create a Razorpay order,
 * but verification would always fail with "RAZORPAY_KEY_SECRET not
 * configured," even in firebase mode. Centralizing the lookup here and
 * giving both routes the same resolver fixes both gaps at once.
 */
export async function getRazorpayCredentials() {
  // Option A — environment variables (recommended)
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    return {
      keyId:        process.env.RAZORPAY_KEY_ID,
      keySecret:    process.env.RAZORPAY_KEY_SECRET,
      merchantName: process.env.RAZORPAY_MERCHANT_NAME || 'HYS Services',
      source:       'env',
    };
  }

  // Option B — admin panel settings
  const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;

  try {
    if (mode === 'server') {
      const { default: prisma } = await import('@/lib/prisma/client');
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      if (settings?.razorpayKeyId && settings?.razorpayKeySecret) {
        return {
          keyId:        settings.razorpayKeyId,
          keySecret:    settings.razorpayKeySecret,
          merchantName: settings.razorpayMerchantName || 'HYS Services',
          source:       'database',
        };
      }
    } else {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const snap = await getAdminDb().doc('settings/global').get();
      if (snap.exists) {
        const data = snap.data();
        if (data.razorpayKeyId && data.razorpayKeySecret) {
          return {
            keyId:        data.razorpayKeyId,
            keySecret:    data.razorpayKeySecret,
            merchantName: data.razorpayMerchantName || 'HYS Services',
            source:       'firestore',
          };
        }
      }
    }
  } catch (err) {
    console.error('[razorpayCredentials] Failed to read Option B credentials:', err.message);
  }

  return null;
}