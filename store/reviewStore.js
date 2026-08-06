import { create } from 'zustand';

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeReview(docSnap) {
  const d = docSnap.data();
  return {
    id:           docSnap.id,
    workerId:     d.workerId     ?? '',
    customerId:   d.customerId   ?? '',
    customerName: d.customerName ?? 'Anonymous',
    bookingId:    d.bookingId    ?? '',
    rating:       d.rating       ?? 0,
    comment:      d.comment      ?? '',
    createdAt:    ts(d.createdAt),
  };
}

export const useReviewStore = create((set, get) => ({
  // Reviews for the currently viewed worker profile
  workerReviews:        [],
  workerReviewsLoading: false,

  // ── Fetch reviews for a worker (public profile page) ──────────────────────

  async fetchWorkerReviews(workerId) {
    if (!workerId) return;
    set({ workerReviewsLoading: true, workerReviews: [] });

    try {
      const { db } = await import('@/lib/firebase/config');
      const {
        collection, query, where, orderBy, getDocs,
      } = await import('firebase/firestore');

      try {
        // Primary: with orderBy (requires composite index)
        const snap = await getDocs(
          query(
            collection(db, 'reviews'),
            where('workerId',  '==', workerId),
            orderBy('createdAt', 'desc'),
          ),
        );
        set({ workerReviews: snap.docs.map(normalizeReview) });
      } catch (indexErr) {
        // Fallback: no orderBy, sort client-side
        console.warn(
          '[reviewStore] fetchWorkerReviews — index missing, using fallback.',
          indexErr.message,
        );
        const snap = await getDocs(
          query(
            collection(db, 'reviews'),
            where('workerId', '==', workerId),
          ),
        );
        const reviews = snap.docs
          .map(normalizeReview)
          .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
        set({ workerReviews: reviews });
      }
    } catch (err) {
      console.error('[reviewStore] fetchWorkerReviews:', err.message);
    } finally {
      set({ workerReviewsLoading: false });
    }
  },

  // ── Submit a review after job completion ──────────────────────────────────

  /**
   * @param {{
   *   workerId:     string,
   *   customerId:   string,
   *   customerName: string,
   *   bookingId:    string,
   *   rating:       number,   — 1–5
   *   comment:      string,
   * }} data
   */
  async submitReview({ workerId, customerId, customerName, bookingId, rating, comment }) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, collection, addDoc, runTransaction,
      query, where, getDocs, Timestamp,
    } = await import('firebase/firestore');

    // Guard: one review per booking per customer
    const existing = await getDocs(
      query(
        collection(db, 'reviews'),
        where('bookingId',   '==', bookingId),
        where('customerId',  '==', customerId),
      ),
    );
    if (!existing.empty) {
      throw new Error('You have already reviewed this booking.');
    }

    const now = Timestamp.now();

    // Write the review document
    const reviewRef = await addDoc(collection(db, 'reviews'), {
      workerId,
      customerId,
      customerName,
      bookingId,
      rating:    Math.max(1, Math.min(5, rating)),
      comment:   comment?.trim() ?? '',
      createdAt: now,
    });

    // Atomically recalculate and persist the worker's average rating
    const workerRef = doc(db, 'workers', workerId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(workerRef);
      if (!snap.exists()) return;

      const data      = snap.data();
      const oldCount  = data.reviewCount ?? 0;
      const oldRating = data.rating      ?? 0;
      const newCount  = oldCount + 1;

      // Incremental average: newAvg = (oldAvg * oldCount + newRating) / newCount
      const newRating = parseFloat(
        ((oldRating * oldCount + rating) / newCount).toFixed(2),
      );

      transaction.update(workerRef, {
        rating:      newRating,
        reviewCount: newCount,
        updatedAt:   now,
      });
    });

    // Notify the worker (non-blocking)
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      workerId,
      'review_received',
      { customerName, rating, workerId },
      reviewRef.id,
    );

    return reviewRef.id;
  },
}));