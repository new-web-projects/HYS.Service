import { NextResponse } from "next/server";

/**
 * Liveness check — used to verify a deploy (Codespaces / Vercel / VPS)
 * booted correctly before any real service (DB, Redis, etc.) exists.
 * Will grow to check downstream dependencies starting in Part 3.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
