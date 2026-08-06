export const dynamic = 'force-dynamic';

import { NextResponse }  from 'next/server';
import { getAdminAuth }  from '@/lib/firebase/admin';

/**
 * POST /api/bookings/verify-otp
 *
 * Secure server-side OTP verification for booking completion.
 * Uses Admin SDK — the completionOtp field is NEVER sent to the client.
 *
 * Security model:
 *  - Only the assigned worker may call this (verified via ID token)
 *  - Max 5 attempts; booking locked after that
 *  - runTransaction prevents race conditions on simultaneous requests
 *  - On success: status=completed, otpStatus=verified, earnings unlocked
 *
 * Body: { bookingId: string, otp: string }
 */
export async function POST(req) {
  // Verify caller ID token
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken    = authHeader.replace('Bearer ', '').trim();
  if (!idToken) {
    return NextResponse.json({ message: 'Unauthorised.' }, { status: 401 });
  }

  let callerUid;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    callerUid     = decoded.uid;
  } catch {
    return NextResponse.json({ message: 'Invalid or expired session.' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }

  const { bookingId, otp } = body ?? {};
  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ message: 'bookingId is required.' }, { status: 422 });
  }
  if (!otp || !/^\d{6}$/.test(otp.toString().trim())) {
    return NextResponse.json({ message: 'OTP must be exactly 6 digits.' }, { status: 422 });
  }

  const admin     = (await import('firebase-admin')).default;
  const db        = admin.firestore();
  const bookRef   = db.collection('bookings').doc(bookingId);
  const MAX_TRIES = 5;
  const entered   = otp.toString().trim();

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookRef);
      if (!snap.exists) return { error: 'Booking not found.', code: 404 };

      const d = snap.data();

      // Only the assigned worker may complete the booking
      if (d.workerId !== callerUid) {
        return { error: 'You are not authorised to complete this booking.', code: 403 };
      }

      if (d.status === 'completed' || d.otpVerified) {
        return { error: 'This booking has already been completed.', code: 409 };
      }

      if (d.paymentStatus !== 'paid') {
        return { error: 'Booking has not been paid. Cannot complete.', code: 400 };
      }

      if (d.otpStatus === 'locked') {
        return {
          error:
            'Too many incorrect OTP attempts. This booking is locked. ' +
            'Please contact support for manual resolution.',
          code: 429,
        };
      }

      if (!d.completionOtp) {
        return { error: 'No OTP found for this booking. Contact support.', code: 500 };
      }

      const attempts  = (d.otpAttempts ?? 0) + 1;
      const serverNow = admin.firestore.FieldValue.serverTimestamp();

      // ── Wrong OTP ───────────────────────────────────────────────────────────
      if (d.completionOtp !== entered) {
        const locked    = attempts >= MAX_TRIES;
        const remaining = MAX_TRIES - attempts;

        tx.update(bookRef, {
          otpAttempts: attempts,
          otpStatus:   locked ? 'locked' : 'pending',
          updatedAt:   serverNow,
        });

        return locked
          ? {
              error:
                'Incorrect OTP. Maximum attempts reached. ' +
                'This booking is now locked. Contact support.',
              code: 429,
            }
          : {
              error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
              code: 400,
              remaining,
            };
      }

      // ── Correct OTP ─────────────────────────────────────────────────────────
      tx.update(bookRef, {
        status:      'completed',
        otpVerified: true,
        otpStatus:   'verified',
        otpAttempts: attempts,
        completedAt: serverNow,
        updatedAt:   serverNow,
      });

      return {
        ok:           true,
        workerId:     d.workerId,
        customerId:   d.customerId,
        workerName:   d.workerName,
        customerName: d.customerName,
        basePrice:    d.basePrice   ?? d.priceQuoted ?? 0,
        categoryName: d.categoryName ?? '',
      };
    });

    // Transaction error
    if (result.error) {
      return NextResponse.json(
        { message: result.error, remaining: result.remaining ?? null },
        { status: result.code },
      );
    }

    // ── Side effects (non-critical — never fail the response) ────────────────

    const { workerId, customerId, workerName, customerName, basePrice, categoryName } = result;

    // 1. Unlock worker earnings: locked → available
    try {
      const earningsSnap = await db.collection('workerEarnings')
        .where('bookingId', '==', bookingId)
        .where('workerId',  '==', workerId)
        .limit(1)
        .get();

      if (!earningsSnap.empty) {
        await earningsSnap.docs[0].ref.update({
          status:     'available',
          unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('[verify-otp] earnings unlock failed:', err.message);
    }

    // 2. Increment ordersCompleted + auto-verify at 999
    try {
      const workerRef = db.collection('workers').doc(workerId);
      await db.runTransaction(async (tx2) => {
        const wSnap = await tx2.get(workerRef);
        if (!wSnap.exists) return;
        const wd       = wSnap.data();
        const newCount = (wd.ordersCompleted ?? 0) + 1;
        const upd      = {
          ordersCompleted: newCount,
          updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
        };
        if (newCount >= 999 && !wd.isVerified) upd.isVerified = true;
        tx2.update(workerRef, upd);
      });
    } catch (err) {
      console.warn('[verify-otp] ordersCompleted update failed:', err.message);
    }

    // 3. Notifications — both parties
    try {
      const { createNotification } = await import('@/lib/notifications');
      await Promise.all([
        createNotification(customerId, 'booking_completed',        { workerName  }, bookingId),
        createNotification(workerId,   'booking_completed_worker',  { basePrice, categoryName }, bookingId),
      ]);
    } catch (err) {
      console.warn('[verify-otp] notifications failed:', err.message);
    }

    return NextResponse.json({ success: true, message: 'Booking completed successfully.' });

  } catch (err) {
    console.error('[verify-otp] transaction error:', err.message);
    return NextResponse.json({ message: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
