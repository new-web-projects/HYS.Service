/**
 * Multi-Location Expansion Structure
 *
 * CURRENT STATE: Single-city / single-region operation.
 * Clients find workers using client-side Haversine distance calculation.
 *
 * EXPANSION PATH:
 * Phase 1 (0–500 workers):   Current — client-side Haversine ✅
 * Phase 2 (500–10K workers): GeoHash server-side filtering (see below)
 * Phase 3 (10K+ workers):    Sharded collections by city/region
 *
 * This file provides the data structures and helpers for Phases 2 and 3
 * so they can be activated without breaking existing functionality.
 */

// ─── City/Region Registry ─────────────────────────────────────────────────────

/**
 * Registry of supported cities/regions.
 * Add new cities here as the platform expands.
 * Each city has a human name, a lat/lng center, and a search radius.
 *
 * @type {Record<string, {
 *   name:       string,
 *   lat:        number,
 *   lng:        number,
 *   radiusKm:   number,
 *   currency:   string,
 *   timezone:   string,
 *   isLive:     boolean,   — false = not yet launched in this city
 * }>}
 */
export const CITY_REGISTRY = {
  bangalore: {
    name:     'Bangalore',
    lat:      12.9716,
    lng:      77.5946,
    radiusKm: 50,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    isLive:   true,
  },
  mumbai: {
    name:     'Mumbai',
    lat:      19.0760,
    lng:      72.8777,
    radiusKm: 50,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    isLive:   false,   // Activate when ready
  },
  delhi: {
    name:     'Delhi NCR',
    lat:      28.6139,
    lng:      77.2090,
    radiusKm: 70,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    isLive:   false,
  },
  hyderabad: {
    name:     'Hyderabad',
    lat:      17.3850,
    lng:      78.4867,
    radiusKm: 40,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    isLive:   false,
  },
};

/**
 * Detects which city a lat/lng coordinate belongs to.
 * Returns the city key, or null if not within any registered city radius.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string | null} city key from CITY_REGISTRY
 */
export function detectCity(lat, lng) {
  const { calculateDistance } = require('@/lib/location');

  for (const [key, city] of Object.entries(CITY_REGISTRY)) {
    if (!city.isLive) continue;
    const dist = calculateDistance(lat, lng, city.lat, city.lng);
    if (dist <= city.radiusKm) return key;
  }
  return null;
}

/**
 * Returns all live cities as an array for UI dropdowns.
 * @returns {Array<{ id: string, name: string }>}
 */
export function getLiveCities() {
  return Object.entries(CITY_REGISTRY)
    .filter(([, c]) => c.isLive)
    .map(([id, c]) => ({ id, name: c.name }));
}

// ─── GeoHash support (Phase 2: 500–10K workers) ──────────────────────────────

/**
 * Generates a GeoHash for a lat/lng coordinate.
 * Used to add geohash indexing to worker documents for Phase 2.
 *
 * To activate Phase 2:
 *   1. npm install geofire-common
 *   2. Run the migration script below to add geohash to all workers
 *   3. Add geohash to the Firestore composite index
 *   4. Replace sortWorkersByDistance() with geoQueryWorkers()
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {string} GeoHash string (precision 9 = ~5m accuracy)
 */
export async function getGeoHash(lat, lng) {
  const { geohashForLocation } = await import('geofire-common');
  return geohashForLocation([lat, lng]);
}

/**
 * Phase 2 worker query — fetches workers within radiusKm using GeoHash bounds.
 * Server-side filtering means only workers in the radius are returned,
 * not all 10,000 workers.
 *
 * ACTIVATE THIS when publicWorkers.length > 500.
 * Replace the subscribePublicWorkers() call in userStore.js with this.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusKm=50]
 * @returns {Promise<Array>}
 */
