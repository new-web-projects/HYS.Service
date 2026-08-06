import { create } from 'zustand';

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeWorker(docSnap) {
  const d = docSnap.data();
  return {
    id:              docSnap.id,
    uid:             d.uid             ?? docSnap.id,
    name:            d.name            ?? '',
    email:           d.email           ?? '',
    categoryId:      d.categoryId      ?? '',
    categoryName:    d.categoryName    ?? '',
    bio:             d.bio             ?? '',
    skills:          d.skills          ?? [],
    location:        d.location        ?? null,
    rating:          d.rating          ?? 0,
    reviewCount:     d.reviewCount     ?? 0,
    ordersCompleted: d.ordersCompleted  ?? 0,
    isAvailable:     d.isAvailable     ?? false,
    isVerified:      d.isVerified      ?? false,
    startingPrice:   d.startingPrice   ?? d.pricePerHour ?? 0, // backward-compat read
    profileImageUrl: d.profileImageUrl ?? '',
    phone:           d.phone           ?? '',
    // Part 6: experience
    experienceYears: d.experienceYears ?? 0,
    experienceDesc:  d.experienceDesc  ?? '',
    // Part 6: document verification
    documents:       d.documents       ?? {},
    selectedDocType: d.selectedDocType ?? null,
    gender:          d.gender          ?? '',
    createdAt:       ts(d.createdAt),
    updatedAt:       ts(d.updatedAt),
  };
}

function normalizeUser(docSnap) {
  const d = docSnap.data();
  return {
    id:        docSnap.id,
    uid:       d.uid       ?? docSnap.id,
    email:     d.email     ?? '',
    name:      d.name      ?? '',
    role:      d.role      ?? 'customer',
    phone:     d.phone     ?? '',
    avatarUrl: d.avatarUrl ?? '',
    location:  d.location  ?? null,
    isActive:  d.isActive  ?? true,
    gender:    d.gender    ?? '',
    createdAt: ts(d.createdAt),
    lastLogin: ts(d.lastLogin),
  };
}

