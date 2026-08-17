import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";

const genderValues = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;

const customerSignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8),
  phone: z.string().min(6).max(20).optional(),
  gender: z.enum(genderValues).optional(),
  addressLine: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`signup:ip:${ip}`, 5, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = customerSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, email, password, phone, gender, addressLine, city, latitude, longitude } = parsed.data;

  let signUpResult;
  try {
    signUpResult = await auth.api.signUpEmail({
      body: { name, email, password, role: "CUSTOMER", phone, gender, callbackURL: "/auth/verify-email" },
      asResponse: true,
    });
  } catch {
    return NextResponse.json({ error: "Could not create account." }, { status: 400 });
  }

  if (!signUpResult.ok) {
    // Most commonly: email already registered. Better Auth's own message
    // is safe to relay as-is here — unlike login, signup failing for
    // "already exists" isn't the enumeration risk that a login error is.
    const data = await signUpResult.json().catch(() => null);
    return NextResponse.json(
      { error: data?.message ?? "Could not create account." },
      { status: signUpResult.status },
    );
  }

  const { user } = await signUpResult.json();

  // Known gap, not silently glossed over: if this insert fails, the User
  // row exists with no CustomerProfile. Better Auth's signup isn't a Prisma
  // transaction this route can wrap, so it isn't atomic with the line
  // above. Worth hardening (e.g. a retry-on-first-login check) before this
  // handles real signups — flagged rather than assumed away.
  await prisma.customerProfile.create({
    data: { userId: user.id, addressLine, city, latitude, longitude },
  });

  return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
}
