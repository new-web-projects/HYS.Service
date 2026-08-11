import { redis } from "@/lib/redis";

/**
 * Fixed-window counter. Good enough for auth endpoints (V1 used the same
 * shape, just in-process); reach for something fancier only if a specific
 * endpoint needs smoother limiting than a fixed window gives.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const count = await redis.incr(`ratelimit:${key}`);
  if (count === 1) {
    await redis.expire(`ratelimit:${key}`, windowSeconds);
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_LOCK_SECONDS = 15 * 60; // matches V1's 15-minute lock

/** identifier is normally the lowercased email being logged into. */
export async function isLockedOut(identifier: string) {
  const attempts = await redis.get(`bruteforce:${identifier}`);
  return attempts !== null && Number(attempts) >= BRUTE_FORCE_MAX_ATTEMPTS;
}

export async function recordFailedLogin(identifier: string) {
  const key = `bruteforce:${identifier}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, BRUTE_FORCE_LOCK_SECONDS);
  }
  return attempts;
}

export async function clearFailedLogins(identifier: string) {
  await redis.del(`bruteforce:${identifier}`);
}
