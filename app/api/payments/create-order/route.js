export const dynamic = 'force-dynamic';

import { NextResponse }                                from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin }     from '@/lib/auth/middleware';
import { getRazorpayCredentials }                      from '@/lib/razorpayCredentials';
import { getAdminAuth, getAdminDb }                    from '@/lib/firebase/admin';
import { calculateFinalPrice }                         from '@/lib/pricing';
import { writePaymentLog }                             from '@/lib/paymentLog';
// BUG FIX: credential resolution used to be defined locally in this file
// and only ever checked Firestore for Option B (admin-panel-configured
// keys), skipping that check entirely outside firebase mode. It's now
// shared with /api/payments/verify via lib/razorpayCredentials.js, which
// also adds the missing server-mode (Prisma) lookup for Option B.
//
// PART 2 FIX (payment amount integrity): this route used to trust
// `amountInPaise` straight from the request body, with no check that it
// matched the booking's actual agreed price — a client could send any
// amount for any bookingId. This endpoint's `requireAuthOrRespond` guard
// is a no-op outside NEXT_PUBLIC_BACKEND_MODE === 'server' (see
// lib/auth/middleware.js), and customers/workers authenticate via
// Firebase, not the server-mode JWT — so in the mode this app actually
// runs in, that guard provided no protection here at all. The route now
// verifies the caller's Firebase ID token (same pattern already used in
// /api/bookings/verify-otp), fetches the booking server-side, confirms
// the caller is that booking's customer and it's actually ready for
// payment, and computes the charge amount itself from the booking's
// confirmedPrice + current platform/GST rates — the client-sent
// amountInPaise is no longer used to decide what gets charged.

async function getServerPricingRates() {
  const snap = await getAdminDb().doc('settings/global').get();
  const data = snap.exists ? snap.data() : {};
  return {
    platformFeePercent: data.platformFeePercent ?? 10,
    platformFeeType:    data.platformFeeType    ?? 'percent',
    platformFixed:      data.platformFixed      ?? 0,
    gstPercent:         data.gstPercent         ?? 18,
  };
}

