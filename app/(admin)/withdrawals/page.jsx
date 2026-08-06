'use client';

/**
 * app/(admin)/withdrawals/page.jsx
 *
 * Admin Withdrawal Management — Part 11
 *
 * Shows all worker withdrawal requests with full payment + bank details.
 * Admin can approve (mark processing → completed) or reject with a reason.
 * Approval marks linked workerEarnings as 'withdrawn'.
 */

import { useEffect, useState, useMemo } from 'react';
import { useToast }                      from '@/components/shared/Toast';
import LoadingSpinner                    from '@/components/shared/LoadingSpinner';
import { formatPrice }                   from '@/lib/pricing';
import { PaymentIcon, CheckIcon, XIcon, SearchIcon } from '@/components/icons';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:    { label: 'Pending',    cls: 'bg-amber-100  text-amber-700'  },
  processing: { label: 'Processing', cls: 'bg-blue-100   text-blue-700'   },
  completed:  { label: 'Completed',  cls: 'bg-green-100  text-green-700'  },
  rejected:   { label: 'Rejected',   cls: 'bg-red-100    text-red-600'    },
  cancelled:  { label: 'Cancelled',  cls: 'bg-gray-100   text-gray-500'   },
};

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function fetchWithdrawals(statusFilter = 'all') {
  const { db } = await import('@/lib/firebase/config');
  const {
    collection, query, where, orderBy, getDocs,
  } = await import('firebase/firestore');

  const constraints = [orderBy('createdAt', 'desc')];
  if (statusFilter !== 'all') {
    constraints.unshift(where('status', '==', statusFilter));
  }

  const snap = await getDocs(query(collection(db, 'withdrawals'), ...constraints));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id:                d.id,
      workerId:          data.workerId          ?? '',
      workerName:        data.workerName        ?? '',
      amount:            data.amount            ?? 0,
      processingFee:     data.processingFee     ?? 0,
      feePercent:        data.feePercent        ?? 11,
      receivable:        data.receivable        ?? 0,
      method:            data.method            ?? 'upi',
      upiId:             data.upiId             ?? null,
      accountHolderName: data.accountHolderName ?? null,
      bankName:          data.bankName          ?? null,
      accountNumber:     data.accountNumber     ?? null,
      ifscCode:          data.ifscCode          ?? null,
      status:            data.status            ?? 'pending',
      rejectionReason:   data.rejectionReason   ?? null,
      adminNote:         data.adminNote         ?? null,
      earningIds:        data.earningIds        ?? [],
      createdAt:         data.createdAt?.toDate?.()?.toISOString() ?? null,
      processedAt:       data.processedAt?.toDate?.()?.toISOString() ?? null,
    };
  });
}

async function approveWithdrawal(withdrawalId, earningIds) {
  const { db } = await import('@/lib/firebase/config');
  const { doc, writeBatch, Timestamp } = await import('firebase/firestore');

  const batch = writeBatch(db);
  const now   = Timestamp.now();

  batch.update(doc(db, 'withdrawals', withdrawalId), {
    status:      'completed',
    processedAt: now,
    updatedAt:   now,
  });

  for (const earningId of earningIds) {
    batch.update(doc(db, 'workerEarnings', earningId), {
      status:      'withdrawn',
      withdrawnAt: now,
      updatedAt:   now,
    });
  }

  await batch.commit();
}

