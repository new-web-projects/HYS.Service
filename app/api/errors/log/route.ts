/** File Path: app/api/errors/log/route.ts */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-guard";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/log-error";

const logSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  component: z.string().max(200).optional(),
  route: z.string().max(500).optional(),
  device: z.string().max(50).optional(),
});

/**
 * Called by the client-side error boundary (app/error.tsx,
 * app/global-error.tsx) whenever a rendering error is caught. Works
 * whether or not the visitor is signed in — an error can happen on a
 * public page too, and losing the report because there's no session
 * would defeat the point.
 */
export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  // Keyed by IP-ish proxy (same pattern used for pre-auth rate limits
  // elsewhere) since an unauthenticated visitor has no user id to key on.
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed } = await rateLimit(`error-log:${forwardedFor}`, 30, 60 * 60);
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await getCurrentUser().catch(() => null);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  await logError({
    message: parsed.data.message,
    stack: parsed.data.stack,
    component: parsed.data.component,
    route: parsed.data.route,
    browser: userAgent,
    device: parsed.data.device,
    userRole: user?.role,
    userId: user?.id,
  });

  return NextResponse.json({ ok: true });
}