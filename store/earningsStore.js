/**
 * earningsStore.js — Part 7: Worker Earnings System
 *
 * Subscribes to the workerEarnings collection in real-time and provides:
 *   - totalEarnings      — lifetime sum of all paid earnings
 *   - availableBalance   — sum of earnings with status 'available' (OTP verified, not yet withdrawn)
 *   - pendingWithdrawal  — sum of earnings currently in a withdrawal request
 *   - completedWithdrawals — sum of all successfully withdrawn amounts
 *   - earningsList       — individual earning entries for history display
 *
 * Earnings status lifecycle:
 *   locked → (OTP verified) → available → (withdrawal requested) →
 *   pending_withdrawal → (admin approves) → withdrawn
 */

import { create } from 'zustand';

function normalizeEarning(docSnap) {
  const d = docSnap.data();
  return {
    id:           docSnap.id,
    workerId:     d.workerId     ?? '',
    bookingId:    d.bookingId    ?? '',
    customerId:   d.customerId   ?? '',
    customerName: d.customerName ?? '',
    categoryName: d.categoryName ?? '',
    baseAmount:   d.baseAmount   ?? 0,   // amount worker receives
    platformFee:  d.platformFee  ?? 0,
    gstAmount:    d.gstAmount    ?? 0,
    totalPaid:    d.totalPaid    ?? 0,   // total customer paid
    status:       d.status       ?? 'locked',  // locked | available | pending_withdrawal | withdrawn
    paymentRef:   d.paymentRef   ?? null,
    paidAt:       d.paidAt?.toDate?.()?.toISOString()    ?? d.paidAt    ?? null,
    unlockedAt:   d.unlockedAt?.toDate?.()?.toISOString?.() ?? d.unlockedAt ?? null,
    createdAt:    d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? null,
  };
}

/**
 * BUG FIX: totalEarnings/availableBalance/pendingWithdrawal/
 * completedWithdrawals/lockedBalance used to be implemented as ES6 getters
 * on the Zustand state object (`get totalEarnings() {...}`, etc).
 *
 * Zustand's `set(partial)` merges the next state via
 * `Object.assign({}, state, partial)`. Object.assign *evaluates* any getter
 * on the source object and copies the resulting value onto the target as a
 * plain, static property — it does not copy the getter itself. That happens
 * on the very first `set()` call in subscribeEarnings (the
 * `earningsLoading: true` call, which runs before any real data has
 * loaded), which permanently freezes every one of these values at 0. They
 * never recompute again no matter how earningsList changes afterwards —
 * which is why the worker dashboard's balance cards and the "Request
 * Withdrawal" button (gated on availableBalance >= WITHDRAWAL_MIN) always
 * showed/behaved as if the worker had earned nothing.
 *
 * Fix: compute these explicitly as plain data whenever earningsList
 * changes, and set them in the same set() call as earningsList so they're
 * never allowed to go stale.
 */
function computeEarningsAggregates(list) {
  const sumWhere = (pred) =>
    list.filter(pred).reduce((sum, e) => sum + (e.baseAmount ?? 0), 0);

  return {
    totalEarnings:        sumWhere((e) => e.status !== 'locked'),
    availableBalance:     sumWhere((e) => e.status === 'available'),
    pendingWithdrawal:    sumWhere((e) => e.status === 'pending_withdrawal'),
    completedWithdrawals: sumWhere((e) => e.status === 'withdrawn'),
    lockedBalance:        sumWhere((e) => e.status === 'locked'),
  };
}

export const useEarningsStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────────────────
  earningsList:          [],
  earningsLoading:       false,
  earningsError:         null,
  _unsubEarnings:        null,

  // ── Balance aggregates ───────────────────────────────────────────────────
  // Plain state fields (see computeEarningsAggregates / BUG FIX note above),
  // recomputed and included alongside earningsList on every update instead
  // of being derived getters.
  totalEarnings:         0,
  availableBalance:      0,
  pendingWithdrawal:     0,
  completedWithdrawals:  0,
  lockedBalance:         0,

  // ── Subscribe to worker's earnings ────────────────────────────────────────

  async subscribeEarnings(workerId) {
    if (!workerId) return;

    // Tear down existing listener
    get()._unsubEarnings?.();
    set({ earningsLoading: true, earningsError: null });

    const { db }    = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, onSnapshot,
    } = await import('firebase/firestore');

    const safetyTimer = setTimeout(
      () => set({ earningsLoading: false }),
      6000,
    );

    const unsub = onSnapshot(
      query(
        collection(db, 'workerEarnings'),
        where('workerId', '==', workerId),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        clearTimeout(safetyTimer);
        const earningsList = snap.docs.map(normalizeEarning);
        set({
          earningsList,
          earningsLoading: false,
          earningsError:   null,
          ...computeEarningsAggregates(earningsList),
        });
      },
      (err) => {
        clearTimeout(safetyTimer);
        console.error('[earningsStore] subscribeEarnings:', err.message);
        set({ earningsLoading: false, earningsError: err.message });
      },
    );

    set({ _unsubEarnings: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeEarnings() {
    get()._unsubEarnings?.();
    set({
      _unsubEarnings: null,
      earningsList:   [],
      earningsError:  null,
      ...computeEarningsAggregates([]),
    });
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Returns earnings grouped by month for the history chart.
   * Only includes 'available' and 'withdrawn' entries (OTP-verified jobs).
   * @param {number} [months=6]
   */
  getMonthlyHistory(months = 6) {
    const list   = get().earningsList;
    const map    = new Map();

    list
      .filter((e) => e.status === 'available' || e.status === 'withdrawn')
      .forEach((e) => {
        const dt    = new Date(e.unlockedAt ?? e.paidAt ?? e.createdAt);
        const key   = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const label = dt.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        map.set(key, {
          label,
          amount: (map.get(key)?.amount ?? 0) + (e.baseAmount ?? 0),
          count:  (map.get(key)?.count  ?? 0) + 1,
        });
      });

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-months)
      .map(([, v]) => v);
  },
}));