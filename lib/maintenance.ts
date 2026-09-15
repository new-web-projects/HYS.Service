import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const CACHE_KEY = "settings:maintenance";
const CACHE_TTL_SECONDS = 30; // matches V1's 30s-cache, fail-open pattern (Part 1 audit)

export type MaintenanceStatus = { enabled: boolean; message: string | null };

/**
 * Read side of maintenance mode, called from proxy.ts on every request to
 * a non-admin, non-API route. Redis-cached so a maintenance check never
 * costs a Postgres round trip per request; falls open (site stays up) on
 * any Redis or Postgres error, since a broken maintenance check should
 * never itself take the site down — same reasoning V1 used.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as MaintenanceStatus;
  } catch {
    // fall through to a direct DB read
  }

  try {
    const settings = await prisma.settings.findUnique({ where: { id: "global" } });
    const status: MaintenanceStatus = {
      enabled: settings?.maintenanceMode ?? false,
      message: settings?.maintenanceMessage ?? null,
    };
    await refreshMaintenanceCache(status).catch(() => {});
    return status;
  } catch {
    return { enabled: false, message: null }; // fail open
  }
}

/** Called immediately after an admin updates Settings, so the cache never
 * serves a stale maintenance state for its own TTL window. */
export async function refreshMaintenanceCache(status: MaintenanceStatus): Promise<void> {
  await redis.set(CACHE_KEY, JSON.stringify(status), "EX", CACHE_TTL_SECONDS);
}