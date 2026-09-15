import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/**
 * Viewing whatever's in ErrorLog today — nothing writes to this table
 * yet (the actual capture mechanism, with stack traces/browser/device
 * context, is Part 12's "Error Reveal + Logging + Monitoring" per the
 * master prompt's own Part breakdown). Building the view now, ahead of
 * the writer, mirrors the same pattern already used for withdrawals in
 * Part 9 and payment-gateway settings in Part 8.
 */
export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const logs = await prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ logs });
}