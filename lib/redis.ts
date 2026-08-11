import Redis from "ioredis";
import { env } from "./env";

/**
 * ioredis over node-redis mainly because Part 7's Socket.IO scaling needs a
 * pub/sub-capable client and this is the more common pairing with
 * @socket.io/redis-adapter. Nothing in the app uses this yet — Part 4 adds
 * rate limiting, Part 7 adds pub/sub and presence.
 *
 * Same globalThis-cache reasoning as lib/prisma.ts: avoid opening a new
 * connection on every dev hot-reload.
 */
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient() {
  return new Redis(env.REDIS_URL, {
    // Fail fast in serverless rather than hanging a request on a dead pool.
    maxRetriesPerRequest: 3,
    // Found via an actual `npm run build`: without this, module load alone
    // (e.g. any route that imports lib/rate-limit.ts) opens a connection
    // during Next's build-time page-data collection, not just at request
    // time — noisy ECONNREFUSED logs in any CI that builds without Redis
    // running. Defers the real connection to the first command instead.
    lazyConnect: true,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
