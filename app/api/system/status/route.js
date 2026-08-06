/**
 * Public system status endpoint.
 * Reads from Firestore settings/global which is publicly readable.
 * No authentication required — this must be accessible even during maintenance.
 *
 * Middleware calls this with module-level caching (30s TTL).
 * The endpoint itself does NOT cache — middleware controls the cache.
 */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(req) {
  // Security: mark this as an internal call check
  // (not enforced — just a convention marker)
  const isInternal = req.headers.get('x-internal-check') === '1';

  try {
    const { db }          = await import('@/lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');

    const snap = await getDoc(doc(db, 'settings', 'global'));

    const defaults = {
      maintenanceMode:      false,
      maintenanceMessage:   'We are performing scheduled maintenance. Please check back soon.',
      platformFeePercent:   10,
      gstPercent:           18,
      estimatedReturn:      '',
    };

    if (!snap.exists()) {
      return NextResponse.json(defaults);
    }

    const data = snap.data();

    return NextResponse.json({
      maintenanceMode:    data.maintenanceMode    ?? defaults.maintenanceMode,
      maintenanceMessage: data.maintenanceMessage ?? defaults.maintenanceMessage,
      platformFeePercent: data.platformFeePercent ?? defaults.platformFeePercent,
      gstPercent:         data.gstPercent         ?? defaults.gstPercent,
      // BUG FIX: this field was never included in the response, so
      // app/maintenance/page.jsx's `data.estimatedReturn` read always came
      // back undefined and the countdown never rendered, even when the
      // admin had set a return time in Settings.
      estimatedReturn:    data.estimatedReturn    ?? defaults.estimatedReturn,
    });
  } catch (err) {
    console.error('[/api/system/status] read failed:', err.message);
    // Fail open — do not block traffic if status check fails
    return NextResponse.json({
      maintenanceMode:    false,
      maintenanceMessage: '',
      platformFeePercent: 10,
      gstPercent:         18,
      estimatedReturn:    '',
    });
  }
}