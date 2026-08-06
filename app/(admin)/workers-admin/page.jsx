'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUserStore }                 from '@/store/userStore';
import { useToast }                     from '@/components/shared/Toast';
import LoadingSpinner                   from '@/components/shared/LoadingSpinner';
import { VerifiedIcon, RefreshIcon, StarIcon } from '@/components/icons';

const DOC_TYPES = [
  { key: 'pan',     label: 'PAN'     },
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'workId',  label: 'Work ID' },
];

const DOC_STATUS_STYLES = {
  verified: { label: 'Verified', cls: 'bg-green-100 text-green-700 border-green-200' },
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-100   text-red-600   border-red-200'   },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Document review panel ─────────────────────────────────────────────────────
function DocReviewPanel({ worker, onStatusChange }) {
  const docs = worker.documents ?? {};
  const hasAny = DOC_TYPES.some(({ key }) => docs[key]?.url);

  if (!hasAny) {
    return (
      <p className="text-admin-muted text-xs italic">No documents uploaded</p>
    );
  }

  return (
    <div className="space-y-2">
      {DOC_TYPES.map(({ key, label }) => {
        const doc = docs[key];
        if (!doc?.url) return null;

        const statusInfo =
          DOC_STATUS_STYLES[doc.status] ?? DOC_STATUS_STYLES.pending;

        return (
          <div key={key}
               className="flex items-center gap-3 flex-wrap">
            {/* Label + current status */}
            <div className="flex items-center gap-2 min-w-[140px]">
              <span className="text-admin-text text-xs font-semibold">{label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                                border ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>

            {/* View document */}
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 text-xs font-medium hover:underline"
            >
              View ↗
            </a>

            {/* Approve / Reject buttons */}
            {doc.status !== 'verified' && (
              <button
                onClick={() => onStatusChange(worker.id, key, 'verified')}
                className="px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/30
                           text-green-400 text-xs font-semibold hover:bg-green-500/20
                           transition-colors"
              >
                Approve
              </button>
            )}
            {doc.status !== 'rejected' && (
              <button
                onClick={() => onStatusChange(worker.id, key, 'rejected')}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30
                           text-red-400 text-xs font-semibold hover:bg-red-500/20
                           transition-colors"
              >
                Reject
              </button>
            )}

            {doc.uploadedAt && (
              <span className="text-admin-muted text-[10px] ml-auto">
                {formatDate(doc.uploadedAt)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkersAdminPage() {
  const {
    allWorkers,
    allWorkersLoading,
    fetchAllWorkers,
    verifyWorker,
    setWorkerAvailability,
    updateDocumentStatus,
  } = useUserStore();
  const toast = useToast((s) => s.show);

  const [search,       setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | verified | unverified | pending_docs
  const [verifyingId,  setVerifyingId]  = useState(null);
  const [togglingId,   setTogglingId]   = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);

  useEffect(() => {
    fetchAllWorkers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = [...allWorkers];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.name?.toLowerCase().includes(q)         ||
          w.email?.toLowerCase().includes(q)        ||
          w.categoryName?.toLowerCase().includes(q),
      );
    }

    switch (filterStatus) {
      case 'verified':
        list = list.filter((w) => w.isVerified);
        break;
      case 'unverified':
        list = list.filter((w) => !w.isVerified);
        break;
      case 'pending_docs':
        list = list.filter((w) =>
          Object.values(w.documents ?? {}).some((d) => d?.status === 'pending'),
        );
        break;
      default:
        break;
    }

    return list;
  }, [allWorkers, search, filterStatus]);

  const pendingDocCount = useMemo(
    () =>
      allWorkers.filter((w) =>
        Object.values(w.documents ?? {}).some((d) => d?.status === 'pending'),
      ).length,
    [allWorkers],
  );

  async function handleVerify(worker) {
    if (worker.isVerified) return;
    setVerifyingId(worker.id);
    try {
      await verifyWorker(worker.id);
      toast(`${worker.name} is now verified.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Verification failed.', 'error');
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleToggleAvailability(worker) {
    setTogglingId(worker.id);
    try {
      await setWorkerAvailability(worker.id, !worker.isAvailable);
      toast(
        `${worker.name} is now ${!worker.isAvailable ? 'available' : 'unavailable'}.`,
        'success',
      );
    } catch (err) {
      toast(err.message ?? 'Update failed.', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDocStatus(workerId, docKey, status) {
    try {
      await updateDocumentStatus(workerId, docKey, status);
      toast(
        `Document ${status === 'verified' ? 'approved' : 'rejected'}.`,
        status === 'verified' ? 'success' : 'info',
      );
    } catch (err) {
      toast(err.message ?? 'Update failed.', 'error');
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Workers</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {allWorkers.length} worker{allWorkers.length !== 1 ? 's' : ''} registered
            {pendingDocCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5
                               rounded-full bg-amber-500/15 text-amber-400 text-xs
                               font-semibold border border-amber-500/20">
                {pendingDocCount} pending doc{pendingDocCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchAllWorkers}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-card border
                     border-admin-border rounded-xl text-admin-muted
                     hover:text-admin-text text-sm font-medium transition-colors"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, category…"
            className="w-full pl-9 pr-4 py-2.5 bg-admin-card border border-admin-border
                       rounded-xl text-admin-text text-sm placeholder-admin-muted/40
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 bg-admin-card border border-admin-border rounded-xl
                     text-admin-text text-sm focus:outline-none focus:ring-2
                     focus:ring-brand-500"
        >
          <option value="all">All workers</option>
          <option value="verified">Verified only</option>
          <option value="unverified">Unverified only</option>
          <option value="pending_docs">Pending documents</option>
        </select>
      </div>

      {/* Loading */}
      {allWorkersLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading workers…" />
        </div>
      )}

      {/* Empty */}
      {!allWorkersLoading && filtered.length === 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <p className="text-admin-muted">
            {search ? `No workers matching "${search}"` : 'No workers found'}
          </p>
        </div>
      )}

      {/* Worker cards */}
      {!allWorkersLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((worker) => {
            const isExpanded     = expandedId === worker.id;
            const hasAnyDocs     = DOC_TYPES.some(
              ({ key }) => worker.documents?.[key]?.url,
            );
            const hasPendingDocs = DOC_TYPES.some(
              ({ key }) => worker.documents?.[key]?.status === 'pending',
            );

            return (
              <div
                key={worker.id}
                className={`bg-admin-card border rounded-2xl overflow-hidden
                            transition-colors
                            ${hasPendingDocs
                              ? 'border-amber-500/30'
                              : 'border-admin-border'}`}
              >
                {/* Main row */}
                <div className="flex items-start gap-4 p-5">

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-admin-bg
                                  shrink-0 flex items-center justify-center
                                  text-admin-text font-bold text-lg">
                    {worker.profileImageUrl ? (
                      <img src={worker.profileImageUrl} alt={worker.name}
                           className="w-full h-full object-cover" />
                    ) : (
                      (worker.name || 'W')[0].toUpperCase()
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-admin-text">{worker.name}</h3>
                      {worker.isVerified && (
                        <VerifiedIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      {hasPendingDocs && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15
                                         text-amber-400 text-[10px] font-bold
                                         border border-amber-500/20">
                          DOCS PENDING
                        </span>
                      )}
                    </div>
                    <p className="text-admin-muted text-sm">
                      {worker.email}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs
                                    text-admin-muted">
                      <span>{worker.categoryName || '—'}</span>
                      <span className={`flex items-center gap-1
                                        ${worker.isAvailable
                                          ? 'text-green-400'
                                          : 'text-admin-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full
                                          ${worker.isAvailable
                                            ? 'bg-green-400'
                                            : 'bg-admin-muted'}`} />
                        {worker.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                      <span className="flex items-center gap-1">
                        <StarIcon className="w-3.5 h-3.5 text-amber-400" filled />
                        {(worker.rating ?? 0).toFixed(1)}
                        ({worker.reviewCount ?? 0})
                      </span>
                      <span>{worker.ordersCompleted ?? 0} jobs</span>
                      {(worker.experienceYears ?? 0) > 0 && (
                        <span>{worker.experienceYears}yr exp</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">

                    {/* Verify */}
                    {!worker.isVerified && (
                      <button
                        onClick={() => handleVerify(worker)}
                        disabled={verifyingId === worker.id}
                        className="px-3 py-1.5 rounded-lg bg-brand-600/15 border
                                   border-brand-500/30 text-brand-400 text-xs
                                   font-semibold hover:bg-brand-600/25 transition-colors
                                   disabled:opacity-40"
                      >
                        {verifyingId === worker.id ? 'Verifying…' : 'Verify Worker'}
                      </button>
                    )}

                    {/* Availability toggle */}
                    <button
                      onClick={() => handleToggleAvailability(worker)}
                      disabled={togglingId === worker.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold
                                  border transition-colors disabled:opacity-40
                                  ${worker.isAvailable
                                    ? 'bg-admin-bg border-admin-border text-admin-muted hover:border-red-500/30 hover:text-red-400'
                                    : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'}`}
                    >
                      {togglingId === worker.id
                        ? 'Updating…'
                        : worker.isAvailable
                        ? 'Disable'
                        : 'Enable'}
                    </button>

                    {/* Expand documents */}
                    {hasAnyDocs && (
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : worker.id)
                        }
                        className="px-3 py-1.5 rounded-lg bg-admin-bg border
                                   border-admin-border text-admin-muted text-xs
                                   font-semibold hover:text-admin-text
                                   transition-colors"
                      >
                        {isExpanded ? 'Hide Docs' : 'Review Docs'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Document review section (expandable) */}
                {isExpanded && (
                  <div className="border-t border-admin-border px-5 py-4 bg-admin-bg">
                    <p className="text-xs font-bold text-admin-muted uppercase
                                   tracking-widest mb-3">
                      Document Verification
                    </p>
                    <DocReviewPanel
                      worker={worker}
                      onStatusChange={handleDocStatus}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}