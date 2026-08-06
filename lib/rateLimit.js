/**
 * Per-IP rate limiter using a sliding window.
 *
 * Limitations:
 * - In-process memory only — resets on server restart and does not
 *   synchronise across multiple Node.js instances.
 * - For multi-region or multi-instance deployments, replace _store with
 *   a Redis-backed store (e.g. @upstash/ratelimit).
 */

const WINDOW_MS  = 15 * 60 * 1000;  // 15 minutes
const MAX_HIT    = 5;                // max requests per window

/**
 * Map<ip: string, timestamps: number[]>
 * Stores the timestamps (epoch ms) of each request within the current window.
 */
const _store = new Map();

/**
 * Periodically prune stale entries so the Map doesn't grow unbounded.
 * Runs every 5 minutes on any server that imports this module.
 */
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, timestamps] of _store.entries()) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      _store.delete(ip);
    } else {
      _store.set(ip, fresh);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extracts the best available client IP from a Next.js Route Handler request.
 * Respects the X-Forwarded-For header set by Vercel and Nginx.
 *
 * @param {Request} req
 * @returns {string}
 */
export function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Fallback for local development (no proxy)
  return '127.0.0.1';
}

/**
 * Checks whether the given IP has exceeded the rate limit.
 * Records the current request timestamp in the sliding window.
 *
 * @param {string} ip
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkRateLimit(ip) {
  const now    = Date.now();
  const cutoff = now - WINDOW_MS;

  // Get or create the timestamp array for this IP
  const timestamps = (_store.get(ip) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= MAX_HIT) {
    // Oldest timestamp in window determines when the window resets
    const oldestInWindow = Math.min(...timestamps);
    const retryAfterMs   = oldestInWindow + WINDOW_MS - now;
    return {
      allowed:      false,
      remaining:    0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Record this request
  timestamps.push(now);
  _store.set(ip, timestamps);

  return {
    allowed:      true,
    remaining:    MAX_HIT - timestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * Resets the rate limit record for a given IP.
 * Call this after a successful login to clear the counter.
 *
 * @param {string} ip
 */
export function resetRateLimit(ip) {
  _store.delete(ip);
}