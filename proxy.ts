import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js 16 renamed middleware.ts to proxy.ts and moved it off the Edge
 * Runtime by default — a direct response to CVE-2025-29927, where
 * Edge-Runtime middleware authorization could be bypassed under load. The
 * framework's own guidance that came with the rename: keep this layer to
 * routing/redirects, and do the real, DB-backed authorization check in the
 * route/Server Component itself (lib/auth-guard.ts), not here.
 *
 * So this only checks whether a session cookie exists at all — enough to
 * bounce an obviously-signed-out visitor before a page even renders — and
 * checks maintenance mode. It is never the last word on who's allowed in;
 * every protected page and API route calls requireUser()/requireRole()
 * independently.
 */
const ADMIN_PREFIX = "/admin";
const CUSTOMER_PREFIX = "/customer";
const WORKER_PREFIX = "/worker-dashboard";

const PROTECTED_PREFIXES = [ADMIN_PREFIX, CUSTOMER_PREFIX, WORKER_PREFIX];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (isProtected) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Maintenance mode: Part 5 wires this to Settings.maintenanceMode via a
  // short-TTL cached read (matching V1's 30s-cache, fail-open pattern) —
  // not implemented yet since there's no Settings-reading endpoint until
  // then, noted here rather than silently absent.

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/customer/:path*", "/worker-dashboard/:path*"],
};
