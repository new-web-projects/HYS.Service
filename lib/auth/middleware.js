import { cookies }          from 'next/headers';
import { NextResponse }     from 'next/server';
import { verifyAccessToken } from './jwt';

/**
 * Extracts the raw access token from the incoming API request.
 * Checks the httpOnly cookie first, then the Authorization header.
 * @param {Request} req
 * @returns {Promise<string|null>}
 */
async function extractToken(req) {
  const cookieStore = cookies();
  return (
    cookieStore.get('access_token')?.value ??
    req.headers.get('Authorization')?.replace(/^Bearer\s+/, '') ??
    null
  );
}

/**
 * Returns the verified payload or null.
 * @param {Request} req
 * @returns {Promise<{uid:string,email:string,name:string,role:string}|null>}
 */
export async function getAuthPayload(req) {
  const token = await extractToken(req);
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * Guard for server-mode API routes.
 * Returns a NextResponse(401/403) when unauthorized; returns null when authorized.
 * Usage:
 *   const guard = await requireAuthOrRespond(req);
 *   if (guard) return guard;
 *
 * @param {Request} req
 * @param {'superadmin'|'editor'|null} requiredRole — null means any authenticated admin
 * @returns {Promise<NextResponse|null>}
 */
export async function requireAuthOrRespond(req, requiredRole = null) {
  if (process.env.NEXT_PUBLIC_BACKEND_MODE !== 'server') return null;

  const payload = await getAuthPayload(req);
  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  if (requiredRole && payload.role !== requiredRole) {
    return NextResponse.json({ message: 'Forbidden — insufficient role' }, { status: 403 });
  }
  return null;
}

/**
 * Enforces same-origin policy on all mutating requests (POST, PUT, PATCH, DELETE).
 * GET requests are unconditionally allowed (safe method).
 * @param {Request} req
 * @returns {NextResponse|null}
 */
export function enforceSameOrigin(req) {
  if (req.method === 'GET') return null;

  const origin = req.headers.get('origin');
  if (!origin) return null; // Same-origin requests do not send the Origin header

  try {
    const expectedHost = req.headers.get('host') ?? '';
    const originHost   = new URL(origin).host;
    if (originHost !== expectedHost) {
      return NextResponse.json(
        { message: 'Cross-origin requests are not allowed on admin endpoints.' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ message: 'Invalid Origin header.' }, { status: 400 });
  }

  return null;
}