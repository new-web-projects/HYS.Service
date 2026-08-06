import { create } from 'zustand';

const ts = (v) => v?.toDate?.()?.toISOString?.() ?? v ?? null;

function normalizeNotification(docSnap) {
  const d = docSnap.data();
  return {
    id:        docSnap.id,
    userId:    d.userId    ?? '',
    type:      d.type      ?? 'system',
    title:     d.title     ?? '',
    body:      d.body      ?? '',
    link:      d.link      ?? null,
    relatedId: d.relatedId ?? null,
    isRead:    d.isRead    ?? false,
    createdAt: ts(d.createdAt),
  };
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount:   0,
  _unsub:        null,

  // ── Subscribe to real-time notifications ──────────────────────────────────

  async subscribe(userId) {
    // Clean up previous subscription
    get()._unsub?.();

    if (!userId) return;

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, limit, onSnapshot,
    } = await import('firebase/firestore');

    const unsub = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId',    '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
      (snap) => {
        const notifications = snap.docs.map(normalizeNotification);
        const unreadCount   = notifications.filter((n) => !n.isRead).length;
        set({ notifications, unreadCount });
      },
      async (err) => {
        // Fallback: query without orderBy if composite index is missing
        console.warn(
          '[notificationStore] subscribe — index missing, using fallback.\n' +
          'Run: firebase deploy --only firestore:indexes\n',
          err.message,
        );
        try {
          const { getDocs } = await import('firebase/firestore');
          const snap = await getDocs(
            query(
              collection(db, 'notifications'),
              where('userId', '==', userId),
            ),
          );
          const notifications = snap.docs
            .map(normalizeNotification)
            .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
          const unreadCount = notifications.filter((n) => !n.isRead).length;
          set({ notifications, unreadCount });
        } catch (fallbackErr) {
          console.error('[notificationStore] fallback failed:', fallbackErr.message);
        }
      },
    );

    set({ _unsub: unsub });
  },

  unsubscribe() {
    get()._unsub?.();
    set({ _unsub: null, notifications: [], unreadCount: 0 });
  },

  // ── Mark single notification as read ──────────────────────────────────────

  async markRead(notificationId) {
    // Optimistic update — UI reflects immediately
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));

    try {
      const { db }             = await import('@/lib/firebase/config');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (err) {
      console.error('[notificationStore] markRead:', err.message);
    }
  },

  // ── Mark all notifications as read ────────────────────────────────────────

  async markAllRead(userId) {
    if (!userId) return;

    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount:   0,
    }));

    try {
      const { db } = await import('@/lib/firebase/config');
      const {
        collection, query, where, getDocs, writeBatch, doc,
      } = await import('firebase/firestore');

      const snap = await getDocs(
        query(
          collection(db, 'notifications'),
          where('userId',  '==', userId),
          where('isRead',  '==', false),
        ),
      );

      if (snap.empty) return;

      // Batch update — Firestore allows max 500 ops per batch
      const BATCH_SIZE = 490;
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        snap.docs
          .slice(i, i + BATCH_SIZE)
          .forEach((d) =>
            batch.update(doc(db, 'notifications', d.id), { isRead: true }),
          );
        await batch.commit();
      }
    } catch (err) {
      console.error('[notificationStore] markAllRead:', err.message);
    }
  },
}));