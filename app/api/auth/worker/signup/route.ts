import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const genderValues = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;

const workerSignupSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.email(),
    password: z.string().min(8),
    phone: z.string().min(6).max(20).optional(),
    gender: z.enum(genderValues).optional(),
    categoryId: z.string().optional(),
    newCategoryName: z.string().min(2).max(60).optional(),
    experienceYears: z.number().int().min(0).max(60).default(0),
    startingPrice: z.number().positive(),
    bio: z.string().max(500).optional(),
  })
  // Exactly one of categoryId / newCategoryName — "existing" vs. "Other".
  .refine((v) => Boolean(v.categoryId) !== Boolean(v.newCategoryName), {
    message: "Select an existing category or provide a new one, not both.",
  });

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`signup:ip:${ip}`, 5, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = workerSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, email, password, phone, gender, categoryId, newCategoryName, experienceYears, startingPrice, bio } =
    parsed.data;

  let signUpResult;
  try {
    signUpResult = await auth.api.signUpEmail({
      body: { name, email, password, role: "WORKER", phone, gender },
      asResponse: true,
    });
  } catch {
    return NextResponse.json({ error: "Could not create account." }, { status: 400 });
  }

  if (!signUpResult.ok) {
    const data = await signUpResult.json().catch(() => null);
    return NextResponse.json(
      { error: data?.message ?? "Could not create account." },
      { status: signUpResult.status },
    );
  }

  const { user } = await signUpResult.json();

  // Same non-atomicity caveat as customer signup — see that route's
  // comment. This part (category resolution + profile row) at least runs
  // as one Prisma transaction, so it can't half-succeed on its own.
  try {
    await prisma.$transaction(async (tx: typeof prisma) => {
      let resolvedCategoryId = categoryId;

      if (newCategoryName) {
        // V1 gave a worker a temporary "pending-{timestamp}" categoryId
        // here and reconciled it later when an admin approved the name —
        // fragile, and the reconciliation step was never found in the V1
        // audit. This creates the real row immediately (unapproved), so
        // WorkerProfile.categoryId is always a valid FK from the start —
        // no reconciliation step to lose track of.
        const slug = newCategoryName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const category = await tx.category.create({
          data: {
            name: newCategoryName,
            slug: `${slug}-${user.id.slice(0, 6)}`, // avoid slug collisions between two workers proposing similar names
            isApproved: false,
            submittedById: user.id,
          },
        });
        resolvedCategoryId = category.id;
      }

      await tx.workerProfile.create({
        data: {
          userId: user.id,
          categoryId: resolvedCategoryId!,
          experienceYears,
          startingPrice,
          bio,
        },
      });
    });
  } catch {
    return NextResponse.json(
      { error: "Account created, but the profile could not be saved. Contact support." },
      { status: 500 },
    );
  }

  return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
}
