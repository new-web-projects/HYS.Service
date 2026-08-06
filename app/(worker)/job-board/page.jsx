'use client';

import { useEffect, useState, useMemo } from 'react';
import Link                             from 'next/link';
import { useForm }                      from 'react-hook-form';
import { zodResolver }                  from '@hookform/resolvers/zod';
import { z }                            from 'zod';
import { usePublicAuthStore }           from '@/store/publicAuthStore';
import { useUserStore }                 from '@/store/userStore';
import { useJobRequestStore }           from '@/store/jobRequestStore';
import { useQuoteStore }                from '@/store/quoteStore';
import { useToast }                     from '@/components/shared/Toast';
import LoadingSpinner                   from '@/components/shared/LoadingSpinner';
import PriceBreakdown                   from '@/components/public/PriceBreakdown';
import {
  calculateFinalPrice, formatPrice,
  getPricingRates,
}                                       from '@/lib/pricing';
import {
  CloseIcon, ArrowRightIcon, SpinnerIcon,
  LocationIcon, CalendarIcon, BookingIcon,
}                                       from '@/components/icons';

const quoteSchema = z.object({
  basePrice: z
    .number({ invalid_type_error: 'Enter a valid price' })
    .min(1, 'Price must be at least ₹1')
    .max(500_000, 'Price cannot exceed ₹5,00,000'),
  message:   z.string().max(300).optional().default(''),
});

// ── Send Quote Modal ──────────────────────────────────────────────────────────

