import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Prisma 7 requires a driver adapter — there's no bare `new PrismaClient()`
 * anymore. The adapter runs queries through `pg`'s own connection pool
 * rather than a bundled native query-engine binary, which is both what
 * Prisma 7 requires and independently the right shape for Vercel's
 * serverless functions (no platform-specific binary to bundle).
 *
 * DATABASE_URL should be the *pooled* connection string in production
 * (PgBouncer or your provider's pooler) — see .env.example. This is
 * deliberately separate from prisma.config.ts's DIRECT_URL, which only
 * `prisma migrate` uses.
 *
 * The globalThis cache prevents `next dev`'s hot-reload from opening a new
 * connection pool on every file save.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
