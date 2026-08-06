'use client';

import { useEffect, useState, useMemo }   from 'react';
import Link                               from 'next/link';
import { usePublicAuthStore }             from '@/store/publicAuthStore';
import { useJobRequestStore }             from '@/store/jobRequestStore';
import { useQuoteStore }                  from '@/store/quoteStore';
import { useContentStore }                from '@/store/contentStore';
import { useToast }                       from '@/components/shared/Toast';
import LoadingSpinner                     from '@/components/shared/LoadingSpinner';
import PriceBreakdown                     from '@/components/public/PriceBreakdown';
import JobRequestModal                    from '@/components/public/JobRequestModal';
import { formatPrice, getPricingRates }   from '@/lib/pricing';
import {
  PlusIcon, ArrowRightIcon, CheckIcon,
  XIcon, StarIcon, VerifiedIcon, CloseIcon,
}                                         from '@/components/icons';

// ── SVG icons (replacing emojis — Part 8) ────────────────────────────────────

function PinIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
    </svg>
  );
}

function CurrencyIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  open:     { label: 'Awaiting Quotes', cls: 'bg-amber-100  text-amber-700  border-amber-200'  },
  quoted:   { label: 'Quotes Received', cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
  accepted: { label: 'Booking Created', cls: 'bg-green-100  text-green-700  border-green-200'  },
  closed:   { label: 'Closed',          cls: 'bg-gray-100   text-gray-500   border-gray-200'   },
};

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ rating, reviewCount }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <svg key={s}
               className={`w-3.5 h-3.5 ${
                 s <= Math.round(rating ?? 0) ? 'text-amber-400' : 'text-gray-200'
               }`}
               fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-xs text-gray-500">
        {(rating ?? 0).toFixed(1)} ({reviewCount ?? 0})
      </span>
    </div>
  );
}

// ── Quote card ────────────────────────────────────────────────────────────────

