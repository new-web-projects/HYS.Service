import { create } from 'zustand';

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeRequest(docSnap) {
  const d = docSnap.data();
  return {
    id:              docSnap.id,
    customerId:      d.customerId      ?? '',
    customerName:    d.customerName    ?? '',
    categoryId:      d.categoryId      ?? '',
    categoryName:    d.categoryName    ?? '',
    description:     d.description     ?? '',
    address:         d.address         ?? '',
    preferredDate:   ts(d.preferredDate),
    budget:          d.budget          ?? null,
    status:          d.status          ?? 'open',   // open | quoted | accepted | closed
    quotesCount:     d.quotesCount     ?? 0,
    acceptedQuoteId: d.acceptedQuoteId ?? null,
    createdAt:       ts(d.createdAt),
    updatedAt:       ts(d.updatedAt),
  };
}

export const useJobRequestStore = create((set, get) => ({
  // Customer's own requests
  customerRequests:        [],
  customerRequestsLoading: false,

  // Worker's job board (open requests in their category)
  openRequests:        [],
  openRequestsLoading: false,

  // Admin: all requests
  allRequests:        [],
  allRequestsLoading: false,

  _unsubCustomer: null,
  _unsubWorker:   null,

  // ── Customer: subscribe to own requests ───────────────────────────────────

  async subscribeCustomerRequests(customerId) {
    get()._unsubCustomer?.();
    set({ customerRequestsLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const { collection, query, where, orderBy, onSnapshot } =
      await import('firebase/firestore');

    const q = query(
      collection(db, 'jobRequests'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
    );

    const safetyTimer = setTimeout(
      () => set({ customerRequestsLoading: false }),
      5000,
    );

    const unsub = onSnapshot(q, (snap) => {
      clearTimeout(safetyTimer);
      set({
        customerRequests:        snap.docs.map(normalizeRequest),
        customerRequestsLoading: false,
      });
    }, (err) => {
      clearTimeout(safetyTimer);
      console.error('[jobRequestStore] subscribeCustomerRequests:', err.message);
      set({ customerRequestsLoading: false });
    });

    set({ _unsubCustomer: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeCustomerRequests() {
    get()._unsubCustomer?.();
    set({ _unsubCustomer: null });
  },

  // ── Worker: subscribe to open requests in category ────────────────────────

  async subscribeOpenRequests(categoryId) {
    get()._unsubWorker?.();
    set({ openRequestsLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const { collection, query, where, orderBy, onSnapshot } =
      await import('firebase/firestore');

    const q = query(
      collection(db, 'jobRequests'),
      where('categoryId', '==', categoryId),
      where('status', 'in', ['open', 'quoted']), // Workers can still quote on 'quoted' requests
      orderBy('createdAt', 'desc'),
    );

    const safetyTimer = setTimeout(
      () => set({ openRequestsLoading: false }),
      5000,
    );

    const unsub = onSnapshot(q, (snap) => {
      clearTimeout(safetyTimer);
      set({
        openRequests:        snap.docs.map(normalizeRequest),
        openRequestsLoading: false,
      });
    }, (err) => {
      clearTimeout(safetyTimer);
      console.error('[jobRequestStore] subscribeOpenRequests:', err.message);
      set({ openRequestsLoading: false });
    });

    set({ _unsubWorker: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeOpenRequests() {
    get()._unsubWorker?.();
    set({ _unsubWorker: null });
  },

  // ── Create job request (customer) ─────────────────────────────────────────

  async createJobRequest(data) {
    const { db } = await import('@/lib/firebase/config');
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');

    const now    = Timestamp.now();
    const docRef = await addDoc(collection(db, 'jobRequests'), {
      customerId:      data.customerId,
      customerName:    data.customerName,
      categoryId:      data.categoryId,
      categoryName:    data.categoryName,
      description:     data.description,
      address:         data.address,
      preferredDate:   data.preferredDate
        ? Timestamp.fromDate(new Date(data.preferredDate))
        : null,
      budget:          data.budget ? parseFloat(data.budget) : null,
      status:          'open',
      quotesCount:     0,
      acceptedQuoteId: null,
      createdAt:       now,
      updatedAt:       now,
    });

    return docRef.id;
  },

  // ── Close request (customer cancels) ──────────────────────────────────────

  async closeJobRequest(requestId) {
    const { db }                  = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'jobRequests', requestId), {
      status:    'closed',
      updatedAt: Timestamp.now(),
    });
  },

  // ── Admin: fetch all requests ──────────────────────────────────────────────

  async fetchAllRequests() {
    set({ allRequestsLoading: true });
    try {
      const { db } = await import('@/lib/firebase/config');
      const { collection, query, orderBy, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(
        query(collection(db, 'jobRequests'), orderBy('createdAt', 'desc')),
      );
      set({ allRequests: snap.docs.map(normalizeRequest) });
    } catch (err) {
      console.error('[jobRequestStore] fetchAllRequests:', err.message);
    } finally {
      set({ allRequestsLoading: false });
    }
  },
}));