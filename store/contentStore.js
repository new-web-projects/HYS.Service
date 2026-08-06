import { create }                from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * PERFORMANCE NOTE — Zustand Selectors
 *
 * Always use selector functions when consuming this store to avoid
 * unnecessary re-renders.
 *
 * ✅ CORRECT — component only re-renders when `pages` changes:
 *   const pages = useContentStore((s) => s.pages);
 *   const pagesLoading = useContentStore((s) => s.pagesLoading);
 *
 * ❌ INCORRECT — component re-renders on ANY store state change:
 *   const { pages, pagesLoading } = useContentStore();
 *
 * For multiple values, use shallow comparison:
 *   import { shallow } from 'zustand/shallow';
 *   const { pages, pagesLoading } = useContentStore(
 *     (s) => ({ pages: s.pages, pagesLoading: s.pagesLoading }),
 *     shallow,
 *   );
 */

/**
 * BUG FIX (Bug 2 + Bug 4):
 * - Previous code called both fetchPages() AND subscribePages() on mount,
 *   creating two simultaneous Firestore reads.
 * - The firstCall pattern never cleared loading when the collection was empty.
 *
 * Fix: subscribe() fires immediately with current data (even empty array),
 * so no separate fetch is needed. A 5-second safety timeout clears loading
 * if Firestore never responds (permission error, network issue, etc.).
 */