export const useUserStore = create((set, get) => ({

  // ── State ─────────────────────────────────────────────────────────────────

  publicWorkers:        [],
  publicWorkersLoading: false,
  _unsubPublicWorkers:  null,

  allWorkers:        [],
  allWorkersLoading: false,

  allUsers:        [],
  allUsersLoading: false,

  // ── Public: subscribe to available workers ────────────────────────────────

  async subscribePublicWorkers() {
    get()._unsubPublicWorkers?.();
    set({ publicWorkersLoading: true });

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy,
      onSnapshot, getDocs,
    } = await import('firebase/firestore');

    const safetyTimer = setTimeout(
      () => set({ publicWorkersLoading: false }),
      5000,
    );

    let usedFallback = false;

    const unsub = onSnapshot(
      query(
        collection(db, 'workers'),
        where('isAvailable', '==', true),
        orderBy('rating', 'desc'),
      ),
      (snap) => {
        clearTimeout(safetyTimer);
        if (!usedFallback) {
          set({
            publicWorkers:        snap.docs.map(normalizeWorker),
            publicWorkersLoading: false,
          });
        }
      },
      async (err) => {
        clearTimeout(safetyTimer);
        console.error(
          '[userStore] subscribePublicWorkers — composite index missing.\n' +
          'Fix: firebase deploy --only firestore:indexes\n',
          err.message,
        );
        usedFallback = true;
        try {
          const snap = await getDocs(
            query(
              collection(db, 'workers'),
              where('isAvailable', '==', true),
            ),
          );
          set({
            publicWorkers: snap.docs
              .map(normalizeWorker)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
            publicWorkersLoading: false,
          });
        } catch (fallbackErr) {
          console.error('[userStore] fallback failed:', fallbackErr.message);
          set({ publicWorkersLoading: false });
        }
      },
    );

    set({
      _unsubPublicWorkers: () => {
        unsub();
        clearTimeout(safetyTimer);
      },
    });
  },

  unsubscribePublicWorkers() {
    get()._unsubPublicWorkers?.();
    set({ _unsubPublicWorkers: null });
  },

  // ── Admin: fetch all workers ──────────────────────────────────────────────

  async fetchAllWorkers() {
    set({ allWorkersLoading: true });
    try {
      const { db } = await import('@/lib/firebase/config');
      const { collection, query, orderBy, getDocs } =
        await import('firebase/firestore');
      const snap = await getDocs(
        query(collection(db, 'workers'), orderBy('createdAt', 'desc')),
      );
      set({ allWorkers: snap.docs.map(normalizeWorker) });
    } catch (err) {
      console.error('[userStore] fetchAllWorkers:', err.message);
    } finally {
      set({ allWorkersLoading: false });
    }
  },

  // ── Admin: manually verify a worker ──────────────────────────────────────

  async verifyWorker(workerId) {
    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'workers', workerId), {
      isVerified: true,
      updatedAt:  Timestamp.now(),
    });

    set((s) => ({
      allWorkers: s.allWorkers.map((w) =>
        w.id === workerId ? { ...w, isVerified: true } : w,
      ),
    }));

    const { createNotification } = await import('@/lib/notifications');
    await createNotification(workerId, 'worker_verified', {}, workerId);
  },

  // ── Admin: update document verification status ────────────────────────────

  /**
   * Sets the verification status of a single document type for a worker.
   * Called from the admin workers panel when reviewing uploaded documents.
   *
   * @param {string} workerId
   * @param {'pan'|'aadhaar'|'workId'} docKey
   * @param {'verified'|'rejected'} status
   */
  async updateDocumentStatus(workerId, docKey, status) {
    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'workers', workerId), {
      [`documents.${docKey}.status`]: status,
      updatedAt: Timestamp.now(),
    });

    // Optimistic local state update
    set((s) => ({
      allWorkers: s.allWorkers.map((w) => {
        if (w.id !== workerId) return w;
        return {
          ...w,
          documents: {
            ...(w.documents ?? {}),
            [docKey]: { ...(w.documents?.[docKey] ?? {}), status },
          },
        };
      }),
    }));

    // Notify worker if all submitted documents are verified
    if (status === 'verified') {
      const { createNotification } = await import('@/lib/notifications');
      await createNotification(
        workerId,
        'system',
        {
          title: 'Document Verified',
          body:  `Your ${docKey === 'workId' ? 'Work ID' : docKey.toUpperCase()} has been verified by the platform.`,
          link:  '/worker-profile',
        },
        workerId,
      );
    }
  },

  // ── Admin: toggle worker availability ────────────────────────────────────

  async setWorkerAvailability(workerId, isAvailable) {
    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    await updateDoc(doc(db, 'workers', workerId), {
      isAvailable,
      updatedAt: Timestamp.now(),
    });

    set((s) => ({
      allWorkers: s.allWorkers.map((w) =>
        w.id === workerId ? { ...w, isAvailable } : w,
      ),
      publicWorkers: isAvailable
        ? s.publicWorkers
        : s.publicWorkers.filter((w) => w.id !== workerId),
    }));
  },

  // ── Admin: fetch all users ────────────────────────────────────────────────

  async fetchAllUsers() {
    set({ allUsersLoading: true });
    try {
      const { db } = await import('@/lib/firebase/config');
      const { collection, query, orderBy, getDocs } =
        await import('firebase/firestore');
      const snap = await getDocs(
        query(collection(db, 'users'), orderBy('createdAt', 'desc')),
      );
      set({ allUsers: snap.docs.map(normalizeUser) });
    } catch (err) {
      console.error('[userStore] fetchAllUsers:', err.message);
    } finally {
      set({ allUsersLoading: false });
    }
  },

  // ── Admin: enable / disable user ─────────────────────────────────────────

  async setUserActive(userId, isActive) {
    const { db }             = await import('@/lib/firebase/config');
    const { doc, updateDoc } = await import('firebase/firestore');

    await updateDoc(doc(db, 'users', userId), { isActive });

    set((s) => ({
      allUsers: s.allUsers.map((u) =>
        u.id === userId ? { ...u, isActive } : u,
      ),
    }));
  },

  // ── Worker: update own profile ────────────────────────────────────────────

  async updateWorkerProfile(workerId, data) {
    const { db }                        = await import('@/lib/firebase/config');
    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

    // Never allow uid / email to be changed via this method
    const { uid, userId, email, ...safeData } = data;

    await updateDoc(doc(db, 'workers', workerId), {
      ...safeData,
      updatedAt: Timestamp.now(),
    });
  },

  // ── Worker: get own profile ───────────────────────────────────────────────

  async getWorkerProfile(workerId) {
    const { db }          = await import('@/lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');

    const snap = await getDoc(doc(db, 'workers', workerId));
    if (!snap.exists()) return null;
    return normalizeWorker(snap);
  },
}));