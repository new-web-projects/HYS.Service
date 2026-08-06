'use client';

import { useEffect, useState }  from 'react';
import { useBookingStore }      from '@/store/bookingStore';
import LoadingSpinner           from '@/components/shared/LoadingSpinner';
import { formatPrice }          from '@/lib/payment';
import { BookingIcon, ClockIcon, CheckIcon, PaymentIcon } from '@/components/icons';

const STATUS_STYLES = {
  pending:     'bg-amber-500/10  text-amber-400  border-amber-500/20',
  accepted:    'bg-blue-500/10   text-blue-400   border-blue-500/20',
  in_progress: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  completed:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled:   'bg-gray-500/10   text-gray-400   border-gray-500/20',
};

const STATUS_LABELS = {
  pending: 'Pending', accepted: 'Accepted', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled',
};

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

export default function AdminBookingsPage() {
  const { allBookings, allBookingsLoading, fetchAllBookings } = useBookingStore();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAllBookings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = allBookings.filter((b) => {
    const matchSearch =
      !search ||
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.workerName.toLowerCase().includes(search.toLowerCase()) ||
      b.categoryName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const revenue       = allBookings
    .filter((b) => b.paymentStatus === 'paid')
    .reduce((sum, b) => sum + (b.priceQuoted ?? 0), 0);
  const completedCount = allBookings.filter((b) => b.status === 'completed').length;
  const pendingCount   = allBookings.filter((b) => b.status === 'pending_chat').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Bookings</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {allBookings.length} total booking{allBookings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={fetchAllBookings}
                className="px-4 py-2.5 bg-admin-card border border-admin-border rounded-xl
                           text-admin-muted hover:text-admin-text text-sm font-medium transition-colors">
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings',    value: allBookings.length, icon: <BookingIcon className="w-6 h-6" /> },
          { label: 'Pending',           value: pendingCount,        icon: <ClockIcon className="w-6 h-6" /> },
          { label: 'Completed',         value: completedCount,      icon: <CheckIcon className="w-6 h-6" /> },
          { label: 'Platform Revenue',  value: formatPrice(revenue), icon: <PaymentIcon className="w-6 h-6" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-admin-card border border-admin-border rounded-2xl p-5">
            <div className="mb-2 text-admin-muted">{icon}</div>
            <p className="text-2xl font-bold text-admin-text">{value}</p>
            <p className="text-admin-muted text-xs font-medium mt-0.5">{label}</p>
          </div>
        ))}
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
            placeholder="Search customer, worker, category…"
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
          {Object.entries(STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {allBookingsLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading bookings…" />
        </div>
      )}

      {/* Empty */}
      {!allBookingsLoading && filtered.length === 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <BookingIcon className="w-12 h-12 mb-4 mx-auto text-admin-muted/40" />
          <p className="text-admin-muted">
            {search ? 'No bookings match the search' : 'No bookings yet'}
          </p>
        </div>
      )}

      {/* Table */}
      {!allBookingsLoading && filtered.length > 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border">
                  {['Customer', 'Worker', 'Category', 'Scheduled', 'Amount', 'Status', 'Payment'].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-semibold text-admin-muted uppercase
                                   tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {filtered.map((booking) => (
                  <tr key={booking.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-medium text-admin-text max-w-[120px] truncate">
                      {booking.customerName}
                    </td>
                    <td className="px-5 py-4 text-admin-muted max-w-[120px] truncate">
                      {booking.workerName}
                    </td>
                    <td className="px-5 py-4 text-admin-muted text-xs">
                      {booking.categoryName}
                    </td>
                    <td className="px-5 py-4 text-admin-muted text-xs whitespace-nowrap">
                      {formatDateTime(booking.scheduledAt)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-admin-text">
                      {booking.priceQuoted > 0
                        ? formatPrice(booking.priceQuoted)
                        : <span className="text-admin-muted font-medium">To be discussed</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                                        ${STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending}`}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold
                                        ${booking.paymentStatus === 'paid'
                                          ? 'text-emerald-400'
                                          : booking.paymentStatus === 'refunded'
                                          ? 'text-gray-400'
                                          : 'text-red-400/70'}`}>
                        {booking.paymentStatus}
                      </span>
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