function SendQuoteModal({ request, worker, onClose, onSuccess }) {
  const { sendQuote }     = useQuoteStore();
  const toast              = useToast((s) => s.show);
  const [rates,   setRates]   = useState({
    platformFeePercent: 10,
    platformFeeType:    'percent',
    platformFixed:      0,
    gstPercent:         18,
    gstModeEnabled:     false,
  });
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: { basePrice: 0, message: '' },
  });

  const basePrice = watch('basePrice');

  // Load current pricing rates from Firestore
  useEffect(() => {
    getPricingRates().then(setRates).catch(() => {});
  }, []);

  // Recalculate preview on every base price change
  //
  // PART 8 FIX: previously only forwarded platformFeePercent + gstPercent,
  // silently dropping platformFeeType/platformFixed — so if the admin had
  // configured a Fixed-amount platform fee, this live preview still showed
  // the percentage-based amount instead of the actual fixed ₹ fee.
  useEffect(() => {
    const parsed = parseFloat(basePrice);
    if (parsed > 0) {
      setPreview(calculateFinalPrice(
        parsed,
        rates.platformFeePercent,
        rates.gstPercent,
        rates.platformFeeType,
        rates.platformFixed,
      ));
    } else {
      setPreview(null);
    }
  }, [basePrice, rates]);

  async function onSubmit(data) {
    setSubmitting(true);
    try {
      await sendQuote({
        jobRequestId: request.id,
        customerId:   request.customerId,
        worker,
        basePrice:    data.basePrice,
        message:      data.message,
      });
      toast('Quote sent successfully!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err.message ?? 'Failed to send quote.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
    'placeholder-gray-400 transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Send Your Quote</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Request summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="font-semibold text-gray-900 text-sm">{request.categoryName}</p>
          <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{request.description}</p>
          {request.budget && (
            <p className="text-blue-600 text-xs font-medium mt-1">
              Customer budget hint: {formatPrice(request.budget)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">

          {/* Base price */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Your Base Price (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
              <input
                {...register('basePrice', { valueAsNumber: true })}
                type="number"
                min="1"
                step="50"
                placeholder="0"
                className={`${inputCls} pl-8`}
              />
            </div>
            {errors.basePrice && (
              <p className="mt-1 text-xs text-red-500">{errors.basePrice.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              This is the amount you will receive.{' '}
              {rates.gstModeEnabled
                ? 'Platform fee and GST are added on top for the customer.'
                : 'A platform fee is added on top for the customer.'}
            </p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Message to Customer
              <span className="ml-2 text-gray-400 font-normal text-xs">optional</span>
            </label>
            <textarea
              {...register('message')}
              placeholder="e.g. I have 5 years of experience with this type of work and can arrive within 24 hours."
              className={`${inputCls} min-h-[70px] resize-none`}
              rows={2}
            />
          </div>

          {/* Live pricing preview */}
          {preview && (
            <div className="animate-fade-in">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                What the customer will see:
              </p>
              <PriceBreakdown
                basePrice={preview.basePrice}
                platformFee={preview.platformFee}
                platformPercent={preview.platformPercent}
                platformFeeType={preview.platformFeeType}
                platformFixed={preview.platformFixed}
                gstAmount={preview.gstAmount}
                gstPercent={preview.gstPercent}
                finalPrice={preview.finalPrice}
                gstModeEnabled={rates.gstModeEnabled}
                showExpanded
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-200 text-gray-600
                         font-semibold rounded-xl hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !preview}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                         rounded-xl transition-colors disabled:opacity-40
                         flex items-center justify-center gap-2"
            >
              {submitting ? (
                <SpinnerIcon className="w-4 h-4" />
              ) : (
                <>
                  Send Quote
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkerJobBoardPage() {
  const { user }    = usePublicAuthStore();
  const { getWorkerProfile } = useUserStore();
  const {
    openRequests, openRequestsLoading,
    subscribeOpenRequests, unsubscribeOpenRequests,
  }                 = useJobRequestStore();
  const { workerQuotes, subscribeWorkerQuotes, unsubscribeWorkerQuotes } = useQuoteStore();

  const [profile,       setProfile]      = useState(null);
  const [quotingReq,    setQuotingReq]   = useState(null);
  const [search,        setSearch]       = useState('');

  useEffect(() => {
    if (!user?.uid) return;

    getWorkerProfile(user.uid).then((p) => {
      setProfile(p);
      if (p?.categoryId) {
        subscribeOpenRequests(p.categoryId);
        subscribeWorkerQuotes(user.uid);
      }
    });

    return () => {
      unsubscribeOpenRequests();
      unsubscribeWorkerQuotes();
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set of request IDs the worker has already quoted
  const quotedRequestIds = useMemo(
    () => new Set(workerQuotes.map((q) => q.jobRequestId)),
    [workerQuotes],
  );

  const filtered = useMemo(() =>
    openRequests.filter((r) =>
      !search ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()),
    ),
    [openRequests, search],
  );

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium', timeStyle: 'short',
    });
  }

  if (!profile?.categoryId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
          <p className="font-bold text-amber-900 mb-2">Category Not Set</p>
          <p className="text-amber-700 text-sm mb-4">
            You need to set your service category before you can see job requests.
          </p>
          <Link href="/worker-profile"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white
                           text-sm font-semibold rounded-xl transition-colors">
            Set Up Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/worker-dashboard"
                className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Job Board</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Open requests in <strong className="text-gray-600">{profile.categoryName}</strong> —
            {filtered.length} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {workerQuotes.filter((q) => q.status === 'pending').length} quotes sent
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            {workerQuotes.filter((q) => q.status === 'accepted').length} accepted
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests by description or customer…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-gray-200
                     text-gray-900 text-sm focus:outline-none focus:border-blue-400 transition-colors"
        />
      </div>

      {/* Loading */}
      {openRequestsLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading job board…" />
        </div>
      )}

      {/* Empty */}
      {!openRequestsLoading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookingIcon className="w-8 h-8 text-blue-400" />
          </div>
          <p className="font-semibold text-gray-500 mb-1">
            {search ? 'No requests match your search' : 'No open requests right now'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            New requests from customers in your category will appear here automatically.
          </p>
        </div>
      )}

      {/* Request cards */}
      {!openRequestsLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((req) => {
            const alreadyQuoted = quotedRequestIds.has(req.id);
            const myQuote = workerQuotes.find((q) => q.jobRequestId === req.id);

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border-2 shadow-sm p-5 transition-all
                            ${alreadyQuoted ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-blue-200 hover:shadow-md'}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{req.categoryName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold
                                       bg-amber-100 text-amber-700">
                        {req.quotesCount} quote{req.quotesCount !== 1 ? 's' : ''} so far
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                      {req.description}
                    </p>
                  </div>
                  {req.budget && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Budget</p>
                      <p className="font-bold text-gray-700">{formatPrice(req.budget)}</p>
                    </div>
                  )}
                </div>

                {/* Request metadata */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-4">
                  {req.address && (
                    <div className="flex items-center gap-1.5">
                      <LocationIcon className="w-3.5 h-3.5" />
                      <span>{req.address}</span>
                    </div>
                  )}
                  {req.preferredDate && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>{formatDate(req.preferredDate)}</span>
                    </div>
                  )}
                  <span className="ml-auto">
                    Posted {new Date(req.createdAt).toLocaleDateString('en-IN', {
                      month: 'short', day: 'numeric',
                    })}
                  </span>
                </div>

                {/* My quote summary (if already quoted) */}
                {alreadyQuoted && myQuote && (
                  <div className={`mb-4 px-4 py-3 rounded-xl border text-sm
                                   ${myQuote.status === 'accepted'
                                     ? 'bg-green-50 border-green-200'
                                     : myQuote.status === 'rejected'
                                     ? 'bg-red-50 border-red-200'
                                     : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold
                                        ${myQuote.status === 'accepted' ? 'text-green-700'
                                          : myQuote.status === 'rejected' ? 'text-red-700'
                                          : 'text-blue-700'}`}>
                        Your quote: {formatPrice(myQuote.finalPrice)}
                        {myQuote.status === 'accepted' && ' — Accepted!'}
                        {myQuote.status === 'rejected' && ' — Declined'}
                        {myQuote.status === 'pending'  && ' — Pending review'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action */}
                {!alreadyQuoted ? (
                  <button
                    onClick={() => setQuotingReq(req)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white
                               text-sm font-semibold transition-all"
                    style={{ backgroundColor: 'var(--color-brand, #2563eb)' }}
                  >
                    Send My Quote
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                    <CheckMark />
                    Quote already sent
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Send Quote Modal */}
      {quotingReq && (
        <SendQuoteModal
          request={quotingReq}
          worker={profile ? { ...profile, uid: user.uid } : { uid: user.uid, name: user.name }}
          onClose={() => setQuotingReq(null)}
          onSuccess={() => setQuotingReq(null)}
        />
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}