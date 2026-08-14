import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleApi } from "@/lib/auth-guard";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { workerProfileCompletion } from "@/lib/profile-completion";

const genderValues = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;
const documentTypeValues = ["AADHAAR", "PAN", "WORK_ID"] as const;

const updateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    phone: z.string().min(6).max(20).optional(),
    gender: z.enum(genderValues).optional(),
    bio: z.string().max(500).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    experienceDesc: z.string().max(1000).optional(),
    startingPrice: z.number().positive().optional(),
    skills: z.array(z.string().min(1).max(40)).max(20).optional(),
    addressLine: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    documentType: z.enum(documentTypeValues).optional(),
    categoryId: z.string().optional(),
    newCategoryName: z.string().min(2).max(60).optional(),
  })
  .refine((v) => !(v.categoryId && v.newCategoryName), {
    message: "Provide either categoryId or newCategoryName, not both.",
  });

export async function GET() {
  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const profile = await prisma.workerProfile.findUnique({
    where: { userId: user.id },
    include: { category: { select: { id: true, name: true, isApproved: true } } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Worker profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      category: profile.category,
      bio: profile.bio,
      experienceYears: profile.experienceYears,
      experienceDesc: profile.experienceDesc,
      startingPrice: profile.startingPrice,
      skills: profile.skills,
      isAvailable: profile.isAvailable,
      isVerified: profile.isVerified,
      rating: profile.rating,
      reviewCount: profile.reviewCount,
      ordersCompleted: profile.ordersCompleted,
      addressLine: profile.addressLine,
      city: profile.city,
      latitude: profile.latitude,
      longitude: profile.longitude,
      documentType: profile.documentType,
      documentVerifiedAt: profile.documentVerifiedAt,
    },
    completion: workerProfileCompletion({
      phone: user.phone,
      gender: user.gender,
      bio: profile.bio,
      experienceDesc: profile.experienceDesc,
      addressLine: profile.addressLine,
      city: profile.city,
      isVerified: profile.isVerified,
      skills: profile.skills,
    }),
  });
}

export async function PATCH(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, phone, gender, categoryId, newCategoryName, ...profileFields } = parsed.data;

  try {
    await prisma.$transaction(async (tx: typeof prisma) => {
      if (name || phone || gender) {
        await tx.user.update({
          where: { id: user.id },
          data: { ...(name && { name }), ...(phone && { phone }), ...(gender && { gender }) },
        });
      }

      let resolvedCategoryId = categoryId;
      if (newCategoryName) {
        // Same "create the real row immediately, unapproved" pattern as
        // worker signup — see that route's comment for why, instead of
        // V1's temporary-ID reconciliation.
        const slug = newCategoryName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const category = await tx.category.create({
          data: {
            name: newCategoryName,
            slug: `${slug}-${user.id.slice(0, 6)}`,
            isApproved: false,
            submittedById: user.id,
          },
        });
        resolvedCategoryId = category.id;
      }

      await tx.workerProfile.update({
        where: { userId: user.id },
        data: {
          ...profileFields,
          ...(resolvedCategoryId && { categoryId: resolvedCategoryId }),
        },
      });
    });
  } catch {
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
