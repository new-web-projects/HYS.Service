/**
 * Location utilities — HYS Services marketplace
 *
 * Exports:
 *   haversineDistance(lat1, lng1, lat2, lng2) → number (km)
 *   getCurrentPosition()                       → Promise<{ lat, lng, accuracy }>
 *   sortWorkersByDistance(workers, lat, lng)   → workers[] with distance attached
 *   calculateDistancePricing(distanceKm, basePrice) → { finalPrice, surchargePercent, surchargeAmount }
 *   formatDistance(km)                         → string
 *   detectCity(lat, lng)                       → string | null
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/**
 * Travel surcharge tiers applied on top of the worker's base price.
 * Within 5 km → no surcharge.
 * 5–15 km    → 5%
 * 15–30 km   → 10%
 * 30 km+     → 20%
 */
const SURCHARGE_TIERS = [
  { maxKm: 5,        surchargePercent: 0  },
  { maxKm: 15,       surchargePercent: 5  },
  { maxKm: 30,       surchargePercent: 10 },
  { maxKm: Infinity, surchargePercent: 20 },
];

// ─── Haversine distance ───────────────────────────────────────────────────────

/**
 * Calculates the great-circle distance between two GPS coordinates.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in kilometres
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

/**
 * Promisified wrapper around browser geolocation API.
 * Surfaces user-friendly error messages for all failure modes.
 *
 * @returns {Promise<{ lat: number, lng: number, accuracy: number }>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        switch (err.code) {
          case 1: // PERMISSION_DENIED
            reject(
              new Error(
                'Location access denied. Please allow location in your browser settings.',
              ),
            );
            break;
          case 2: // POSITION_UNAVAILABLE
            reject(
              new Error(
                'Your location is currently unavailable. Please enter it manually.',
              ),
            );
            break;
          case 3: // TIMEOUT
            reject(
              new Error('Location detection timed out. Please try again.'),
            );
            break;
          default:
            reject(new Error('Failed to detect location. Please enter it manually.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout:            10_000, // 10 seconds
        maximumAge:         60_000, // Use cached position for up to 60 seconds
      },
    );
  });
}

// ─── Distance sorting ─────────────────────────────────────────────────────────

/**
 * Attaches a `distance` field (km) to each worker and sorts by nearest first.
 * Workers without a stored location get distance = Infinity and sort last.
 *
 * @param {Array<object>} workers — worker objects from Firestore
 * @param {number}        userLat
 * @param {number}        userLng
 * @returns {Array<object>} New array — original objects NOT mutated
 */
export function sortWorkersByDistance(workers, userLat, userLng) {
  if (!userLat || !userLng || !Array.isArray(workers)) {
    return (workers ?? []).map((w) => ({ ...w, distance: Infinity }));
  }

  return workers
    .map((w) => {
      const lat = w.location?.lat;
      const lng = w.location?.lng;

      const distance =
        lat != null && lng != null
          ? haversineDistance(userLat, userLng, Number(lat), Number(lng))
          : Infinity;

      return { ...w, distance };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}

// ─── Distance-based pricing ───────────────────────────────────────────────────

/**
 * Calculates a travel surcharge based on the worker's distance from the customer.
 *
 * @param {number} distanceKm
 * @param {number} basePrice   — Worker's base starting price
 * @returns {{
 *   finalPrice:       number,
 *   surchargePercent: number,
 *   surchargeAmount:  number,
 * }}
 */
export function calculateDistancePricing(distanceKm, basePrice) {
  const base = parseFloat(basePrice) || 0;

  if (!isFinite(distanceKm) || distanceKm <= 0 || base <= 0) {
    return { finalPrice: base, surchargePercent: 0, surchargeAmount: 0 };
  }

  const tier             = SURCHARGE_TIERS.find((t) => distanceKm <= t.maxKm);
  const surchargePercent = tier?.surchargePercent ?? 0;
  const surchargeAmount  = parseFloat((base * surchargePercent / 100).toFixed(2));
  const finalPrice       = parseFloat((base + surchargeAmount).toFixed(2));

  return { finalPrice, surchargePercent, surchargeAmount };
}

// ─── Format distance ──────────────────────────────────────────────────────────

/**
 * Returns a human-readable distance string.
 *
 * @param {number} km
 * @returns {string}  e.g. "Nearby", "850 m", "3.2 km", "45 km"
 */
export function formatDistance(km) {
  if (km == null || !isFinite(km) || km === Infinity) return '';
  if (km <= 0)   return 'Nearby';
  if (km < 0.1)  return 'Nearby';
  if (km < 1)    return `${Math.round(km * 1000)} m`;
  if (km < 10)   return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// ─── City detection ───────────────────────────────────────────────────────────

const CITY_REGISTRY = [
  { name: 'Bangalore',  bounds: { minLat: 12.70, maxLat: 13.20, minLng: 77.40, maxLng: 77.90 } },
  { name: 'Mumbai',     bounds: { minLat: 18.80, maxLat: 19.40, minLng: 72.70, maxLng: 73.10 } },
  { name: 'Delhi',      bounds: { minLat: 28.40, maxLat: 28.90, minLng: 76.80, maxLng: 77.50 } },
  { name: 'Chennai',    bounds: { minLat: 12.80, maxLat: 13.30, minLng: 80.10, maxLng: 80.50 } },
  { name: 'Hyderabad',  bounds: { minLat: 17.20, maxLat: 17.70, minLng: 78.20, maxLng: 78.70 } },
  { name: 'Kolkata',    bounds: { minLat: 22.40, maxLat: 22.80, minLng: 88.20, maxLng: 88.50 } },
  { name: 'Pune',       bounds: { minLat: 18.40, maxLat: 18.70, minLng: 73.70, maxLng: 74.00 } },
  { name: 'Ahmedabad',  bounds: { minLat: 22.90, maxLat: 23.20, minLng: 72.40, maxLng: 72.70 } },
  { name: 'Jaipur',     bounds: { minLat: 26.70, maxLat: 27.00, minLng: 75.60, maxLng: 76.00 } },
  { name: 'Surat',      bounds: { minLat: 21.00, maxLat: 21.30, minLng: 72.70, maxLng: 73.00 } },
];

/**
 * Detects which city the coordinates fall in using bounding box matching.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string | null}
 */
export function detectCity(lat, lng) {
  const match = CITY_REGISTRY.find(
    ({ bounds: b }) =>
      lat >= b.minLat && lat <= b.maxLat &&
      lng >= b.minLng && lng <= b.maxLng,
  );
  return match?.name ?? null;
}