function QuoteCard({ quote, request, customer, onAccept, onReject, accepting, rejecting, gstModeEnabled }) {
  if (quote.status === 'rejected') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center">
            <XIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-500 text-sm">{quote.workerName}</p>
            <p className="text-gray-400 text-xs">Quote declined</p>
          </div>
        </div>
      </div>
    );
  }

  if (quote.status === 'accepted') {
    return (
      <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
            <CheckIcon className="w-4 h-4 text-green-700" />
          </div>
          <p className="font-bold text-green-800 text-sm">Quote Accepted</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-green-100 shrink-0">
            {quote.workerProfileImageUrl ? (
              <img src={quote.workerProfileImageUrl} alt={quote.workerName}
                   className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center
                              text-xl font-bold text-green-600">
                {(quote.workerName || 'W')[0]}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-green-900 truncate">{quote.workerName}</p>
              {quote.workerIsVerified && (
                <VerifiedIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              )}
            </div>
            <StarRating rating={quote.workerRating} reviewCount={quote.workerReviewCount} />
          </div>
          <div className="text-right shrink-0">
            <p className="font-extrabold text-green-800 text-lg">
              {formatPrice(quote.finalPrice)}
            </p>
            <p className="text-green-600 text-xs">Booking created</p>
          </div>
        </div>
      </div>
    );
  }

  // Pending quote
  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden
                    hover:border-blue-200 transition-colors">
      <div className="flex items-center gap-3 p-4">
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
          {quote.workerProfileImageUrl ? (
            <img src={quote.workerProfileImageUrl} alt={quote.workerName}
                 className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-blue-100 flex items-center justify-center
                            text-xl font-bold text-blue-600">
              {(quote.workerName || 'W')[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-gray-900 truncate">{quote.workerName}</p>
            {quote.workerIsVerified && (
              <VerifiedIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}
          </div>
          <StarRating rating={quote.workerRating} reviewCount={quote.workerReviewCount} />
          {quote.message && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2">{quote.message}</p>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        <PriceBreakdown
          basePrice={quote.basePrice}
          platformFee={quote.platformFee}
          platformPercent={quote.platformPercent}
          platformFeeType={quote.platformFeeType}
          platformFixed={quote.platformFixed}
          gstAmount={quote.gstAmount}
          gstPercent={quote.gstPercent}
          finalPrice={quote.finalPrice}
          gstModeEnabled={gstModeEnabled}
          compact
        />
      </div>

      {request.status !== 'accepted' && (
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => onReject(quote.id)}
            disabled={rejecting === quote.id || accepting === quote.id}
            className="flex-1 py-2.5 border-2 border-gray-200 text-gray-500 font-semibold
                       rounded-xl hover:border-red-200 hover:text-red-600 text-sm
                       transition-colors disabled:opacity-40"
          >
            Decline
          </button>
          <button
            onClick={() => onAccept(quote, request)}
            disabled={accepting === quote.id || rejecting === quote.id}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold
                       rounded-xl text-sm transition-colors disabled:opacity-40
                       flex items-center justify-center gap-2"
          >
            {accepting === quote.id ? (
              <LoadingSpinner size="xs" />
            ) : (
              <>Accept Quote <ArrowRightIcon className="w-4 h-4" /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Request detail drawer ─────────────────────────────────────────────────────

function RequestDetail({ request, customer, onClose, gstModeEnabled }) {
  const {
    requestQuotes, requestQuotesLoading,
    subscribeRequestQuotes, unsubscribeRequestQuotes,
    acceptQuote, rejectQuote,
  } = useQuoteStore();
  const toast = useToast((s) => s.show);

  const [accepting, setAccepting] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => {
    subscribeRequestQuotes(request.id);
    return () => unsubscribeRequestQuotes();
  }, [request.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAccept(quote, req) {
    if (!window.confirm(
      `Accept ${quote.workerName}'s quote for ${formatPrice(quote.finalPrice)}?`,
    )) return;
    setAccepting(quote.id);
    try {
      await acceptQuote(quote, req, customer);
      toast('Quote accepted! Booking created successfully.', 'success');
    } catch (err) {
      toast(err.message ?? 'Failed to accept quote.', 'error');
    } finally {
      setAccepting(null);
    }
  }

  async function handleReject(quoteId) {
    setRejecting(quoteId);
    try {
      await rejectQuote(quoteId);
      toast('Quote declined.', 'info');
    } catch (err) {
      toast(err.message ?? 'Action failed.', 'error');
    } finally {
      setRejecting(null);
    }
  }

  const pendingQuotes  = requestQuotes.filter((q) => q.status === 'pending');
  const acceptedQuotes = requestQuotes.filter((q) => q.status === 'accepted');
  const rejectedQuotes = requestQuotes.filter((q) => q.status === 'rejected');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end
                 sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl shadow-2xl
                      max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4
                        border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">{request.categoryName} Request</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                                ${STATUS_STYLES[request.status]?.cls}`}>
                {STATUS_STYLES[request.status]?.label}
              </span>
              <span className="text-gray-400 text-xs">
                {request.quotesCount ?? 0} quote(s)
              </span>
            </div>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Request summary — Part 8: SVG icons replace 📍 📅 💰 */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
            <p className="text-gray-700 leading-relaxed">{request.description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-1">
              {request.address && (
                <span className="flex items-center gap-1">
                  <PinIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  {request.address}
                </span>
              )}
              {request.preferredDate && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  {new Date(request.preferredDate).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}
                </span>
              )}
              {request.budget && (
                <span className="flex items-center gap-1">
                  <CurrencyIcon className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  Budget: {formatPrice(request.budget)}
                </span>
              )}
            </div>
          </div>

          {/* Quotes */}
          {requestQuotesLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" label="Loading quotes…" />
            </div>
          ) : requestQuotes.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center
                              justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-500">Waiting for quotes</p>
              <p className="text-gray-400 text-sm mt-1">
                Workers in your area are reviewing your request.
              </p>
            </div>
          ) : (
            <>
              {acceptedQuotes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Accepted
                  </p>
                  {acceptedQuotes.map((q) => (
                    <QuoteCard key={q.id} quote={q} request={request}
                               customer={customer} onAccept={handleAccept}
                               onReject={handleReject} accepting={accepting}
                               rejecting={rejecting} gstModeEnabled={gstModeEnabled} />
                  ))}
                </div>
              )}
              {pendingQuotes.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {pendingQuotes.length} Quote{pendingQuotes.length !== 1 ? 's' : ''} — Compare &amp; Accept
                  </p>
                  {pendingQuotes.map((q) => (
                    <QuoteCard key={q.id} quote={q} request={request}
                               customer={customer} onAccept={handleAccept}
                               onReject={handleReject} accepting={accepting}
                               rejecting={rejecting} gstModeEnabled={gstModeEnabled} />
                  ))}
                </div>
              )}
              {rejectedQuotes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Declined
                  </p>
                  {rejectedQuotes.map((q) => (
                    <QuoteCard key={q.id} quote={q} request={request}
                               customer={customer} onAccept={handleAccept}
                               onReject={handleReject} accepting={accepting}
                               rejecting={rejecting} gstModeEnabled={gstModeEnabled} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomerJobRequestsPage() {
  const { user }                     = usePublicAuthStore();
  const {
    categories,
    subscribeCategories,
    unsubscribeCategories,
  }                                  = useContentStore();
  const {
    customerRequests, customerRequestsLoading,
    subscribeCustomerRequests, unsubscribeCustomerRequests,
    closeJobRequest,
  }                                  = useJobRequestStore();
  const toast                        = useToast((s) => s.show);

  const [showModal,    setShowModal]    = useState(false);
  const [selectedReq,  setSelectedReq]  = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [closingId,    setClosingId]    = useState(null);

  // Part 6 — Admin GST Mode System: fetched once, passed down to quote cards.
  const [gstModeEnabled, setGstModeEnabled] = useState(false);
  useEffect(() => {
    getPricingRates().then((rates) => setGstModeEnabled(rates.gstModeEnabled));
  }, []);

  useEffect(() => {
    if (user?.uid) {
      subscribeCustomerRequests(user.uid);
      subscribeCategories();
    }
    return () => {
      unsubscribeCustomerRequests();
      unsubscribeCategories();
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() =>
    statusFilter === 'all'
      ? customerRequests
      : customerRequests.filter((r) => r.status === statusFilter),
    [customerRequests, statusFilter],
  );

  async function handleClose(req) {
    if (!window.confirm(
      'Close this request? Workers will no longer be able to send quotes.',
    )) return;
    setClosingId(req.id);
    try {
      await closeJobRequest(req.id);
      toast('Request closed.', 'success');
    } catch (err) {
      toast(err.message ?? 'Action failed.', 'error');
    } finally {
      setClosingId(null);
    }
  }

  const counts = {
    all:      customerRequests.length,
    open:     customerRequests.filter((r) => r.status === 'open').length,
    quoted:   customerRequests.filter((r) => r.status === 'quoted').length,
    accepted: customerRequests.filter((r) => r.status === 'accepted').length,
    closed:   customerRequests.filter((r) => r.status === 'closed').length,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/customer-dashboard"
                className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">My Job Requests</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {customerRequests.length} request{customerRequests.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white
                     text-sm font-semibold shadow-md bg-blue-600 hover:bg-blue-700
                     transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Post New Request
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {[
          { id: 'all',      label: `All (${counts.all})`           },
          { id: 'open',     label: `Waiting (${counts.open})`      },
          { id: 'quoted',   label: `Quotes (${counts.quoted})`     },
          { id: 'accepted', label: `Booked (${counts.accepted})`   },
          { id: 'closed',   label: `Closed (${counts.closed})`     },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-1
                        ${statusFilter === id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {customerRequestsLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading requests…" />
        </div>
      )}

      {/* Empty */}
      {!customerRequestsLoading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                        p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center
                          justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847
                   2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354
                   0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334
                   a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094
                   -1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345
                   -8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25
                   3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226
                   c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21
                   l4.155-4.155" />
          </svg>
          </div>
          <p className="font-semibold text-gray-500 mb-1">
            {statusFilter === 'all' ? 'No requests yet' : `No ${statusFilter} requests`}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold
                         bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Post your first request
            </button>
          )}
        </div>
      )}

      {/* Request list */}
      {!customerRequestsLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((req) => (
            <div key={req.id}
                 className="bg-white rounded-2xl border border-gray-100 shadow-sm
                            hover:shadow-md transition-all p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{req.categoryName}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                                      border ${STATUS_STYLES[req.status]?.cls}`}>
                      {STATUS_STYLES[req.status]?.label}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5 line-clamp-2">
                    {req.description}
                  </p>

                  {/* Meta row — Part 8: SVG icons replace 📍 📅 */}
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                    {req.preferredDate && (
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3 shrink-0" />
                        {new Date(req.preferredDate).toLocaleDateString('en-IN', {
                          month: 'short', day: 'numeric',
                        })}
                      </span>
                    )}
                    {req.address && (
                      <span className="flex items-center gap-1 truncate max-w-xs">
                        <PinIcon className="w-3 h-3 shrink-0" />
                        {req.address}
                      </span>
                    )}
                    {req.budget && (
                      <span className="flex items-center gap-1">
                        <CurrencyIcon className="w-3 h-3 shrink-0" />
                        Budget: {formatPrice(req.budget)}
                      </span>
                    )}
                  </div>
                </div>

                {(req.quotesCount ?? 0) > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-blue-600">{req.quotesCount}</p>
                    <p className="text-gray-400 text-xs">
                      quote{req.quotesCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setSelectedReq(req)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm
                             font-semibold text-white bg-blue-600 hover:bg-blue-700
                             transition-all"
                >
                  {(req.quotesCount ?? 0) > 0 ? 'View Quotes' : 'View Request'}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>

                {req.status === 'open' && (
                  <button
                    onClick={() => handleClose(req)}
                    disabled={closingId === req.id}
                    className="px-4 py-2 rounded-xl text-sm font-medium border-2
                               border-gray-200 text-gray-500 hover:border-red-200
                               hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    {closingId === req.id ? 'Closing…' : 'Close Request'}
                  </button>
                )}

                <p className="text-xs text-gray-300 ml-auto">
                  {req.createdAt
                    ? new Date(req.createdAt).toLocaleDateString('en-IN', {
                        month: 'short', day: 'numeric',
                      })
                    : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Request Modal */}
      {showModal && (
        <JobRequestModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            toast('Request posted! Workers will send you quotes soon.', 'success');
          }}
        />
      )}

      {/* Request Detail Drawer */}
      {selectedReq && (
        <RequestDetail
          request={selectedReq}
          customer={user}
          onClose={() => setSelectedReq(null)}
          gstModeEnabled={gstModeEnabled}
        />
      )}
    </div>
  );
}