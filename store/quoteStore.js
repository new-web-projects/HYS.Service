import { create }                          from 'zustand';
import { calculateFinalPriceWithCurrentRates } from '@/lib/pricing';
import { createNotification }              from '@/lib/notifications';

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeQuote(docSnap) {
  const d = docSnap.data();
  return {
    id:                    docSnap.id,
    jobRequestId:          d.jobRequestId          ?? '',
    customerId:            d.customerId            ?? '',
    workerId:              d.workerId              ?? '',
    workerName:            d.workerName            ?? '',
    workerProfileImageUrl: d.workerProfileImageUrl ?? '',
    workerRating:          d.workerRating          ?? 0,
    workerReviewCount:     d.workerReviewCount      ?? 0,
    workerIsVerified:      d.workerIsVerified       ?? false,
    categoryName:          d.categoryName           ?? '',
    basePrice:             d.basePrice              ?? 0,
    platformFee:           d.platformFee            ?? 0,
    platformPercent:       d.platformPercent        ?? 10,
    platformFeeType:       d.platformFeeType        ?? 'percent',
    platformFixed:         d.platformFixed          ?? 0,
    gstAmount:             d.gstAmount              ?? 0,
    gstPercent:            d.gstPercent             ?? 18,
    finalPrice:            d.finalPrice             ?? 0,
    message:               d.message               ?? '',
    status:                d.status                ?? 'pending', // pending | accepted | rejected
    createdAt:             ts(d.createdAt),
    updatedAt:             ts(d.updatedAt),
  };
}

