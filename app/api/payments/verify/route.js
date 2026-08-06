export const dynamic = 'force-dynamic';

import { NextResponse }                                    from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin }         from '@/lib/auth/middleware';
import { getRazorpayCredentials }                          from '@/lib/razorpayCredentials';
import { writePaymentLog }                                 from '@/lib/paymentLog';

export async function POST(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 }); }

  const { paymentId, orderId, signature, bookingId } = body;

  if (!paymentId || !orderId || !signature || !bookingId) {
    return NextResponse.json(
      { message: 'paymentId, orderId, signature, and bookingId are all required.' },
      { status: 422 },
    );
  }

  // Stub mode — payment disabled, trust the client
  if (process.env.NEXT_PUBLIC_PAYMENT_ENABLED !== 'true') {
    return NextResponse.json({ verified: true, stub: true });
  }

  // BUG FIX: this used to read only process.env.RAZORPAY_KEY_SECRET, with
  // no fallback — so an order created via Option B (admin-panel-configured
  // credentials, no env vars set) would always fail verification here.
  // getRazorpayCredentials() resolves the same way create-order does.
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
  const keySecret = creds.keySecret;

  // Verify: HMAC-SHA256(orderId + '|' + paymentId, keySecret) must equal signature
  const crypto   = await import('crypto');
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expected !== signature) {
    console.error('[payments/verify] Signature mismatch', {
      expected: expected.slice(0, 8) + '...',
      received: signature.slice(0, 8) + '...',
    });
    await writePaymentLog(orderId, {
      bookingId, orderId, paymentId,
      paymentStatus: 'failed', verificationStatus: 'failed',
      errorMessage: 'Signature verification failed.',
    });
    return NextResponse.json(
      { message: 'Payment signature verification failed. Do not mark this booking as paid.' },
      { status: 400 },
    );
  }

  await writePaymentLog(orderId, {
    bookingId, orderId, paymentId,
    verificationStatus: 'verified', errorMessage: null,
  });

  return NextResponse.json({ verified: true });
}