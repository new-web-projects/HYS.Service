/**
 * Tiers as confirmed in the Part 1 audit (§11) from V1's actual
 * lib/location.js: 0% within 5km, 5% 5–15km, 10% 15–30km, 20% beyond 30km.
 * Ported exactly rather than reconstructed, since this one was read and
 * recorded with real confidence — unlike the city-detection bounding boxes
 * (lib/distance.ts / lib/geolocation.ts), which weren't.
 *
 * Not wired into an actual booking price yet — there's no booking to price
 * until Part 7. This is the pure calculation, ready for that Part to call.
 */
const SURCHARGE_TIERS = [
  { maxKm: 5, percent: 0 },
  { maxKm: 15, percent: 5 },
  { maxKm: 30, percent: 10 },
  { maxKm: Infinity, percent: 20 },
] as const;

export function distanceSurchargePercent(distanceKm: number): number {
  const tier = SURCHARGE_TIERS.find((t) => distanceKm <= t.maxKm);
  return tier?.percent ?? SURCHARGE_TIERS[SURCHARGE_TIERS.length - 1].percent;
}

export function applyDistanceSurcharge(basePrice: number, distanceKm: number): number {
  const percent = distanceSurchargePercent(distanceKm);
  return Math.round(basePrice * (1 + percent / 100) * 100) / 100;
}
