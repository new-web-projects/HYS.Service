import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await prisma.workerProfile.findUnique({
    where: { userId: id },
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { id: true, name: true } },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }

  // Deliberately no phone/email here — V1 only reveals contact details to
  // each side after payment (confirmed in the Part 1 audit), and nothing
  // about that decision changed just because this is a new endpoint.
  return NextResponse.json({
    worker: {
      id,
      name: profile.user.name,
      image: profile.user.image,
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
      city: profile.city,
    },
  });
}