async function rejectWithdrawal(withdrawalId, earningIds, reason) {
  const { db } = await import('@/lib/firebase/config');
  const { doc, writeBatch, Timestamp } = await import('firebase/firestore');

  const batch = writeBatch(db);
  const now   = Timestamp.now();

  batch.update(doc(db, 'withdrawals', withdrawalId), {
    status:          'rejected',
    rejectionReason: reason,
    processedAt:     now,
    updatedAt:       now,
  });

  // Restore earnings to 'available' so worker can request again
  for (const earningId of earningIds) {
    batch.update(doc(db, 'workerEarnings', earningId), {
      status:    'available',
      updatedAt: now,
    });
  }

  await batch.commit();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminWithdrawalsPage() {
  const toast = useToast((s) => s.show);

  const [withdrawals,   setWithdrawals]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [search,        setSearch]        = useState('');
  const [actionId,      setActionId]      = useState(null);
  const [rejectTarget,  setRejectTarget]  = useState(null); // { id, earningIds }
  const [rejectReason,  setRejectReason]  = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await fetchWithdrawals(statusFilter);
      setWithdrawals(data);
    } catch (err) {
      toast('Failed to load withdrawals: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return withdrawals;
    return withdrawals.filter(
      (w) =>
        w.workerName?.toLowerCase().includes(q) ||
        w.upiId?.toLowerCase().includes(q) ||
        w.bankName?.toLowerCase().includes(q) ||
        w.accountNumber?.includes(q) ||
        w.id.includes(q),
    );
  }, [withdrawals, search]);

  // ── Summary stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    pending:   withdrawals.filter((w) => w.status === 'pending').length,
    totalPending: withdrawals
      .filter((w) => w.status === 'pending')
      .reduce((s, w) => s + w.receivable, 0),
    totalProcessed: withdrawals
      .filter((w) => w.status === 'completed')
      .reduce((s, w) => s + w.receivable, 0),
    totalFees: withdrawals
      .filter((w) => w.status === 'completed')
      .reduce((s, w) => s + w.processingFee, 0),
  }), [withdrawals]);

  async function handleApprove(w) {
    setActionId(w.id);
    try {
      await approveWithdrawal(w.id, w.earningIds);
      toast(`Approved ₹${w.receivable.toLocaleString('en-IN')} for ${w.workerName}`, 'success');
      await load();
    } catch (err) {
      toast('Approval failed: ' + err.message, 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActionId(rejectTarget.id);
    try {
      await rejectWithdrawal(rejectTarget.id, rejectTarget.earningIds, rejectReason.trim());
      toast('Withdrawal rejected. Earnings restored to worker balance.', 'success');
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      toast('Rejection failed: ' + err.message, 'error');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text flex items-center gap-2.5">
            <PaymentIcon className="w-6 h-6 text-admin-muted" />
            Worker Withdrawals
          </h1>
          <p className="text-admin-muted text-sm mt-0.5">
            Review and process worker withdrawal requests
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-admin-card border border-admin-border text-admin-muted
                     rounded-xl text-sm hover:text-admin-text transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Requests', value: stats.pending,                  cls: 'text-amber-400',  sub: 'awaiting action'      },
          { label: 'Pending Amount',   value: formatPrice(stats.totalPending), cls: 'text-amber-400',  sub: 'to be paid out'       },
          { label: 'Total Paid Out',   value: formatPrice(stats.totalProcessed), cls: 'text-emerald-400', sub: 'completed withdrawals' },
          { label: 'Total Fees Earned', value: formatPrice(stats.totalFees),  cls: 'text-brand-400',  sub: 'processing fees'      },
        ].map(({ label, value, cls, sub }) => (
          <div key={label} className="bg-admin-card border border-admin-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-admin-muted mb-1">{label}</p>
            <p className={`text-xl font-extrabold ${cls}`}>{value}</p>
            <p className="text-admin-muted/60 text-xs mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="w-4 h-4 text-admin-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by worker, UPI ID, account…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-admin-bg border border-admin-border
                       text-admin-text text-sm placeholder-admin-muted/40 focus:outline-none
                       focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'processing', 'completed', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors
                ${statusFilter === s
                  ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                  : 'border-admin-border text-admin-muted hover:text-admin-text'}`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading withdrawals…" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <PaymentIcon className="w-12 h-12 text-admin-muted/30 mx-auto mb-3" />
          <p className="text-admin-muted font-medium">No withdrawal requests found</p>
          <p className="text-admin-muted/60 text-sm mt-1">
            {statusFilter !== 'all' ? 'Try a different status filter.' : 'Workers haven\'t requested any withdrawals yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => {
            const isActing = actionId === w.id;
            const cfg      = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.pending;

            return (
              <div key={w.id}
                   className="bg-admin-card border border-admin-border rounded-2xl p-5 space-y-4">

                {/* Top row */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="font-bold text-admin-text">{w.workerName}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-admin-muted text-xs mt-0.5">
                      ID: {w.id.slice(0, 12)}… ·{' '}
                      {w.createdAt ? new Date(w.createdAt).toLocaleString('en-IN') : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-admin-muted">Withdrawal amount</p>
                    <p className="text-2xl font-extrabold text-admin-text">{formatPrice(w.amount)}</p>
                  </div>
                </div>

                {/* Fee breakdown */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Withdrawal',     value: formatPrice(w.amount),        cls: 'text-admin-text'   },
                    { label: `Fee (${w.feePercent}%)`, value: `−${formatPrice(w.processingFee)}`, cls: 'text-amber-400' },
                    { label: 'Worker receives', value: formatPrice(w.receivable),   cls: 'text-emerald-400'  },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className="bg-admin-bg border border-admin-border
                                                rounded-xl p-3 text-center">
                      <p className="text-admin-muted text-xs mb-0.5">{label}</p>
                      <p className={`font-bold text-sm ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Payment details */}
                <div className="bg-admin-bg border border-admin-border rounded-xl p-4">
                  <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-2">
                    {w.method === 'upi' ? 'UPI Details' : 'Bank Account Details'}
                  </p>
                  {w.method === 'upi' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-admin-muted text-xs">UPI ID</span>
                      <span className="font-mono font-bold text-admin-text text-sm">
                        {w.upiId}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(w.upiId ?? '')}
                        className="text-xs text-brand-400 hover:text-brand-300"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {[
                        { label: 'Account Holder', value: w.accountHolderName },
                        { label: 'Bank',           value: w.bankName          },
                        { label: 'Account No.',    value: w.accountNumber     },
                        { label: 'IFSC',           value: w.ifscCode          },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-admin-muted text-xs">{label}</p>
                          <p className="font-mono font-semibold text-admin-text">
                            {value ?? '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rejection reason */}
                {w.rejectionReason && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                    <p className="text-red-400 text-xs">
                      <strong>Rejection reason:</strong> {w.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Admin actions */}
                {w.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(w)}
                      disabled={isActing}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white
                                 font-semibold text-sm rounded-xl transition-colors
                                 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isActing ? <LoadingSpinner size="xs" /> : <CheckIcon className="w-4 h-4" />}
                      Approve & Mark Completed
                    </button>
                    <button
                      onClick={() => { setRejectTarget({ id: w.id, earningIds: w.earningIds }); setRejectReason(''); }}
                      disabled={isActing}
                      className="flex-1 py-2.5 border-2 border-red-400 text-red-400
                                 font-semibold text-sm rounded-xl hover:bg-red-500/10
                                 transition-colors disabled:opacity-50
                                 flex items-center justify-center gap-2"
                    >
                      <XIcon className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-admin-card border border-admin-border rounded-2xl
                          shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-bold text-admin-text">Reject Withdrawal</h3>
            <p className="text-admin-muted text-sm">
              The worker's earnings will be restored to their available balance.
            </p>
            <div>
              <label className="block text-sm font-medium text-admin-muted mb-1.5">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Invalid UPI ID, account verification failed…"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-admin-bg border border-admin-border
                           text-admin-text text-sm resize-none focus:outline-none
                           focus:ring-2 focus:ring-brand-500 placeholder-admin-muted/40"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 py-3 border border-admin-border text-admin-muted
                           rounded-xl text-sm font-medium hover:text-admin-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || !!actionId}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold
                           rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {actionId ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
