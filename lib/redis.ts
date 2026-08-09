import Redis from "ioredis";

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
  if (!process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is not set. Copy .env.example to .env.local and fill it in " +
        "(see the Part 3 README section for a local Redis option).",
    );
  }
  return new Redis(process.env.REDIS_URL, {
    // Fail fast in serverless rather than hanging a request on a dead pool.
    maxRetriesPerRequest: 3,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
