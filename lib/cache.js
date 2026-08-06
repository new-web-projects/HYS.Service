/**
 * Simple in-memory cache for server-side reads.
 *
 * WHY: Next.js server components run fresh on every request. Without caching,
 * the public layout reads `settings/global` from Firestore on EVERY page visit.
 * With a 60-second TTL, the same Firestore read is reused for all requests
 * within that window — reducing costs and latency.
 *
 * This cache lives in the Node.js module scope, so it persists across
 * requests within the same serverless function instance.
 *
 * For Vercel deployments: each Edge/Serverless instance has its own cache.
 * The TTL ensures stale data is never shown for more than `ttlMs`.
 */

/** @type {Map<string, { value: any, expiresAt: number }>} */
const store = new Map();

/**
 * Gets a cached value or calls `fetcher()` to populate it.
 *
 * @template T
 * @param {string}         key     - Cache key
 * @param {function(): Promise<T>} fetcher - Async function to populate the cache
 * @param {number}         [ttlMs=60000]  - Time-to-live in milliseconds
 * @returns {Promise<T>}
 */
export async function cached(key, fetcher, ttlMs = 60_000) {
  const existing = store.get(key);

  if (existing && Date.now() < existing.expiresAt) {
    return existing.value;
  }

  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/**
 * Invalidates a specific cache key.
 * Call this after settings are updated so the next request gets fresh data.
 *
 * @param {string} key
 */
export function invalidateCache(key) {
  store.delete(key);
}

/**
 * Invalidates all cache entries.
 * Call this after major data changes.
 */
export function invalidateAll() {
  store.clear();
}

/**
 * Pre-built cache helpers for the most common reads.
 */
export const AppCache = {
  /**
   * Cache key for site settings.
   * TTL: 60 seconds — settings rarely change but we want changes to
   * appear within a minute without requiring a redeploy.
   */
  SETTINGS:    'settings:global',
  SETTINGS_TTL: 60_000,

  /**
   * Cache key for active categories list.
   * TTL: 120 seconds — categories change only when admin adds/removes them.
   */
  CATEGORIES:     'categories:active',
  CATEGORIES_TTL: 120_000,

  /**
   * Cache key for public pages list (isPublished + not deleted).
   * TTL: 30 seconds — pages update more frequently.
   */
  PUBLIC_PAGES:     'pages:published',
  PUBLIC_PAGES_TTL: 30_000,
};