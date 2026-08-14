import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleApi } from "@/lib/auth-guard";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { customerProfileCompletion } from "@/lib/profile-completion";

const genderValues = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(6).max(20).optional(),
  gender: z.enum(genderValues).optional(),
  addressLine: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function GET() {
  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    profile: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      addressLine: profile?.addressLine ?? null,
      city: profile?.city ?? null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
    },
    completion: customerProfileCompletion({
      phone: user.phone,
      gender: user.gender,
      addressLine: profile?.addressLine ?? null,
      city: profile?.city ?? null,
    }),
  });
}

export async function PATCH(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { name, phone, gender, ...locationFields } = parsed.data;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { ...(name && { name }), ...(phone && { phone }), ...(gender && { gender }) },
    }),
    prisma.customerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...locationFields },
      update: locationFields,
    }),
  ]);

  return NextResponse.json({ ok: true });
}
