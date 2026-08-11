import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/generated/prisma/client";

/**
 * Why this exists instead of trusting proxy.ts: CVE-2025-29927 showed
 * Edge-Runtime middleware auth checks could be bypassed under load, which
 * is exactly why Next.js 16 replaced middleware.ts with proxy.ts and
 * pushed real authorization down to the route/Server Component layer (see
 * proxy.ts's own comment). proxy.ts here only redirects requests with no
 * session cookie at all — every protected Server Component and API route
 * calls one of these functions itself for the real, DB-backed check. That
 * repetition is the point, not an oversight.
 *
 * The `as Role` cast below is the one boundary where Better Auth's own
 * field typing (it only knows role as a generic string, via
 * additionalFields — see auth.ts) becomes this app's real Prisma `Role`
 * enum. Safe because this app only ever writes one of the four enum
 * values there; everywhere else in the codebase uses the real enum type.
 */
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return { ...session.user, role: session.user.role as Role };
}

/** For Server Components / pages — redirects on failure. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}

export async function requireRole(allowed: Role | Role[]) {
  const user = await requireUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** For Route Handlers — returns a Response instead of redirecting. */
export async function requireUserApi() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { user, response: null } as const;
}

export async function requireRoleApi(allowed: Role | Role[]) {
  const { user, response } = await requireUserApi();
  if (response) return { user: null, response };
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  return { user, response: null } as const;
}