export async function POST(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  // Verify caller ID token (customer/worker auth is Firebase-based)
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
  catch { return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 }); }

  const { bookingId } = body;

  if (!bookingId || typeof bookingId !== 'string') {
    return NextResponse.json({ message: 'bookingId is required.' }, { status: 422 });
  }

  // Load the booking server-side and confirm it's this caller's, and that
  // it's actually in a payable state — the single source of truth for
  // "final agreed price," never the client.
  const bookingSnap = await getAdminDb().collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) {
    return NextResponse.json({ message: 'Booking not found.' }, { status: 404 });
  }
  const booking = bookingSnap.data();

  if (booking.customerId !== callerUid) {
    return NextResponse.json(
      { message: 'You are not authorised to pay for this booking.' },
      { status: 403 },
    );
  }

  if (booking.paymentStatus === 'paid') {
    return NextResponse.json(
      { message: 'This booking has already been paid.' },
      { status: 409 },
    );
  }

  if (booking.status !== 'ready_for_payment') {
    return NextResponse.json(
      { message: 'This booking is not ready for payment yet.' },
      { status: 400 },
    );
  }

  if (!booking.confirmedPrice || booking.confirmedPrice <= 0) {
    return NextResponse.json(
      { message: 'No confirmed price found on this booking.' },
      { status: 422 },
    );
  }

  const rates      = await getServerPricingRates();
  const pricing     = calculateFinalPrice(
    booking.confirmedPrice,
    rates.platformFeePercent,
    rates.gstPercent,
    rates.platformFeeType,
    rates.platformFixed,
  );
  const amountInPaise = Math.round(pricing.finalPrice * 100);

  if (amountInPaise < 100) {
    return NextResponse.json(
      { message: 'Amount must be at least ₹1 (100 paise).' },
      { status: 422 },
    );
  }

  // PART 5 FIX (idempotency): previously every call created a brand-new
  // Razorpay order, even for a booking that already had one pending —
  // so a double-click, or a page refresh followed by clicking Pay again
  // before completing the first checkout, could produce two live orders
  // for the same booking. If either got paid, nothing here stopped a
  // second charge going through on the other. Reusing a still-fresh
  // pending order means repeated calls always route back to the exact
  // same Razorpay order, so completing checkout can only ever charge it
  // once, keyed on bookingId/orderId as required.
  const PENDING_ORDER_TTL_MS = 30 * 60 * 1000; // 30 minutes
  const pendingAgeMs = booking.pendingRazorpayOrderCreatedAt
    ? Date.now() - booking.pendingRazorpayOrderCreatedAt.toMillis()
    : Infinity;

  if (
    booking.pendingRazorpayOrderId
    && booking.pendingRazorpayOrderAmount === amountInPaise
    && pendingAgeMs < PENDING_ORDER_TTL_MS
  ) {
    const creds = await getRazorpayCredentials();
    if (creds) {
      await writePaymentLog(booking.pendingRazorpayOrderId, {
        bookingId, orderId: booking.pendingRazorpayOrderId,
        workerId: booking.workerId ?? null, customerId: callerUid,
        finalPrice: booking.confirmedPrice, platformFee: pricing.platformFee,
        gstAmount: pricing.gstAmount, totalAmount: pricing.finalPrice,
        paymentStatus: 'order_reused', verificationStatus: 'pending',
      });
      return NextResponse.json({
        orderId:       booking.pendingRazorpayOrderId,
        keyId:         creds.keyId,
        merchantName:  creds.merchantName,
        amountInPaise,
        reused:        true,
      });
    }
    // Fall through to create fresh if credentials can't be resolved —
    // extremely unlikely given the order above was created successfully,
    // but never block a customer on a missing-credentials edge case.
  }

  // Stub mode — payment not enabled. Still returns the server-computed
  // amount, so the UI reflects the real figure even without a real gateway.
  if (process.env.NEXT_PUBLIC_PAYMENT_ENABLED !== 'true') {
    return NextResponse.json({
      orderId:       `stub_${Date.now()}`,
      keyId:         'not_configured',
      amountInPaise,
      merchantName:  'HYS Services',
      stub:          true,
    });
  }

  const creds = await getRazorpayCredentials();

  if (!creds) {
    return NextResponse.json(
      {
        message:
          'Razorpay credentials not configured. ' +
          'Option A: Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local. ' +
          'Option B: Go to Admin Panel → Settings → Payment Settings.',
      },
      { status: 500 },
    );
  }

  const credentials = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');

  let rzpRes;
  try {
    rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount:   amountInPaise,
        currency: 'INR',
        receipt:  `booking_${bookingId}`,
        notes:    { bookingId, customerId: callerUid, workerId: booking.workerId ?? '' },
      }),
    });
  } catch (networkErr) {
    return NextResponse.json(
      { message: `Network error connecting to Razorpay: ${networkErr.message}` },
      { status: 502 },
    );
  }

  if (!rzpRes.ok) {
    const err = await rzpRes.json().catch(() => ({}));
    console.error('[payments/create-order] Razorpay error:', err);
    return NextResponse.json({ message: 'Failed to create Razorpay order.' }, { status: 502 });
  }

  const order = await rzpRes.json();

  // Remember this order on the booking so a repeat call (double-click,
  // refresh + click again) reuses it instead of minting a new one.
  try {
    const admin = (await import('firebase-admin')).default;
    await getAdminDb().collection('bookings').doc(bookingId).update({
      pendingRazorpayOrderId:        order.id,
      pendingRazorpayOrderAmount:    order.amount,
      pendingRazorpayOrderCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Non-critical — worst case a retry creates a second order instead of
    // reusing this one. Never block the customer's actual payment on it.
    console.warn('[payments/create-order] Failed to record pending order:', err.message);
  }

  // PART 6: payment debugging log — one entry per attempt, keyed by
  // orderId, updated again by /api/payments/verify and by
  // bookingStore.markBookingPaid() as this attempt progresses.
  await writePaymentLog(order.id, {
    bookingId, orderId: order.id, paymentId: null,
    workerId: booking.workerId ?? null, customerId: callerUid,
    finalPrice: booking.confirmedPrice, platformFee: pricing.platformFee,
    gstAmount: pricing.gstAmount, totalAmount: pricing.finalPrice,
    paymentStatus: 'order_created', verificationStatus: 'pending',
    errorMessage: null, timestamp: new Date(),
  });

  return NextResponse.json({
    orderId:       order.id,
    keyId:         creds.keyId,
    merchantName:  creds.merchantName,
    amountInPaise: order.amount,
  });
}