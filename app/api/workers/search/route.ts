import { prisma } from "@/lib/prisma";
import { haversineDistanceKm, boundingBox } from "@/lib/distance";

export type WorkerSearchParams = {
  q?: string;
  categoryId?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  minRating?: number;
  maxStartingPrice?: number;
  minExperienceYears?: number;
  verifiedOnly?: boolean;
  availableOnly?: boolean;
};

const DEFAULT_SEARCH_RADIUS_KM = 50;

/** Matches the exact `select`/`include` shape of the query below — typed
 * explicitly rather than inferred, since the inferred type otherwise comes
 * from whatever `@prisma/client` generates, which doesn't exist as a
 * concrete type until `prisma generate` has actually run. */
type Candidate = {
  userId: string;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  reviewCount: number;
  isAvailable: boolean;
  isVerified: boolean;
  startingPrice: number;
  experienceYears: number;
  city: string | null;
  skills: string[];
  user: { id: string; name: string; image: string | null };
  category: { id: string; name: string };
};


/**
 * Ranking, since the spec asks for "intelligent" ranking without pinning
 * down exact weights: available workers always sort before unavailable
 * ones (an unavailable worker can't actually be booked, so burying them
 * entirely by default would hide real profiles, but ranking them above a
 * bookable one would be actively unhelpful) — badged clearly on the card
 * instead of hidden by default. The spec separately lists "Availability"
 * as one of the Service Page's explicit filters, alongside rating/price/
 * experience/verification — `availableOnly` is that: an opt-in hard
 * filter for a customer who specifically wants to hide unavailable workers
 * rather than just see them ranked lower. Within each availability tier:
 * if the customer has a location, distance leads (70%) with rating
 * breaking ties (30%) — "how far is the nearest good option" is what a
 * location-based search is fundamentally answering; without a location,
 * rating leads with review count as the tiebreaker (an established 4.8
 * beats a brand-new unrated profile). This is a documented, reasonable
 * heuristic, not a claim of one precise correct formula — the spec doesn't
 * specify exact weights either.
 */
export async function searchWorkers(params: WorkerSearchParams) {
  const hasLocation = params.latitude !== undefined && params.longitude !== undefined;
  const radiusKm = params.maxDistanceKm ?? DEFAULT_SEARCH_RADIUS_KM;

  const box =
    hasLocation && params.latitude !== undefined && params.longitude !== undefined
      ? boundingBox({ latitude: params.latitude, longitude: params.longitude }, radiusKm)
      : null;

  const candidates = (await prisma.workerProfile.findMany({
    where: {
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.minRating !== undefined && { rating: { gte: params.minRating } }),
      ...(params.maxStartingPrice !== undefined && { startingPrice: { lte: params.maxStartingPrice } }),
      ...(params.minExperienceYears !== undefined && { experienceYears: { gte: params.minExperienceYears } }),
      ...(params.verifiedOnly && { isVerified: true }),
      ...(params.availableOnly && { isAvailable: true }),
      ...(box && {
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      }),
      ...(params.q && {
        OR: [
          { user: { name: { contains: params.q, mode: "insensitive" } } },
          { skills: { has: params.q } },
          { bio: { contains: params.q, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      user: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true } },
    },
    take: 200, // candidate pool before ranking/pagination — plenty at current scale
  })) as Candidate[];

  const withDistance = candidates.map((worker: Candidate) => {
    const distanceKm =
      hasLocation && worker.latitude !== null && worker.longitude !== null && params.latitude !== undefined && params.longitude !== undefined
        ? haversineDistanceKm(
            { latitude: params.latitude, longitude: params.longitude },
            { latitude: Number(worker.latitude), longitude: Number(worker.longitude) },
          )
        : null;
    return { ...worker, distanceKm };
  });

  // Exact-radius filter — the bounding box above is a rectangle, not a
  // circle, so it can admit corner cases slightly outside the real radius.
  const withinRadius = hasLocation
    ? withDistance.filter((w: (typeof withDistance)[number]) => w.distanceKm === null || w.distanceKm <= radiusKm)
    : withDistance;

  const ratingScore = (rating: number) => Number(rating) / 5;
  const distanceScore = (distanceKm: number) => Math.max(0, 1 - distanceKm / radiusKm);

  const ranked = withinRadius.sort((a: (typeof withDistance)[number], b: (typeof withDistance)[number]) => {
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;

    if (hasLocation && a.distanceKm !== null && b.distanceKm !== null) {
      const scoreA = distanceScore(a.distanceKm) * 0.7 + ratingScore(Number(a.rating)) * 0.3;
      const scoreB = distanceScore(b.distanceKm) * 0.7 + ratingScore(Number(b.rating)) * 0.3;
      return scoreB - scoreA;
    }

    if (Number(a.rating) !== Number(b.rating)) return Number(b.rating) - Number(a.rating);
    return b.reviewCount - a.reviewCount;
  });

  return ranked;
}
