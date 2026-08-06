export const dynamic = 'force-dynamic';

import { NextResponse }     from 'next/server';
import { cookies }          from 'next/headers';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
}                           from '@/lib/auth/jwt';
import {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
}                           from '@/lib/rateLimit';

const MODE    = process.env.NEXT_PUBLIC_BACKEND_MODE;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Per-email brute-force registry ───────────────────────────────────────────
const _bf = new Map(); // email → { count, lockedUntil }

function getBF(email)     { return _bf.get(email) ?? { count: 0, lockedUntil: null }; }
function isLockedBF(email){ const r = getBF(email); return !!r.lockedUntil && Date.now() < r.lockedUntil; }
function remainingBF(email){ const r = getBF(email); return r.lockedUntil ? Math.max(0, r.lockedUntil - Date.now()) : 0; }
function clearBF(email)   { _bf.delete(email); }

function recordFailBF(email) {
  const r  = getBF(email);
  r.count += 1;
  if (r.count >= 5) {
    r.lockedUntil = Date.now() + 15 * 60 * 1000;
    r.count       = 0;
  }
  _bf.set(email, r);
  return getBF(email);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function setAccessCookie(response, token) {
  response.cookies.set('access_token', token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    maxAge:   15 * 60,
    path:     '/',
  });
}

function setRefreshCookie(response, token) {
  response.cookies.set('refresh_token', token, {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60,
    path:     '/',
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function handleLogin(req) {
  if (MODE !== 'server') {
    return NextResponse.json(
      { message: 'Use the Firebase client SDK for login when NEXT_PUBLIC_BACKEND_MODE=firebase.' },
      { status: 501 },
    );
  }

  // ── Per-IP rate limit check ─────────────────────────────────────────────────
  const ip        = getClientIp(req);
  const ipResult  = checkRateLimit(ip);

  if (!ipResult.allowed) {
    const retryMins = Math.ceil(ipResult.retryAfterMs / 60000);
    return NextResponse.json(
      {
        message: `Too many login attempts from your location. Try again in ${retryMins} minute(s).`,
        rateLimited: true,
      },
      {
        status: 429,
        headers: {
          'Retry-After':   String(Math.ceil(ipResult.retryAfterMs / 1000)),
          'X-RateLimit-Limit':     '5',
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 }); }

  const { email, password } = body ?? {};
  if (!email || !password) {
    return NextResponse.json({ message: 'email and password are required.' }, { status: 400 });
  }

  // ── Per-email brute-force check ─────────────────────────────────────────────
  if (isLockedBF(email)) {
    const mins = Math.ceil(remainingBF(email) / 60000);
    return NextResponse.json(
      { message: `Account locked. Try again in ${mins} minute(s).`, locked: true },
      { status: 429 },
    );
  }

  const [{ default: prisma }, { default: bcrypt }] = await Promise.all([
    import('@/lib/prisma/client'),
    import('bcrypt'),
  ]);

  const admin = await prisma.admin.findUnique({ where: { email } });

  if (!admin) {
    recordFailBF(email);
    return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);

  if (!valid) {
    const rec        = recordFailBF(email);
    const attemptsLeft = rec.lockedUntil ? 0 : 5 - rec.count;
    const lockMsg    = rec.lockedUntil
      ? ' Account locked for 15 minutes.'
      : ` ${attemptsLeft} attempt(s) remaining.`;
    return NextResponse.json(
      { message: `Invalid credentials.${lockMsg}`, locked: !!rec.lockedUntil },
      { status: 401 },
    );
  }

  // ── Success — clear both counters ───────────────────────────────────────────
  clearBF(email);
  resetRateLimit(ip);

  await prisma.admin.update({
    where: { id: admin.id },
    data:  { lastLogin: new Date() },
  });

  const tokenPayload = { uid: admin.id, email: admin.email, name: admin.name, role: admin.role };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken({ uid: admin.id }),
  ]);

  const response = NextResponse.json(
    { uid: admin.id, email: admin.email, name: admin.name, role: admin.role, accessToken },
    { headers: { 'X-RateLimit-Remaining': String(ipResult.remaining - 1) } },
  );

  setAccessCookie(response, accessToken);
  setRefreshCookie(response, refreshToken);
  return response;
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

async function handleRefresh() {
  const cookieStore  = cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'No refresh token present.' }, { status: 401 });
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    const res = NextResponse.json({ message: 'Refresh token expired or invalid.' }, { status: 401 });
    res.cookies.delete('refresh_token');
    res.cookies.delete('access_token');
    return res;
  }

  if (MODE === 'server') {
    const { default: prisma } = await import('@/lib/prisma/client');
    const admin = await prisma.admin.findUnique({ where: { id: payload.uid } });
    if (!admin) {
      return NextResponse.json({ message: 'Admin account not found.' }, { status: 401 });
    }

    const tokenPayload = { uid: admin.id, email: admin.email, name: admin.name, role: admin.role };
    const [newAccess, newRefresh] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken({ uid: admin.id }),
    ]);

    const response = NextResponse.json({ accessToken: newAccess });
    setAccessCookie(response, newAccess);
    setRefreshCookie(response, newRefresh);
    return response;
  }

  return NextResponse.json(
    { message: 'Token refresh is handled client-side in firebase mode.' },
    { status: 200 },
  );
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function handleLogout() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  response.cookies.delete('firebase_session');
  return response;
}

// ─── Session ──────────────────────────────────────────────────────────────────

async function handleSession(req) {
  const cookieStore   = cookies();
  const tokenFromCookie = cookieStore.get('access_token')?.value;
  const authHeader    = req.headers.get('Authorization') ?? '';
  const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token         = tokenFromCookie ?? tokenFromHeader;

  if (!token) return NextResponse.json(null, { status: 401 });

  const decoded = await verifyAccessToken(token);
  if (!decoded)  return NextResponse.json(null, { status: 401 });

  return NextResponse.json({
    uid:   decoded.uid,
    email: decoded.email,
    name:  decoded.name,
    role:  decoded.role,
  });
}

// ─── Route exports ────────────────────────────────────────────────────────────

export async function POST(req, { params }) {
  const action = params?.nextauth?.[0];
  if (action === 'login')   return handleLogin(req);
  if (action === 'refresh') return handleRefresh();
  if (action === 'logout')  return handleLogout();
  return NextResponse.json({ message: 'Not found.' }, { status: 404 });
}

export async function GET(req, { params }) {
  const action = params?.nextauth?.[0];
  if (action === 'session') return handleSession(req);
  return NextResponse.json({ message: 'Not found.' }, { status: 404 });
}