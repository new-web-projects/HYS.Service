import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';

/**
 * Converts a Firestore Timestamp to an ISO string.
 * Handles null, undefined, and already-converted strings gracefully.
 */
export function tsToISO(v) {
  if (!v)                  return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string')  return v;
  return null;
}

/**
 * Fetches a paginated list of documents from a collection.
 *
 * WHY: Loading all 500 pages at once is wasteful. With pagination,
 * each request fetches only the next N documents using a cursor,
 * keeping reads minimal and the UI fast.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string}  collectionName
 * @param {object}  options
 * @param {number}  [options.pageSize=20]    — Documents per page
 * @param {any}     [options.cursor]         — Last document from previous page (for next page)
 * @param {string}  [options.orderByField='createdAt'] — Field to order by
 * @param {'asc'|'desc'} [options.direction='desc']
 * @param {Array}   [options.filters]        — Array of [field, operator, value] tuples
 * @returns {Promise<{ items: Array, nextCursor: any | null, hasMore: boolean }>}
 */
export async function paginatedQuery(db, collectionName, options = {}) {
  const {
    pageSize    = 20,
    cursor      = null,
    orderByField = 'createdAt',
    direction   = 'desc',
    filters     = [],
  } = options;

  // Fetch one extra document to determine if there are more pages
  const fetchSize = pageSize + 1;

  let q = query(
    collection(db, collectionName),
    ...filters.map(([field, op, value]) => where(field, op, value)),
    orderBy(orderByField, direction),
    limit(fetchSize),
  );

  if (cursor) {
    q = query(q, startAfter(cursor));
  }

  const snap    = await getDocs(q);
  const docs    = snap.docs;
  const hasMore = docs.length === fetchSize;

  // Remove the extra document we fetched to check hasMore
  const items   = docs.slice(0, pageSize).map((d) => ({
    id: d.id,
    ...d.data(),
    _cursor: d, // Store the raw doc for use as the next cursor
  }));

  const nextCursor = hasMore ? docs[pageSize - 1] : null;

  return { items, nextCursor, hasMore };
}

/**
 * Fetches multiple documents by ID in a single batch.
 * Firestore charges one read per document — batching does not reduce reads
 * but does reduce round-trips (latency).
 *
 * WHY: When you need 10 specific worker profiles by ID, do not loop with
 * 10 separate getDoc() calls. Use batchGetDocs() instead.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string}   collectionName
 * @param {string[]} ids
 * @returns {Promise<Array>}
 */
export async function batchGetDocs(db, collectionName, ids) {
  if (!ids || ids.length === 0) return [];

  // Deduplicate IDs
  const uniqueIds = [...new Set(ids)];

  // Firestore getDoc() calls in parallel (Promise.all)
  // This is as fast as possible — all requests fire simultaneously
  const snaps = await Promise.all(
    uniqueIds.map((id) => getDoc(doc(db, collectionName, id))),
  );

  return snaps
    .filter((snap) => snap.exists())
    .map((snap) => ({ id: snap.id, ...snap.data() }));
}

/**
 * Counts documents matching a query WITHOUT fetching the documents.
 * Uses Firestore's `getCountFromServer` which is a single billable read
 * regardless of how many documents match.
 *
 * WHY: Displaying "156 workers" on the dashboard should not read 156 documents.
 * getCountFromServer reads exactly 1 read unit.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} collectionName
 * @param {Array}  [filters] — Array of [field, operator, value] tuples
 * @returns {Promise<number>}
 */
export async function countDocuments(db, collectionName, filters = []) {
  const { getCountFromServer } = await import('firebase/firestore');

  const q = query(
    collection(db, collectionName),
    ...filters.map(([field, op, value]) => where(field, op, value)),
  );

  const result = await getCountFromServer(q);
  return result.data().count;
}

/**
 * Gets the most recent N documents from a collection.
 * Used for dashboard activity feeds, recent uploads, etc.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} collectionName
 * @param {number} [n=5]
 * @param {string} [orderByField='createdAt']
 * @param {Array}  [filters]
 * @returns {Promise<Array>}
 */
export async function getRecentDocs(db, collectionName, n = 5, orderByField = 'createdAt', filters = []) {
  const q = query(
    collection(db, collectionName),
    ...filters.map(([field, op, value]) => where(field, op, value)),
    orderBy(orderByField, 'desc'),
    limit(n),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    // Convert all Timestamps to ISO strings
    const normalized = {};
    for (const [key, val] of Object.entries(data)) {
      normalized[key] = val instanceof Timestamp ? val.toDate().toISOString() : val;
    }
    return { id: d.id, ...normalized };
  });
}

/**
 * Subscribes to a query with automatic unsubscription cleanup.
 * Returns an object with an `unsubscribe` method.
 *
 * Wraps onSnapshot with error handling and a safety timeout
 * to clear loading state if Firestore never responds.
 *
 * @param {object} q - Firestore query
 * @param {function(Array): void} onData
 * @param {function(Error): void} [onError]
 * @param {number} [safetyTimeoutMs=5000]
 * @returns {{ unsubscribe: function }}
 */
export function subscribeToQuery(q, onData, onError, safetyTimeoutMs = 5000) {
  const { onSnapshot } = require('firebase/firestore');

  let resolved = false;

  const safetyTimer = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      onData([]); // Emit empty array to clear loading state
    }
  }, safetyTimeoutMs);

  const unsub = onSnapshot(
    q,
    (snap) => {
      clearTimeout(safetyTimer);
      resolved = true;
      onData(snap.docs.map((d) => {
        const data = d.data();
        const normalized = {};
        for (const [key, val] of Object.entries(data)) {
          normalized[key] = val instanceof Timestamp ? val.toDate().toISOString() : val;
        }
        return { id: d.id, ...normalized };
      }));
    },
    (err) => {
      clearTimeout(safetyTimer);
      console.error('[subscribeToQuery] error:', err.message);
      onError?.(err);
    },
  );

  return {
    unsubscribe: () => {
      clearTimeout(safetyTimer);
      unsub();
    },
  };
}