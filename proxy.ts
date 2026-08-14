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
 * independently, which is what actually enforces this even where the
 * matching below is imprecise.
 *
 * Matcher is deliberately broad (everything except static assets) rather
 * than trying to encode "/customer-*" / "/worker-dashboard,worker-profile"
 * as Next.js matcher path patterns — a Part 5 re-check found the previous
 * matcher (`/customer/:path*`, `/worker-dashboard/:path*`) required a
 * trailing slash+segment, so it silently never matched the actual routes
 * this Part builds (`/customer-dashboard`, `/customer-profile`,
 * `/worker-dashboard`, `/worker-profile` with nothing after it) — proxy.ts
 * was never even invoked for them. No live security hole (requireRole()
 * still catches it, just one render later via a full redirect instead of
 * proxy.ts bouncing it early), but not what was intended either. Doing the
 * prefix check in plain JS below, where it's easy to test directly, avoids
 * repeating that mistake with matcher-syntax uncertainty.
 */
const ADMIN_PREFIX = "/admin";
const CUSTOMER_PREFIX = "/customer-";
const WORKER_PREFIX = "/worker-";

// worker- deliberately excludes /worker/[id] (Part 6: public worker
// profiles) and any other /worker/... path — only the hyphenated private
// dashboard routes are gated here.
function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith(ADMIN_PREFIX)) return true;
  if (pathname.startsWith(CUSTOMER_PREFIX)) return true;
  if (pathname.startsWith(WORKER_PREFIX)) return true;
  return false;
}

const PUBLIC_EXCEPTIONS = ["/admin/login"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isException = PUBLIC_EXCEPTIONS.includes(pathname);
  const isProtected = !isException && isProtectedPath(pathname);

  if (isProtected) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Maintenance mode: wires to Settings.maintenanceMode via a short-TTL
  // cached read (matching V1's 30s-cache, fail-open pattern) once Part 6+
  // has a Settings-reading endpoint to call — not implemented yet, noted
  // here rather than silently absent.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