export const useQuoteStore = create((set, get) => ({
  // Quotes for a specific job request (customer view)
  requestQuotes:        [],
  requestQuotesLoading: false,
  _unsubRequestQuotes:  null,

  // Worker's sent quotes
  workerQuotes:         [],
  workerQuotesLoading:  false,
  _unsubWorkerQuotes:   null,

  // ── Subscribe to quotes for a job request (customer) ─────────────────────

  async subscribeRequestQuotes(jobRequestId) {
    get()._unsubRequestQuotes?.();
    set({ requestQuotesLoading: true, requestQuotes: [] });

    const { db } = await import('@/lib/firebase/config');
    const { collection, query, where, orderBy, onSnapshot } =
      await import('firebase/firestore');

    const q = query(
      collection(db, 'quotes'),
      where('jobRequestId', '==', jobRequestId),
      orderBy('finalPrice', 'asc'), // Show cheapest first
    );

    const safetyTimer = setTimeout(
      () => set({ requestQuotesLoading: false }),
      5000,
    );

    const unsub = onSnapshot(q, (snap) => {
      clearTimeout(safetyTimer);
      set({
        requestQuotes:        snap.docs.map(normalizeQuote),
        requestQuotesLoading: false,
      });
    });

    set({ _unsubRequestQuotes: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeRequestQuotes() {
    get()._unsubRequestQuotes?.();
    set({ _unsubRequestQuotes: null, requestQuotes: [] });
  },

  // ── Subscribe to worker's own sent quotes ─────────────────────────────────

  async subscribeWorkerQuotes(workerId) {
    get()._unsubWorkerQuotes?.();
    set({ workerQuotesLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const { collection, query, where, orderBy, onSnapshot } =
      await import('firebase/firestore');

    const q = query(
      collection(db, 'quotes'),
      where('workerId', '==', workerId),
      orderBy('createdAt', 'desc'),
    );

    const safetyTimer = setTimeout(
      () => set({ workerQuotesLoading: false }),
      5000,
    );

    const unsub = onSnapshot(q, (snap) => {
      clearTimeout(safetyTimer);
      set({
        workerQuotes:        snap.docs.map(normalizeQuote),
        workerQuotesLoading: false,
      });
    });

    set({ _unsubWorkerQuotes: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeWorkerQuotes() {
    get()._unsubWorkerQuotes?.();
    set({ _unsubWorkerQuotes: null });
  },

  // ── Worker sends a quote ───────────────────────────────────────────────────

  /**
   * Creates a quote document with full pricing breakdown.
   * Pricing is calculated from current Firestore settings (platform fee % + GST %).
   * The worker only provides their base price — system calculates everything else.
   *
   * @param {{
   *   jobRequestId:  string,
   *   customerId:    string,
   *   worker:        object,   — full worker profile
   *   basePrice:     number,
   *   message:       string,
   * }} data
   */
  async sendQuote(data) {
    // Guard: check if worker already quoted this request
    const { db } = await import('@/lib/firebase/config');
    const {
      collection, addDoc, getDoc, doc, query, where,
      getDocs, updateDoc, Timestamp,
    } = await import('firebase/firestore');

    const existingSnap = await getDocs(
      query(
        collection(db, 'quotes'),
        where('jobRequestId', '==', data.jobRequestId),
        where('workerId',     '==', data.worker.uid),
      ),
    );

    if (!existingSnap.empty) {
      throw new Error('You have already sent a quote for this request.');
    }

    // Calculate final price with current platform rates
    const pricing = await calculateFinalPriceWithCurrentRates(data.basePrice);

    const now = Timestamp.now();

    // Create the quote
    const quoteRef = await addDoc(collection(db, 'quotes'), {
      jobRequestId:          data.jobRequestId,
      customerId:            data.customerId,
      workerId:              data.worker.uid,
      workerName:            data.worker.name,
      workerProfileImageUrl: data.worker.profileImageUrl ?? '',
      workerRating:          data.worker.rating          ?? 0,
      workerReviewCount:     data.worker.reviewCount      ?? 0,
      workerIsVerified:      data.worker.isVerified       ?? false,
      categoryName:          data.worker.categoryName     ?? '',
      basePrice:             pricing.basePrice,
      platformFee:           pricing.platformFee,
      platformPercent:       pricing.platformPercent,
      platformFeeType:       pricing.platformFeeType,
      platformFixed:         pricing.platformFixed,
      gstAmount:             pricing.gstAmount,
      gstPercent:            pricing.gstPercent,
      finalPrice:            pricing.finalPrice,
      message:               data.message || '',
      status:                'pending',
      createdAt:             now,
      updatedAt:             now,
    });

    // Increment quotesCount on the job request + change status to 'quoted'
    await updateDoc(doc(db, 'jobRequests', data.jobRequestId), {
      quotesCount: (await getDoc(doc(db, 'jobRequests', data.jobRequestId)))
        .data()?.quotesCount + 1 || 1,
      status:    'quoted',
      updatedAt: now,
    });

    // Notify the customer
    await createNotification(
      data.customerId,
      'system',
      {
        title: 'New Quote Received',
        body:  `${data.worker.name} sent a quote of ₹${pricing.finalPrice.toLocaleString('en-IN')} for your request.`,
        link:  '/job-requests',
      },
      quoteRef.id,
    );

    return quoteRef.id;
  },

  // ── Customer accepts a quote ───────────────────────────────────────────────

  /**
   * Accepts a quote — atomically:
   * 1. Updates quote status → 'accepted'
   * 2. Updates all other quotes on the same request → 'rejected'
   * 3. Updates job request → status: 'accepted', acceptedQuoteId
   * 4. Creates a booking document with locked final price
   * 5. Notifies the worker
   *
   * @param {object} quote  — The quote being accepted
   * @param {object} request — The job request
   * @param {object} customer — { uid, name, email }
   */
  async acceptQuote(quote, request, customer) {
    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, getDocs, writeBatch, doc, addDoc, Timestamp,
    } = await import('firebase/firestore');

    const now   = Timestamp.now();
    const batch = writeBatch(db);

    // Accept this quote
    batch.update(doc(db, 'quotes', quote.id), {
      status:    'accepted',
      updatedAt: now,
    });

    // Reject all other pending quotes on this request
    const otherQuotesSnap = await getDocs(
      query(
        collection(db, 'quotes'),
        where('jobRequestId', '==', quote.jobRequestId),
        where('status',       '==', 'pending'),
      ),
    );

    otherQuotesSnap.docs.forEach((d) => {
      if (d.id !== quote.id) {
        batch.update(doc(db, 'quotes', d.id), {
          status:    'rejected',
          updatedAt: now,
        });
      }
    });

    // Update the job request
    batch.update(doc(db, 'jobRequests', request.id), {
      status:          'accepted',
      acceptedQuoteId: quote.id,
      updatedAt:       now,
    });

    await batch.commit();

    // Create a booking with the locked final price
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      customerId:    customer.uid       ?? '',
      customerName:  customer.name      ?? '',
      workerId:      quote.workerId     ?? '',
      workerName:    quote.workerName   ?? '',
      categoryId:    request.categoryId   ?? '',
      categoryName:  request.categoryName ?? '',
      description:   request.description  ?? '',
      scheduledAt:   request.preferredDate
        ? Timestamp.fromDate(new Date(request.preferredDate))
        : now,
      address:       request.address    ?? '',
      // Locked pricing — cannot change after acceptance
      priceQuoted:   quote.finalPrice    ?? 0,
      basePrice:     quote.basePrice     ?? 0,
      platformFee:   quote.platformFee   ?? 0,
      gstAmount:     quote.gstAmount     ?? 0,
      jobRequestId:  request.id,
      quoteId:       quote.id,
      status:        'accepted',
      paymentStatus: 'unpaid',
      paymentRef:    null,
      createdAt:     now,
      updatedAt:     now,
    });

    // Notify the worker their quote was accepted
    await createNotification(
      quote.workerId,
      'booking_accepted',
      {
        customerName: customer.name,
        finalPrice:   quote.finalPrice,
      },
      bookingRef.id,
    );

    return bookingRef.id;
  },

  // ── Customer rejects a single quote ──────────────────────────────────────

  async rejectQuote(quoteId) {
    const { db }                  = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'quotes', quoteId), {
      status:    'rejected',
      updatedAt: Timestamp.now(),
    });
  },
}));