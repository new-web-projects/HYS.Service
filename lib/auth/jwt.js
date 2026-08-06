import { SignJWT, jwtVerify } from 'jose';

// Lazy secret getters — do NOT call at module load time so firebase mode
// can safely import this file without JWT_* env vars being set.
function accessSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured in .env.local');
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

function refreshSecret() {
  if (!process.env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not configured in .env.local');
  return new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
}

/**
 * Signs a short-lived access token (15 minutes).
 * @param {{ uid: string, email: string, name: string, role: string }} payload
 * @returns {Promise<string>}
 */
export async function signAccessToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessSecret());
}

/**
 * Signs a long-lived refresh token (7 days).
 * @param {{ uid: string }} payload
 * @returns {Promise<string>}
 */
export async function signRefreshToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(refreshSecret());
}

/**
 * Verifies an access token. Returns decoded payload or null on failure.
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies a refresh token. Returns decoded payload or null on failure.
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
export async function verifyRefreshToken(token) {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    return payload;
  } catch {
    return null;
  }
}