export const useContentStore = create(
  subscribeWithSelector((set, get) => ({
    pages:      [],
    media:      [],
    auditLogs:  [],
    trashPages: [],
    categories: [],

    pagesLoading:      false,
    mediaLoading:      false,
    trashLoading:      false,
    categoriesLoading: false,

    _unsubscribePages:      null,
    _unsubscribeMedia:      null,
    _unsubscribeCategories: null,
    _unsubCategories:       null,

    // ── Pages ─────────────────────────────────────────────────────────────────

    async subscribePages() {
      // Tear down existing listener to prevent duplicate onSnapshot listeners
      get()._unsubscribePages?.();
      set({ pagesLoading: true });

      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter        = await getAdapter();

      // Safety timeout: if Firestore never fires (empty collection,
      // permission error, etc.), clear the loading spinner after 5 seconds
      const safetyTimer = setTimeout(() => {
        set({ pagesLoading: false });
      }, 5000);

      let resolved = false;

      const unsub = adapter.subscribe('pages', (pages) => {
        clearTimeout(safetyTimer);
        resolved = true;
        set({ pages, pagesLoading: false });
      });

      set({ _unsubscribePages: () => { unsub(); clearTimeout(safetyTimer); } });
    },

    unsubscribePages() {
      get()._unsubscribePages?.();
      set({ _unsubscribePages: null });
    },

    async createPage(data) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const page    = await adapter.create('pages', data);
      // Optimistic update — subscription will confirm via onSnapshot
      set((s) => ({
        pages: [page, ...s.pages.filter((p) => p.id !== page.id)],
      }));
      return page;
    },

    async updatePage(id, data) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const updated = await adapter.update('pages', id, data);
      set((s) => ({
        pages: s.pages.map((p) => (p.id === id ? updated : p)),
      }));
      return updated;
    },

    async deletePage(id) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      await adapter.softDelete('pages', id);
      set((s) => ({ pages: s.pages.filter((p) => p.id !== id) }));
    },

    async getPageById(id) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      return adapter.getById('pages', id);
    },

    // ── Trash ─────────────────────────────────────────────────────────────────

    async fetchTrashPages() {
      set({ trashLoading: true });
      const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;
      try {
        if (mode === 'server') {
          const res = await fetch('/api/pages?trash=true', { credentials: 'include' });
          if (!res.ok) throw new Error('Failed to load trash.');
          set({ trashPages: await res.json() });
          return;
        }
        if (mode === 'firebase') {
          const { db }           = await import('@/lib/firebase/config');
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const cutoff  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const snap    = await getDocs(
            query(collection(db, 'pages'), where('deletedAt', '!=', null)),
          );
          const pages = snap.docs
            .map((d) => {
              const data = d.data();
              return {
                id:        d.id,
                ...data,
                deletedAt: data.deletedAt?.toDate?.()?.toISOString() ?? null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
              };
            })
            .filter((p) => p.deletedAt && new Date(p.deletedAt) > cutoff)
            .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
          set({ trashPages: pages });
        }
      } catch (err) {
        console.error('[contentStore] fetchTrashPages:', err.message);
      } finally {
        set({ trashLoading: false });
      }
    },

    async restorePage(id) {
      const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;
      if (mode === 'server') {
        const res = await fetch(`/api/pages/${id}/restore`, {
          method: 'PATCH', credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? 'Restore failed.');
        }
        const restored = await res.json();
        set((s) => ({
          trashPages: s.trashPages.filter((p) => p.id !== id),
          pages:      [restored, ...s.pages],
        }));
        return restored;
      }
      if (mode === 'firebase') {
        const { db }             = await import('@/lib/firebase/config');
        const { doc, updateDoc, getDoc, Timestamp } = await import('firebase/firestore');
        const ref  = doc(db, 'pages', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Page not found.');
        const data      = snap.data();
        const deletedAt = data.deletedAt?.toDate?.();
        if (!deletedAt) throw new Error('Page is not in trash.');
        if (deletedAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
          throw new Error('Recovery window has expired.');
        }
        await updateDoc(ref, {
          deletedAt:   null,
          isPublished: false,
          updatedAt:   Timestamp.now(),
        });
        set((s) => ({
          trashPages: s.trashPages.filter((p) => p.id !== id),
          pages:      [{ id, ...data, deletedAt: null, isPublished: false }, ...s.pages],
        }));
      }
    },

    // ── Media ─────────────────────────────────────────────────────────────────

    async subscribeMedia() {
      get()._unsubscribeMedia?.();
      set({ mediaLoading: true });

      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter        = await getAdapter();

      const safetyTimer = setTimeout(() => set({ mediaLoading: false }), 5000);

      const unsub = adapter.subscribe('media', (media) => {
        clearTimeout(safetyTimer);
        set({ media, mediaLoading: false });
      });

      set({ _unsubscribeMedia: () => { unsub(); clearTimeout(safetyTimer); } });
    },

    unsubscribeMedia() {
      get()._unsubscribeMedia?.();
      set({ _unsubscribeMedia: null });
    },

    async uploadMedia(file, uploaderUid) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const result  = await adapter.uploadFile(file);
      const item    = await adapter.create('media', { ...result, uploadedBy: uploaderUid });
      set((s) => ({ media: [item, ...s.media] }));
      return item;
    },

    async deleteMedia(id, url) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      await adapter.softDelete('media', id);
      await adapter.deleteFile(url);
      set((s) => ({ media: s.media.filter((m) => m.id !== id) }));
    },

    // ── Categories ────────────────────────────────────────────────────────────

    // ── Subscribe to categories ────────────────────────────────────────────────

