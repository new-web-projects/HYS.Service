'use client';

import { useEffect, useState, useMemo } from 'react';
import { useJobRequestStore }           from '@/store/jobRequestStore';
import LoadingSpinner                   from '@/components/shared/LoadingSpinner';
import { formatPrice }                  from '@/lib/pricing';
import { RefreshIcon, SearchIcon, BookingIcon } from '@/components/icons';

const STATUS_STYLES = {
  open:     { label: 'Open',     cls: 'bg-amber-500/10  text-amber-400  border-amber-500/20'  },
  quoted:   { label: 'Quoted',   cls: 'bg-blue-500/10   text-blue-400   border-blue-500/20'   },
  accepted: { label: 'Accepted', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  closed:   { label: 'Closed',  cls: 'bg-gray-500/10   text-gray-400   border-gray-500/20'   },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function AdminJobRequestsPage() {
  const {
    allRequests, allRequestsLoading, fetchAllRequests,
  } = useJobRequestStore();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAllRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() =>
    allRequests.filter((r) => {
      const matchSearch =
        !search ||
        r.customerName.toLowerCase().includes(search.toLowerCase()) ||
        r.categoryName.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [allRequests, search, statusFilter],
  );

  const counts = {
    open:     allRequests.filter((r) => r.status === 'open').length,
    quoted:   allRequests.filter((r) => r.status === 'quoted').length,
    accepted: allRequests.filter((r) => r.status === 'accepted').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Job Requests</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {allRequests.length} total requests across the platform
          </p>
        </div>
        <button
          onClick={fetchAllRequests}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-card
                     border border-admin-border rounded-xl text-admin-muted
                     hover:text-admin-text text-sm font-medium transition-colors"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: allRequests.length,  color: 'text-admin-text' },
          { label: 'Open',           value: counts.open,          color: 'text-amber-400'  },
          { label: 'Receiving Quotes', value: counts.quoted,      color: 'text-blue-400'   },
          { label: 'Accepted',       value: counts.accepted,      color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-admin-card border border-admin-border rounded-2xl p-5">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-admin-muted text-xs font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, category, description…"
            className="w-full pl-9 pr-4 py-2.5 bg-admin-card border border-admin-border
                       rounded-xl text-admin-text text-sm placeholder-admin-muted/40
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-admin-card border border-admin-border rounded-xl
                     text-admin-text text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="quoted">Receiving Quotes</option>
          <option value="accepted">Accepted</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Loading */}
      {allRequestsLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading job requests…" />
        </div>
      )}

      {/* Empty */}
      {!allRequestsLoading && filtered.length === 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <BookingIcon className="w-12 h-12 mb-4 mx-auto text-admin-muted/40" />
          <p className="text-admin-muted">
            {search ? 'No requests match the search' : 'No job requests yet'}
          </p>
        </div>
      )}

      {/* Table */}
      {!allRequestsLoading && filtered.length > 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border">
                  {['Customer', 'Category', 'Description', 'Budget', 'Quotes', 'Status', 'Posted'].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-semibold text-admin-muted uppercase
                                   tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-medium text-admin-text">
                      {req.customerName}
                    </td>
                    <td className="px-5 py-4 text-admin-muted">
                      {req.categoryName}
                    </td>
                    <td className="px-5 py-4 text-admin-muted max-w-[200px]">
                      <p className="truncate text-xs">{req.description}</p>
                    </td>
                    <td className="px-5 py-4 text-admin-muted">
                      {req.budget ? formatPrice(req.budget) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-admin-text font-semibold">
                        {req.quotesCount}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                                        ${STATUS_STYLES[req.status]?.cls ?? STATUS_STYLES.open.cls}`}>
                        {STATUS_STYLES[req.status]?.label ?? req.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-admin-muted text-xs whitespace-nowrap">
                      {formatDate(req.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}