export async function geoQueryWorkers(db, lat, lng, radiusKm = 50) {
  const { geohashQueryBounds, distanceBetween } = await import('geofire-common');
  const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');

  const center      = [lat, lng];
  const radiusInM   = radiusKm * 1000;
  const bounds      = geohashQueryBounds(center, radiusInM);

  // GeoHash queries return multiple range queries — run them all in parallel
  const snapshots = await Promise.all(
    bounds.map(([start, end]) =>
      getDocs(
        query(
          collection(db, 'workers'),
          where('isAvailable', '==', true),
          orderBy('geohash'),
          where('geohash', '>=', start),
          where('geohash', '<=', end),
        ),
      ),
    ),
  );

  // Flatten + filter false positives (GeoHash bounds are square, we want a circle)
  const workers = [];
  for (const snap of snapshots) {
    for (const d of snap.docs) {
      const data = d.data();
      if (!data.location?.lat || !data.location?.lng) continue;

      const dist = distanceBetween([data.location.lat, data.location.lng], center);
      if (dist <= radiusKm) {
        workers.push({ id: d.id, ...data, distance: dist });
      }
    }
  }

  return workers.sort((a, b) => a.distance - b.distance);
}

/**
 * Migration script — adds geohash to all existing worker documents.
 * Run once from a Node.js script (not from the browser) when activating Phase 2.
 *
 * Usage: node scripts/migrate-geohash.js
 *
 * @param {import('firebase-admin').firestore.Firestore} adminDb
 */
export async function migrateWorkersToGeoHash(adminDb) {
  const { geohashForLocation } = await import('geofire-common');
  const snap = await adminDb.collection('workers').get();

  let updated = 0;
  let skipped = 0;

  const batch = adminDb.batch();

  for (const d of snap.docs) {
    const data = d.data();
    if (!data.location?.lat || !data.location?.lng) { skipped++; continue; }

    const geohash = geohashForLocation([data.location.lat, data.location.lng]);
    batch.update(d.ref, { geohash });
    updated++;

    // Firestore batch limit is 500 — commit and reset
    if (updated % 499 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  console.log(`[geohash migration] Updated: ${updated}, Skipped (no location): ${skipped}`);
}

// ─── Multi-city Firestore structure (Phase 3: 10K+ workers) ──────────────────

/**
 * Phase 3 collection naming convention.
 * Instead of one flat `workers` collection, shard by city:
 *
 *   workers_bangalore/{uid}
 *   workers_mumbai/{uid}
 *   workers_delhi/{uid}
 *
 * This keeps each city collection small and fast.
 * Queries never cross city boundaries unnecessarily.
 *
 * ACTIVATE THIS when a single city has >10,000 workers.
 *
 * @param {string} cityKey — key from CITY_REGISTRY
 * @returns {string} Firestore collection name
 */
export function getWorkerCollectionName(cityKey) {
  if (!cityKey || !CITY_REGISTRY[cityKey]) {
    return 'workers'; // Default — single-city mode
  }
  return `workers_${cityKey}`;
}

/**
 * Phase 3 booking collection naming.
 * Shard bookings by city to keep the collection fast for city-level analytics.
 *
 * @param {string} cityKey
 * @returns {string}
 */
export function getBookingCollectionName(cityKey) {
  if (!cityKey || !CITY_REGISTRY[cityKey]) return 'bookings';
  return `bookings_${cityKey}`;
}

// ─── Worker document expansion for multi-city ─────────────────────────────────

/**
 * Additional fields to add to the workers collection when going multi-city.
 * Add these to the worker profile form and Firestore security rules.
 *
 * Current workers document has: { location: { lat, lng, address } }
 * Phase 3 workers document adds:
 *
 * {
 *   city:      "bangalore",         ← CITY_REGISTRY key
 *   cityName:  "Bangalore",         ← denormalized for display
 *   geohash:   "tdr1w96nf",         ← Phase 2 addition
 *   serviceArea: {                  ← Optional: worker's service radius
 *     radiusKm: 20,
 *   },
 * }
 */
export const WORKER_CITY_FIELDS_SCHEMA = {
  city:      'string',     // CITY_REGISTRY key
  cityName:  'string',     // Denormalized display name
  geohash:   'string',     // Added in Phase 2
  serviceArea: {
    radiusKm: 'number',    // How far the worker is willing to travel
  },
};