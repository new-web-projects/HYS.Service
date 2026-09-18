/** File Path: app/api/errors/reveal-status/route.ts */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { getSettings } from "@/lib/settings";

/**
 * Returns only a boolean, never the raw setting — a non-admin should
 * never learn whether error-reveal is on or off, only whether *they*
 * get to see detail (they never do, admin role is required either way).
 */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ reveal: false });
  }
  const settings = await getSettings();
  return NextResponse.json({ reveal: settings.errorRevealEnabled });
}