export const dynamic = 'force-dynamic';

import { NextResponse }   from 'next/server';
import { getAdminAuth }   from '@/lib/firebase/admin';

/**
 * POST /api/auth/check-email
 * Body: { email: string }
 *
 * Returns { exists: boolean } — used by publicAuthStore to produce specific
 * error messages ("no account found" vs "incorrect password") after Firebase
 * returns the generic auth/invalid-credential code.
 *
 * Note: Firebase 10+ merges auth/user-not-found and auth/wrong-password into
 * auth/invalid-credential to prevent email enumeration from the client SDK.
 * This endpoint re-enables specific feedback via the Admin SDK (server-side only).
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const { email } = body ?? {};
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ message: 'email is required.' }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    await adminAuth.getUserByEmail(email);
    // Email exists — login failed due to wrong password
    return NextResponse.json({ exists: true });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return NextResponse.json({ exists: false });
    }
    // Any other Admin SDK error — fail safe (don't reveal anything)
    return NextResponse.json({ exists: null });
  }
}