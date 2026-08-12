import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit, isLockedOut, recordFailedLogin, clearFailedLogins } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Per-IP: 5 attempts / 15 min, independent of the per-email lock below —
  // matches V1's two separate protections (lib/rateLimit.js + the
  // brute-force Map in the old admin login route).
  const ipLimit = await rateLimit(`login:ip:${ip}`, 5, 15 * 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const identifier = email.toLowerCase();

  if (await isLockedOut(identifier)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in 15 minutes." },
      { status: 423 },
    );
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
      asResponse: true,
    });

    if (!result.ok) {
      await recordFailedLogin(identifier);
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    await clearFailedLogins(identifier);
    return result;
  } catch {
    await recordFailedLogin(identifier);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
}