async subscribeCategories() {
  // Cancel any previous subscription
  get()._unsubCategories?.();
  set({ categoriesLoading: true });

  // BUG FIX: this always opened a Firestore onSnapshot listener regardless
  // of NEXT_PUBLIC_BACKEND_MODE, unlike createCategory/updateCategory/
  // deleteCategory/approveCategory just below, which correctly go through
  // getAdapter() and hit /api/categories (Prisma) in server mode. In server
  // mode this function would try to read Firestore directly — which may
  // not even be configured — and categories written via the adapter would
  // never show up in this list. Postgres/Prisma has no push-subscription
  // equivalent to Firestore's onSnapshot, so server mode falls back to a
  // one-time fetch through the same adapter the writes already use.
  if (process.env.NEXT_PUBLIC_BACKEND_MODE === 'server') {
    try {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter    = await getAdapter();
      const categories = await adapter.getAll('categories');
      set({
        categories: [...categories].sort((a, b) => a.name.localeCompare(b.name)),
        categoriesLoading: false,
      });
    } catch (err) {
      console.error('[contentStore] subscribeCategories (server mode):', err.message);
      set({ categoriesLoading: false });
    }
    set({ _unsubCategories: null });
    return;
  }

  const { db } = await import('@/lib/firebase/config');
  const {
    collection, query, orderBy, onSnapshot,
  } = await import('firebase/firestore');

  const safetyTimer = setTimeout(
    () => set({ categoriesLoading: false }),
    5000,
  );

  const unsub = onSnapshot(
    query(collection(db, 'categories'), orderBy('name', 'asc')),
    (snap) => {
      clearTimeout(safetyTimer);
      set({
        categories: snap.docs.map((d) => ({
          id:          d.id,
          name:        d.data().name        ?? '',
          description: d.data().description ?? '',
          icon:        d.data().icon        ?? 'wrench',
          status:      d.data().status      ?? 'active',
          createdAt:   d.data().createdAt?.toDate?.()?.toISOString() ?? null,
        })),
        categoriesLoading: false,
      });
    },
    async (err) => {
      clearTimeout(safetyTimer);
      console.error('[contentStore] subscribeCategories:', err.message);
      // Fallback: fetch without orderBy
      try {
        const { getDocs } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'categories'));
        set({
          categories: snap.docs
            .map((d) => ({
              id:          d.id,
              name:        d.data().name        ?? '',
              description: d.data().description ?? '',
              icon:        d.data().icon        ?? 'wrench',
              status:      d.data().status      ?? 'active',
              createdAt:   d.data().createdAt?.toDate?.()?.toISOString() ?? null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          categoriesLoading: false,
        });
      } catch (fallbackErr) {
        console.error('[contentStore] categories fallback failed:', fallbackErr.message);
        set({ categoriesLoading: false });
      }
    },
  );

  set({
    _unsubCategories: () => {
      unsub();
      clearTimeout(safetyTimer);
    },
  });
},

unsubscribeCategories() {
  get()._unsubCategories?.();
  set({ _unsubCategories: null });
},

    async createCategory(data) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const cat     = await adapter.create('categories', data);
      set((s) => ({ categories: [...s.categories, cat].sort((a, b) => a.name.localeCompare(b.name)) }));
      return cat;
    },

    async updateCategory(id, data) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      const updated = await adapter.update('categories', id, data);
      set((s) => ({
        categories: s.categories
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return updated;
    },

    async deleteCategory(id) {
      const { getAdapter } = await import('@/lib/adapters/index');
      const adapter = await getAdapter();
      if (adapter.hardDelete) {
        await adapter.hardDelete('categories', id);
      } else {
        await adapter.softDelete('categories', id);
      }
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
    },

    async approveCategory(id) {
      return get().updateCategory(id, { status: 'active' });
    },

    // ── Audit logs ────────────────────────────────────────────────────────────

    async fetchAuditLogs(limit = 5) {
      const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;
      if (mode === 'server') {
        try {
          const res = await fetch(`/api/audit-logs?limit=${limit}`, { credentials: 'include' });
          if (res.ok) set({ auditLogs: await res.json() });
        } catch (err) {
          console.error('[contentStore] fetchAuditLogs:', err.message);
        }
        return;
      }
      if (mode === 'firebase') {
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, orderBy, limit: fsLimit, getDocs } =
          await import('firebase/firestore');
        try {
          const snap = await getDocs(
            query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), fsLimit(limit)),
          );
          set({
            auditLogs: snap.docs.map((d) => {
              const data = d.data();
              return {
                id:         d.id,
                adminId:    data.adminId,
                adminName:  data.adminName ?? 'Admin',
                action:     data.action,
                collection: data.collection,
                documentId: data.documentId,
                timestamp:  data.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
              };
            }),
          });
        } catch (err) {
          console.error('[contentStore] fetchAuditLogs (firebase):', err.message);
        }
      }
    },
  })),
);