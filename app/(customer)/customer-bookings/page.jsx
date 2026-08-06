'use client';

import { useEffect, useState, useMemo }  from 'react';
import Link                              from 'next/link';
import { usePublicAuthStore }            from '@/store/publicAuthStore';
import { useBookingStore }               from '@/store/bookingStore';
import { useReviewStore }                from '@/store/reviewStore';
import { useToast }                      from '@/components/shared/Toast';
import LoadingSpinner                    from '@/components/shared/LoadingSpinner';
import { BookingCardSkeleton, EmptyState, ConfirmModal } from '@/components/shared/Skeletons';
import { formatPrice }                   from '@/lib/pricing';
import { CheckIcon, StarIcon, CloseIcon } from '@/components/icons';
import ChatModal from '@/components/public/ChatModal';

const STATUS_STYLES = {
  pending_chat:             { label: 'Awaiting Worker',  cls: 'bg-amber-100   text-amber-700'  },
  discussing:               { label: 'Discussing',       cls: 'bg-blue-100    text-blue-700'   },
  final_price_pending:      { label: 'Price Agreed',     cls: 'bg-purple-100  text-purple-700' },
  ready_for_payment:        { label: 'Ready to Pay',     cls: 'bg-indigo-100  text-indigo-700' },
  paid:                     { label: 'Paid',             cls: 'bg-emerald-100 text-emerald-700'},
  completed:                { label: 'Completed',        cls: 'bg-green-100   text-green-700'  },
  cancelled_before_payment: { label: 'Cancelled',        cls: 'bg-gray-100    text-gray-500'   },
  pending:                  { label: 'Awaiting Worker',  cls: 'bg-amber-100   text-amber-700'  },
  accepted:                 { label: 'Discussing',       cls: 'bg-blue-100    text-blue-700'   },
  cancelled:                { label: 'Cancelled',        cls: 'bg-gray-100    text-gray-500'   },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

function ReviewModal({ booking, onClose, onSubmit }) {
  const [rating,  setRating]  = useState(5);
  const [comment, setComment] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [hovered, setHovered] = useState(0);

  // ── BUG FIX (Part 6 — Error 1) ─────────────────────────────────────────
  // ROOT CAUSE of "TypeError: a is not a function" (appeared twice):
  //
  // OCCURRENCE 1: ReviewModal was rendered WITHOUT the `onSubmit` prop.
  //   ReviewModal.handleSubmit calls `await onSubmit({...})` but onSubmit
  //   was undefined → TypeError: undefined is not a function (minified: "a").
  //
  // OCCURRENCE 2: handleReview re-throws after showing the error toast.
  //   handleSubmit had no catch block, so the re-thrown FirebaseError became
  //   an unhandled promise rejection → second "TypeError: a is not a function"
  //   in the console.
  //
  // FIX: (a) pass onSubmit={handleReview} and (b) add catch to handleSubmit.
  // ─────────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({ bookingId: booking.id, rating, comment });
      onClose();
    } catch {
      // Error is already handled in onSubmit (toast was shown by handleReview).
      // Silently swallow here to prevent an unhandled promise rejection which
      // was showing as the second "TypeError: a is not a function" in console.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center
                 justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Leave a Review</h2>
          <button onClick={onClose}
                  className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-3">
              How was your experience with <strong>{booking.workerName}</strong>?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-10 h-10 ${
                      s <= (hovered || rating) ? 'text-amber-400' : 'text-gray-200'
                    }`}
                    fill="currentColor" viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                         text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none placeholder-gray-400"
              rows={3}
              maxLength={500}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                       rounded-xl transition-colors disabled:opacity-50
                       flex items-center justify-center gap-2"
          >
            {saving ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerBookingsPage() {
  const { user }   = usePublicAuthStore();
  const {
    customerBookings, customerBookingsLoading,
    subscribeCustomerBookings, unsubscribeCustomerBookings,
    cancelBooking,
  }                = useBookingStore();
  const { submitReview } = useReviewStore();
  const toast      = useToast((s) => s.show);

  const [filter,       setFilter]       = useState('all');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [cancellingId,  setCancellingId]  = useState(null);
  const [chatWorker,    setChatWorker]    = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  useEffect(() => {
    if (user?.uid) subscribeCustomerBookings(user.uid);
    return () => unsubscribeCustomerBookings();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (filter === 'all') return customerBookings;
    if (filter === 'pending_chat') return customerBookings.filter((b) => b.status === 'pending_chat' || b.status === 'pending');
    if (filter === 'cancelled_before_payment') return customerBookings.filter((b) => b.status === 'cancelled_before_payment' || b.status === 'cancelled');
    return customerBookings.filter((b) => b.status === filter);
  }, [customerBookings, filter]);

  async function handleCancel(booking) {
    setCancellingId(booking.id);
    try {
      await cancelBooking(booking.id, booking);
      toast('Booking cancelled.', 'success');
    } catch (err) {
      toast(err.message ?? 'Cancel failed.', 'error');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleReview({ bookingId, rating, comment }) {
    const booking = customerBookings.find((b) => b.id === bookingId);
    if (!booking || !user) return;
    try {
      await submitReview({
        workerId:     booking.workerId,
        customerId:   user.uid,
        customerName: user.name,
        bookingId,
        rating,
        comment,
      });
      toast('Review submitted!', 'success');
    } catch (err) {
      toast(err.message ?? 'Review failed.', 'error');
      throw err;
    }
  }

  const counts = {
    pending_chat:             customerBookings.filter((b) => b.status === 'pending_chat' || b.status === 'pending').length,
    discussing:               customerBookings.filter((b) => b.status === 'discussing' || b.status === 'accepted').length,
    ready_for_payment:        customerBookings.filter((b) => b.status === 'ready_for_payment').length,
    paid:                     customerBookings.filter((b) => b.status === 'paid').length,
    completed:                customerBookings.filter((b) => b.status === 'completed').length,
    cancelled_before_payment: customerBookings.filter((b) => b.status === 'cancelled_before_payment' || b.status === 'cancelled').length,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      <div>
        <Link href="/customer-dashboard"
              className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {customerBookings.length} booking{customerBookings.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {[
          { id: 'all',       label: `All (${customerBookings.length})`  },
          { id: 'pending_chat',             label: `Awaiting (${counts.pending_chat})` },
          { id: 'discussing',               label: `Discussing (${counts.discussing})` },
          { id: 'ready_for_payment',        label: `Ready (${counts.ready_for_payment})` },
          { id: 'paid',                     label: `Paid (${counts.paid})` },
          { id: 'completed',                label: `Done (${counts.completed})` },
          { id: 'cancelled_before_payment', label: 'Cancelled' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-1
                        ${filter === id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {customerBookingsLoading && (
        <div className="space-y-4">
          {[1,2,3].map((i) => <BookingCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!customerBookingsLoading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState
            icon={<StarIcon className="w-8 h-8" />}
            title={filter === 'all' ? 'No bookings yet' : `No ${filter.replace(/_/g, ' ')} bookings`}
            message={filter === 'all' ? 'Find a worker and make your first booking!' : 'Try a different filter.'}
          />
        </div>
      )}

      {/* Booking cards */}
      {!customerBookingsLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((booking) => {
            const statusInfo = STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending;
            const canCancel  = (
                               booking.status === 'pending_chat' ||
                               booking.status === 'pending' ||
                               booking.status === 'discussing' ||
                               booking.status === 'accepted' ||
                               booking.status === 'final_price_pending'
                             ) && booking.paymentStatus !== 'paid' &&
                             booking.status !== 'paid' && !booking.readyForPayment;
            const canReview  = booking.status === 'completed' && booking.otpVerified;

            return (
              <div key={booking.id}
                   className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                              space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{booking.workerName}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                                        ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm">{booking.categoryName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">
                      {booking.priceQuoted > 0
                        ? formatPrice(booking.priceQuoted)
                        : <span className="text-gray-400 font-medium text-sm">To be discussed</span>}
                    </p>
                    <p className={`text-xs ${
                      booking.paymentStatus === 'paid' ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  {booking.scheduledAt && (
                    <div>
                      <span className="text-gray-400 text-xs font-medium">Scheduled</span>
                      <p>{formatDate(booking.scheduledAt)}</p>
                    </div>
                  )}
                  {booking.address && (
                    <div>
                      <span className="text-gray-400 text-xs font-medium">Address</span>
                      <p className="truncate">{booking.address}</p>
                    </div>
                  )}
                  {booking.description && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-400 text-xs font-medium">Job</span>
                      <p className="line-clamp-2">{booking.description}</p>
                    </div>
                  )}
                  {booking.notes && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-400 text-xs font-medium">Notes</span>
                      <p className="line-clamp-2">{booking.notes}</p>
                    </div>
                  )}
                </div>

                {/* Worker phone — revealed after payment */}
                {booking.paymentStatus === 'paid' && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-green-50
                                  border border-green-200 rounded-xl">
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372
                           c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417
                           l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143
                           c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173
                           L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25
                           4.5v2.25z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-green-700">
                        Worker Mobile — revealed after payment
                      </p>
                      <p className="font-bold text-green-900">
                        {booking.workerPhone ?? 'Not provided by worker'}
                      </p>
                    </div>
                  </div>
                )}

                {/* OTP — shown after payment, for service completion */}
                {booking.paymentStatus === 'paid' &&
                 booking.completionOtp &&
                 booking.status !== 'completed' && (
                  <div className="flex items-start gap-3 px-4 py-4 bg-blue-50
                                  border-2 border-blue-300 rounded-2xl">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center
                                    justify-center shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
                           stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                             002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                             00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-blue-900 text-sm">
                        Your Service Completion OTP
                      </p>
                      <p className="text-5xl font-extrabold text-blue-700 tracking-[0.25em]
                                    my-2 font-mono">
                        {booking.completionOtp}
                      </p>
                      <p className="text-blue-700 text-xs leading-relaxed">
                        Share this code with <strong>{booking.workerName}</strong>{' '}
                        <strong>ONLY after the work is fully done</strong> to your
                        satisfaction. The worker will enter this OTP to mark the job complete.
                      </p>
                      <p className="text-blue-500 text-xs mt-1.5 font-medium">
                        ⚠ Do not share this OTP before the work is completed.
                      </p>
                    </div>
                  </div>
                )}

                {/* OTP verified — booking completed */}
                {booking.status === 'completed' && booking.otpVerified && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50
                                  border border-green-200 rounded-xl">
                    <svg className="w-4 h-4 text-green-600 shrink-0" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-700 text-sm font-semibold">
                      OTP verified — job completed successfully.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Link
                    href={`/worker/${booking.workerId}`}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600
                               text-sm font-medium hover:border-gray-300 transition-colors"
                  >
                    View Worker
                  </Link>

                  {/* ── Persistent Chat button ────────────────────────────────
                       FIX (Part 3 — mirrors Part 2 worker-side fix):
                       Old condition only matched legacy aliases 'pending' /
                       'accepted'. The direct-chat booking lifecycle
                       (pending_chat → discussing → final_price_pending →
                       ready_for_payment → paid) was NOT covered, so the button
                       disappeared the moment a real conversation got underway —
                       even though the chat document already exists via
                       initBookingChat. Customer still had access via /chats,
                       but lost the convenient in-booking shortcut. */}
                  {['pending_chat', 'discussing', 'final_price_pending',
                    'ready_for_payment', 'paid',
                    'pending', 'accepted'].includes(booking.status) && (
                    <button
                      onClick={() => setChatWorker({
                        uid:             booking.workerId,
                        id:              booking.workerId,
                        name:            booking.workerName,
                        categoryName:    booking.categoryName ?? '',
                        profileImageUrl: '',
                      })}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                                 bg-blue-50 border border-blue-200 text-blue-700
                                 text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                           stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125
                             0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375
                             0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9
                             8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969
                             5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901
                             -.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9
                             3.694 9 8.25z" />
                      </svg>
                      Chat with Worker
                    </button>
                  )}

                  {canReview && (
                    <button
                      onClick={() => setReviewTarget(booking)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                                 bg-amber-50 border border-amber-200 text-amber-700
                                 text-sm font-semibold hover:bg-amber-100 transition-colors"
                    >
                      <StarIcon className="w-4 h-4" />
                      Leave Review
                    </button>
                  )}

                  {canCancel && (
                    <button
                      onClick={() => setConfirmCancel(booking)}
                      disabled={cancellingId === booking.id}
                      className="px-4 py-2 rounded-xl border border-red-200 text-red-600
                                 text-sm font-medium hover:bg-red-50 transition-colors
                                 disabled:opacity-40"
                    >
                      {cancellingId === booking.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chatWorker && (
        <ChatModal
          peer={chatWorker}
          onClose={() => setChatWorker(null)}
        />
      )}

      {/* Standalone ReviewModal — onSubmit wired to handleReview (was missing, caused TypeError) */}
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReview}
        />
      )}

      {confirmCancel && (
        <ConfirmModal
          title="Cancel Booking?"
          message={`Cancel booking with ${confirmCancel.workerName}? This cannot be undone.`}
          confirmLabel="Yes, Cancel"
          cancelLabel="Keep Booking"
          loading={cancellingId === confirmCancel.id}
          onConfirm={async () => { await handleCancel(confirmCancel); setConfirmCancel(null); }}
          onCancel={() => setConfirmCancel(null)}
        />
      )}
    </div>
  );
}