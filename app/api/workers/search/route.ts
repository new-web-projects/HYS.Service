import { NextResponse } from "next/server";
import { z } from "zod";
import { searchWorkers } from "@/lib/worker-search";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  categoryId: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxStartingPrice: z.coerce.number().positive().optional(),
  minExperienceYears: z.coerce.number().int().min(0).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  availableOnly: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search parameters." }, { status: 400 });
  }

  const results = await searchWorkers(parsed.data);

  return NextResponse.json({
    workers: results.map((w) => ({
      id: w.userId,
      name: w.user.name,
      image: w.user.image,
      category: w.category,
      startingPrice: w.startingPrice,
      experienceYears: w.experienceYears,
      rating: w.rating,
      reviewCount: w.reviewCount,
      isAvailable: w.isAvailable,
      isVerified: w.isVerified,
      city: w.city,
      distanceKm: w.distanceKm,
      skills: w.skills,
    })),
  });
}
