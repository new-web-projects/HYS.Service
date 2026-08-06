/**
 * withdrawalStore.js — Part 8: Worker Withdrawal System
 *
 * Rules:
 *   - Minimum withdrawal: ₹1000
 *   - Maximum withdrawal: ₹20,000
 *   - Must be a multiple of ₹1000
 *   - Processing fee is fetched from Firestore settings/platform (admin-controlled)
 *   - Fee already includes GST — never add GST separately
 *
 * Status lifecycle:
 *   pending → processing → completed | rejected
 */

import { create } from 'zustand';

// ── Constants ──────────────────────────────────────────────────────────────────
export const WITHDRAWAL_MIN          = 1000;
export const WITHDRAWAL_MAX          = 20000;
export const WITHDRAWAL_STEP         = 1000;
export const DEFAULT_PROCESSING_FEE_PERCENT = 11; // 11% includes GST

/**
 * Validate a withdrawal amount.
 * Returns null if valid, or an error string if invalid.
 */
export function validateWithdrawalAmount(amount, availableBalance) {
  const n = Number(amount);
  if (!n || isNaN(n))                     return 'Please enter a withdrawal amount.';
  if (n % WITHDRAWAL_STEP !== 0)
    return `Amount must be a multiple of ₹${WITHDRAWAL_STEP.toLocaleString('en-IN')} (e.g. ₹1000, ₹2000, ₹3000).`;
  if (n < WITHDRAWAL_MIN)
    return `Minimum withdrawal amount is ₹${WITHDRAWAL_MIN.toLocaleString('en-IN')}.`;
  if (n > WITHDRAWAL_MAX)
    return `Maximum withdrawal amount is ₹${WITHDRAWAL_MAX.toLocaleString('en-IN')}.`;
  if (n > availableBalance)
    return `Insufficient balance. Available: ₹${Math.floor(availableBalance / WITHDRAWAL_STEP) * WITHDRAWAL_STEP === 0 ? 0 : Math.floor(availableBalance / WITHDRAWAL_STEP) * WITHDRAWAL_STEP} (must be a multiple of ₹${WITHDRAWAL_STEP}).`;
  return null;
}

/**
 * Calculate processing fee and final receivable amount.
 * feePercent comes from Firestore settings — admin-controlled.
 * Fee already includes GST. Never add GST separately.
 */
export function calculateWithdrawalFee(amount, feePercent = DEFAULT_PROCESSING_FEE_PERCENT) {
  const n           = Math.max(0, Number(amount) || 0);
  const pct         = Math.max(0, Number(feePercent) || DEFAULT_PROCESSING_FEE_PERCENT);
  const fee         = parseFloat((n * pct / 100).toFixed(2));
  const receivable  = parseFloat((n - fee).toFixed(2));
  return { withdrawalAmount: n, processingFee: fee, feePercent: pct, receivable };
}

function normalizeWithdrawal(docSnap) {
  const d = docSnap.data();
  return {
    id:              docSnap.id,
    workerId:        d.workerId        ?? '',
    workerName:      d.workerName      ?? '',
    amount:          d.amount          ?? 0,
    processingFee:   d.processingFee   ?? 0,
    feePercent:      d.feePercent      ?? DEFAULT_PROCESSING_FEE_PERCENT,
    receivable:      d.receivable      ?? 0,
    method:          d.method          ?? 'upi',  // 'upi' | 'bank'
    // UPI
    upiId:           d.upiId           ?? null,
    // Bank
    accountHolderName: d.accountHolderName ?? null,
    bankName:          d.bankName          ?? null,
    accountNumber:     d.accountNumber     ?? null,
    ifscCode:          d.ifscCode          ?? null,
    status:            d.status            ?? 'pending', // pending|processing|completed|rejected
    rejectionReason:   d.rejectionReason   ?? null,
    adminNote:         d.adminNote         ?? null,
    createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? null,
    processedAt: d.processedAt?.toDate?.()?.toISOString?.() ?? d.processedAt ?? null,
  };
}

