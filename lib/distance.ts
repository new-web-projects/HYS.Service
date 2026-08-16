const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * A rough lat/lng bounding box around a point, for a cheap indexed
 * pre-filter before the exact Haversine calculation — same "Phase 1"
 * approach the Part 1 audit found and endorsed in V1 (client-side there;
 * here it's a DB-level pre-filter, matching the recommendation in that
 * audit's §11 that Postgres gets this for free without V1's staged
 * Firestore-specific migration plan). Good enough at the worker density
 * this app is built for today; a real PostGIS geography column is the
 * upgrade path if that changes, not something worth setting up speculatively
 * now.
 */
export function boundingBox(center: { latitude: number; longitude: number }, radiusKm: number) {
  const latDelta = radiusKm / 111; // ~111km per degree of latitude, everywhere
  const lngDelta = radiusKm / (111 * Math.cos(toRadians(center.latitude)) || 1);

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}