export const useWithdrawalStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  withdrawals:        [],
  withdrawalsLoading: false,
  withdrawalsError:   null,
  _unsubWithdrawals:  null,

  // Platform processing fee (loaded from Firestore settings/platform)
  processingFeePercent: DEFAULT_PROCESSING_FEE_PERCENT,

  // ── Subscribe to worker's withdrawals ─────────────────────────────────────

  async subscribeWithdrawals(workerId) {
    if (!workerId) return;
    get()._unsubWithdrawals?.();
    set({ withdrawalsLoading: true, withdrawalsError: null });

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, onSnapshot,
    } = await import('firebase/firestore');

    const safetyTimer = setTimeout(() => set({ withdrawalsLoading: false }), 6000);

    const unsub = onSnapshot(
      query(
        collection(db, 'withdrawals'),
        where('workerId', '==', workerId),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        clearTimeout(safetyTimer);
        set({
          withdrawals:        snap.docs.map(normalizeWithdrawal),
          withdrawalsLoading: false,
          withdrawalsError:   null,
        });
      },
      (err) => {
        clearTimeout(safetyTimer);
        console.error('[withdrawalStore] subscribeWithdrawals:', err.message);
        set({ withdrawalsLoading: false, withdrawalsError: err.message });
      },
    );

    set({ _unsubWithdrawals: () => { unsub(); clearTimeout(safetyTimer); } });
  },

  unsubscribeWithdrawals() {
    get()._unsubWithdrawals?.();
    set({ _unsubWithdrawals: null, withdrawals: [], withdrawalsError: null });
  },

  // ── Load processing fee from Firestore settings ───────────────────────────

  async loadProcessingFee() {
    try {
      const { db }      = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      const snap        = await getDoc(doc(db, 'settings', 'platform'));
      if (snap.exists()) {
        const fee = snap.data().withdrawalFee ?? DEFAULT_PROCESSING_FEE_PERCENT;
        set({ processingFeePercent: fee });
        return fee;
      }
    } catch (err) {
      console.warn('[withdrawalStore] loadProcessingFee:', err.message);
    }
    return DEFAULT_PROCESSING_FEE_PERCENT;
  },

  // ── Request withdrawal ────────────────────────────────────────────────────
  //
  // Validates amount, marks the relevant earningsList entries as
  // 'pending_withdrawal', creates the withdrawal request doc.

  async requestWithdrawal({
    workerId,
    workerName,
    amount,
    method,   // 'upi' | 'bank'
    upiId,
    accountHolderName,
    bankName,
    accountNumber,
    ifscCode,
    availableBalance,
  }) {
    // ── Client-side validation ─────────────────────────────────────────────
    const amountErr = validateWithdrawalAmount(amount, availableBalance);
    if (amountErr) throw new Error(amountErr);

    if (method === 'upi') {
      if (!upiId?.trim()) throw new Error('Please enter your UPI ID.');
      if (!/^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim()))
        throw new Error('Please enter a valid UPI ID (e.g. name@upi).');
    } else {
      if (!accountHolderName?.trim()) throw new Error('Account holder name is required.');
      if (!bankName?.trim())          throw new Error('Bank name is required.');
      if (!accountNumber?.trim())     throw new Error('Account number is required.');
      if (!/^\d{9,18}$/.test(accountNumber.trim()))
        throw new Error('Account number must be 9–18 digits.');
      if (!ifscCode?.trim())          throw new Error('IFSC code is required.');
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase()))
        throw new Error('Invalid IFSC code format (e.g. HDFC0001234).');
    }

    const { db } = await import('@/lib/firebase/config');
    const {
      collection, query, where, orderBy, getDocs,
      addDoc, writeBatch, doc, Timestamp,
    } = await import('firebase/firestore');
    // BUG FIX: `orderBy` is used below (oldest-earnings-first query) but was
    // missing from this destructure, so every withdrawal request threw
    // "orderBy is not defined" as soon as it reached that query.

    // Block if there is already a pending withdrawal
    const pendingSnap = await getDocs(
      query(
        collection(db, 'withdrawals'),
        where('workerId', '==', workerId),
        where('status',   '==', 'pending'),
      ),
    );
    if (!pendingSnap.empty) {
      throw new Error('You already have a pending withdrawal request. Wait for it to be processed before requesting again.');
    }

    // ── Calculate fee using current platform rate ─────────────────────────
    const feePercent = get().processingFeePercent;
    const { processingFee, receivable } = calculateWithdrawalFee(amount, feePercent);

    const now = Timestamp.now();
    const batch = writeBatch(db);

    // Mark enough 'available' earnings as 'pending_withdrawal'
    const earningsSnap = await getDocs(
      query(
        collection(db, 'workerEarnings'),
        where('workerId', '==', workerId),
        where('status',   '==', 'available'),
        orderBy('createdAt', 'asc'), // oldest first
      ),
    );

    let remaining = amount;
    const lockedEarningIds = [];

    for (const earningDoc of earningsSnap.docs) {
      if (remaining <= 0) break;
      const earningAmount = earningDoc.data().baseAmount ?? 0;
      batch.update(doc(db, 'workerEarnings', earningDoc.id), {
        status:    'pending_withdrawal',
        updatedAt: now,
      });
      lockedEarningIds.push(earningDoc.id);
      remaining -= earningAmount;
    }

    // Create the withdrawal request
    const withdrawalRef = doc(collection(db, 'withdrawals'));
    const payload = {
      workerId,
      workerName,
      amount,
      processingFee,
      feePercent,
      receivable,
      method,
      status:    'pending',
      earningIds: lockedEarningIds,
      createdAt: now,
      updatedAt: now,
      // UPI fields
      upiId:    method === 'upi' ? upiId.trim() : null,
      // Bank fields
      accountHolderName: method === 'bank' ? accountHolderName.trim() : null,
      bankName:          method === 'bank' ? bankName.trim()          : null,
      accountNumber:     method === 'bank' ? accountNumber.trim()     : null,
      ifscCode:          method === 'bank' ? ifscCode.trim().toUpperCase() : null,
    };

    batch.set(withdrawalRef, payload);
    await batch.commit();

    return withdrawalRef.id;
  },

  // ── Cancel pending withdrawal (worker) ────────────────────────────────────

  async cancelWithdrawal(withdrawalId, workerId) {
    const { db } = await import('@/lib/firebase/config');
    const {
      doc, getDoc, writeBatch, collection,
      query, where, getDocs, Timestamp,
    } = await import('firebase/firestore');

    const snap = await getDoc(doc(db, 'withdrawals', withdrawalId));
    if (!snap.exists()) throw new Error('Withdrawal not found.');

    const data = snap.data();
    if (data.workerId !== workerId) throw new Error('Unauthorised.');
    if (data.status !== 'pending')
      throw new Error('Only pending withdrawals can be cancelled.');

    const batch = writeBatch(db);
    const now   = Timestamp.now();

    // Restore earnings to 'available'
    for (const earningId of (data.earningIds ?? [])) {
      batch.update(doc(db, 'workerEarnings', earningId), {
        status:    'available',
        updatedAt: now,
      });
    }

    batch.update(doc(db, 'withdrawals', withdrawalId), {
      status:    'cancelled',
      updatedAt: now,
    });

    await batch.commit();
  },
}));