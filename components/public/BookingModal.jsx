'use client';

import { useState, useEffect, useRef }   from 'react';
import { useForm }               from 'react-hook-form';
import { zodResolver }           from '@hookform/resolvers/zod';
import { useRouter }             from 'next/navigation';
import { useBookingStore }       from '@/store/bookingStore';
import { usePublicAuthStore }    from '@/store/publicAuthStore';
import { useToast }              from '@/components/shared/Toast';
import { bookingSchema }         from '@/lib/validators/schemas';
import { PaymentStatusBanner }   from '@/components/shared/Skeletons';
import {
  PAYMENT_CONFIG,
  calculateFinalPrice,
  formatPrice,
  getFeeRows,
  getPricingRates,
  createPaymentOrder,
  openRazorpayCheckout,
  verifyPayment,
  logPaymentError,
  updatePaymentLog,
}                                from '@/lib/payment';
import {
  CloseIcon, ArrowRightIcon, SpinnerIcon,
  CalendarIcon, LocationIcon, BookingIcon,
  VerifiedIcon, CheckIcon,
}                                from '@/components/icons';

function Stars({ rating = 0 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-4 h-4 ${
            s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   worker:            object,
 *   onClose:           () => void,
 *   confirmedPrice?:   number | null   — when set, uses this price directly (from chat)
 *   existingBookingId?: string | null  — Part 1: when set, this booking already
 *     exists (created before chat started) and has already had its price
 *     negotiated via chatStore's proposePrice/acceptPrice/confirmFinalPrice
 *     chain. The form step is skipped entirely and confirmBooking() reuses
 *     this ID instead of calling createBooking() again — this is the fix
 *     for the "duplicate booking created at payment time" bug.
 * }} props
 */
export default function BookingModal({
  worker, onClose, confirmedPrice = null, onOpenChat = null, existingBookingId = null,
}) {
  const router   = useRouter();
  const { user } = usePublicAuthStore();
  const { createBooking, markBookingPaid, getBooking } = useBookingStore();
  const toast    = useToast((s) => s.show);

  const [step,          setStep]          = useState(existingBookingId ? 'confirm' : 'form');
  const [paymentStatus, setPaymentStatus] = useState(null); // processing|success|failed
  const [submitting, setSubmitting] = useState(false);
  // PART 5: paired with `submitting` (drives the disabled button, but
  // updates asynchronously via React) with a ref (updates synchronously),
  // so two clicks arriving in the same tick — faster than a re-render —
  // can't both slip past the `submitting` check.
  const paymentInFlightRef = useRef(false);
  const [bookingId,  setBookingId]  = useState(existingBookingId);
  const [pricing, setPricing] = useState(null);
  // Part 1: the already-created booking's details (description/scheduledAt/
  // address), fetched once when existingBookingId is provided — the form
  // step that would normally collect these is skipped in this path, so
  // there's nothing in local form state to fall back on.
  const [existingBooking,        setExistingBooking]        = useState(null);
  const [loadingExistingBooking, setLoadingExistingBooking] = useState(!!existingBookingId);

  // Part 6 — Admin GST Mode System: whether to show GST breakdown rows.
  // Defaults to false (simplified) until settings load — finalPrice math is
  // unaffected either way, only the breakdown display changes.
  const [gstModeEnabled, setGstModeEnabled] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      description: '',
      scheduledAt: '',
      address:     '',
      notes:       '',
    },
  });

  const description = watch('description');
  const scheduledAt = watch('scheduledAt');
  const address     = watch('address');
  const notes       = watch('notes');

  // Part 1: when reusing an existing booking, its details came from the
  // ORIGINAL booking form (filled out before chat even started) — the local
  // watch() values above are for the (skipped, in this path) form step and
  // would be blank. Resolve to whichever source actually has the data.
  const displayScheduledAt = existingBookingId ? existingBooking?.scheduledAt : scheduledAt;
  const displayAddress     = existingBookingId ? existingBooking?.address     : address;
  const displayDescription = existingBookingId ? existingBooking?.description : description;
  const displayNotes       = existingBookingId ? existingBooking?.notes       : notes;
  // PART 2 FIX: previously this step always priced off the `confirmedPrice`
  // prop (sourced from ChatModal's activeChat.confirmedPrice — the CHAT
  // document). confirmFinalPrice() in chatStore.js writes confirmedPrice to
  // BOTH the chat doc and the booking doc in the same batch, so in the
  // normal flow they agree — but the booking record is the one this
  // requirement actually names, and it's the one the payment endpoint now
  // verifies against server-side (see create-order/route.js), so the two
  // must stay in lockstep. Prefer the fetched booking's price when reusing
  // an existing booking; fall back to the prop only for a fresh booking
  // that hasn't been negotiated into a real record yet.
  const displayConfirmedPrice = existingBookingId
    ? (existingBooking?.confirmedPrice ?? confirmedPrice)
    : confirmedPrice;

  useEffect(() => {
    // PART 8 FIX: this previously called calculateFinalPrice(confirmedPrice)
    // with NO rate arguments, which silently fell back to the function's
    // hardcoded defaults (10% platform fee, percent mode, 18% GST) instead
    // of whatever the admin actually configured in Settings (e.g. a fixed
    // ₹ platform fee). That mismatch is why the Price Breakdown shown here
    // could disagree with the Admin Settings preview. We now always fetch
    // the live admin-configured rates first and compute the breakdown from
    // those — the same pattern already used by quoteStore.sendQuote() via
    // calculateFinalPriceWithCurrentRates().
    let cancelled = false;

    if (displayConfirmedPrice != null && displayConfirmedPrice > 0) {
      getPricingRates().then((rates) => {
        if (cancelled) return;
        setGstModeEnabled(rates.gstModeEnabled);
        const breakdown = calculateFinalPrice(
          displayConfirmedPrice,
          rates.platformFeePercent,
          rates.gstPercent,
          rates.platformFeeType,
          rates.platformFixed,
        );
        setPricing({
          ...breakdown,
          amountInPaise: Math.round(breakdown.finalPrice * 100),
          currency:      'INR',
          fromChat:      true,
        });
      });
    } else {
      // No confirmed price yet — no pricing to show (will be agreed in chat)
      setPricing(null);
    }

    return () => { cancelled = true; };
  }, [displayConfirmedPrice]);

  useEffect(() => {
    if (!existingBookingId) return;
    let cancelled = false;
    setLoadingExistingBooking(true);
    getBooking(existingBookingId)
      .then((b) => {
        if (cancelled) return;
        setExistingBooking(b);
      })
      .catch((err) => {
        if (cancelled) return;
        toast(err.message ?? 'Could not load booking details.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingExistingBooking(false);
      });
    return () => { cancelled = true; };
  }, [existingBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFormSubmit() {
    if (!user) {
      router.push('/auth/login?redirect=/services');
      return;
    }
    // Defensive guard — should be unreachable since `if (!worker) return null;`
    // already gates the whole component, but kept explicit so this can never
    // silently no-op if a worker record is ever missing an id.
    if (!worker?.id) {
      toast('Something went wrong loading this worker. Please try again.', 'error');
      return;
    }
    setStep('confirm');
  }

  // PART 9 FIX: previously handleSubmit(onFormSubmit) had no onInvalid callback,
  // so any validation failure (e.g. description too short, no date picked)
  // just blocked silently — the button looked unresponsive with zero feedback.
  function onFormInvalid(formErrors) {
    const firstMessage = Object.values(formErrors)[0]?.message;
    toast(firstMessage || 'Please check the form for errors.', 'error');
  }

  async function confirmBooking() {
    setSubmitting(true);
    try {
      if (existingBookingId) {
        // Part 1: this booking already exists — it was created BEFORE chat
        // started, and chatStore's proposePrice/acceptPrice/confirmFinalPrice
        // chain has already updated this SAME booking's status to
        // 'ready_for_payment' with the agreed price. Reuse it; never create
        // a second booking record here.
        setBookingId(existingBookingId);

        if (PAYMENT_CONFIG.enabled && (pricing?.amountInPaise ?? 0) >= 100) {
          setPaymentStatus(null);
          setStep('payment');
        } else {
          setStep('success');
        }
        return;
      }

      // Fresh booking — created from the worker profile's "Book Worker"
      // flow, before any chat/price negotiation. No price yet; that gets
      // negotiated afterward in chat once the worker accepts.
      const id = await createBooking({
        customerId:   user.uid,
        customerName: user.name,
        workerId:     worker.id,
        workerName:   worker.name,
        categoryId:   worker.categoryId,
        categoryName: worker.categoryName,
        description,
        scheduledAt,
        address,
        notes:        notes ?? '',
        priceQuoted:  0,
        basePrice:    0,
        platformFee:  0,
        gstAmount:    0,
      });
      setBookingId(id);
      // No price yet — booking request has been sent, awaiting the
      // worker's acceptance. Nothing to pay yet.
      setStep('success');
    } catch (err) {
      toast(err.message ?? 'Booking failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    // PART 5 FIX: `submitting` (React state) disables the button, but state
    // updates are asynchronous — two clicks in the same tick could both
    // pass this check before the re-render lands. The ref updates
    // synchronously, so the second call sees it immediately.
    if (paymentInFlightRef.current) return;
    paymentInFlightRef.current = true;

    setSubmitting(true);
    try {
      const order = await createPaymentOrder({
        bookingId,
        amountInPaise: pricing?.amountInPaise ?? 0,
      });

      if (order.stub) { setStep('success'); return; }

      await openRazorpayCheckout({
        orderId:       order.orderId,
        amountInPaise: order.amountInPaise,
        keyId:         order.keyId,
        customerName:  user.name,
        customerEmail: user.email,
        description:   `${worker.categoryName} — ${worker.name}`,
        onSuccess: async ({ paymentId, orderId, signature }) => {
            setPaymentStatus('processing');
          let stage = 'verify';
          try {
            await verifyPayment({ paymentId, orderId, signature, bookingId });
            stage = 'mark_paid';
            await markBookingPaid(bookingId, paymentId);
            setPaymentStatus('success');
            setStep('success');
          } catch (err) {
            // PART 3 FIX: previously a bare `catch {}` — the error was
            // never captured, so a failure here left no trace of what
            // went wrong beyond this one generic toast. Now logged with
            // full context so support can actually investigate, and the
            // customer gets a booking ID to reference.
            await logPaymentError({
              bookingId, paymentId, orderId,
              userId:   user?.uid,
              workerId: worker?.id,
              error:    err,
              stage,
            });
            await updatePaymentLog(orderId, {
              paymentId, paymentStatus: 'failed',
              errorMessage: err?.message ?? String(err),
            });
            setPaymentStatus('failed');
            toast(
              `Payment received but ${stage === 'verify' ? 'verification' : 'confirmation'} ` +
              `failed. Contact support with booking ID ${bookingId}.`,
              'error',
            );
          }
        },
        onDismiss: () => {
            setPaymentStatus('failed');
          toast('Payment cancelled. Your booking is saved.', 'info');
          setStep('success');
        },
      });
    } catch (err) {
      toast(err.message ?? 'Payment failed.', 'error');
    } finally {
      setSubmitting(false);
      paymentInFlightRef.current = false;
    }
  }

  if (!worker) return null;

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
    'placeholder-gray-400 transition-colors';

  const stepTitles = {
    form:    'Book Service',
    confirm: 'Confirm Booking',
    payment: 'Complete Payment',
    success: 'Booking Confirmed!',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end
                 sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl
                      overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{stepTitles[step]}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Worker summary */}
        {(step === 'form' || step === 'confirm') && (
          <div className="flex items-center gap-4 px-5 py-4 bg-gray-50
                          border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
              {worker.profileImageUrl ? (
                <img src={worker.profileImageUrl} alt={worker.name}
                     className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center
                                bg-blue-50 text-blue-600 text-xl font-bold">
                  {(worker.name || 'W')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-900">{worker.name}</p>
                {/* FIX: was a truncated SVG path — now uses VerifiedIcon component */}
                {worker.isVerified && (
                  <VerifiedIcon className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <p className="text-gray-500 text-sm">{worker.categoryName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Stars rating={worker.rating ?? 0} />
                <span className="text-xs text-gray-400">({worker.reviewCount ?? 0})</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              {displayConfirmedPrice ? (
                <div>
                  <p className="font-bold text-green-700">
                    {formatPrice(displayConfirmedPrice)}
                  </p>
                  <p className="text-xs text-green-600">Chat agreed</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-gray-900">
                    {formatPrice(worker.startingPrice ?? worker.pricePerHour ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400">starting price</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Form ───────────────────────────────────────────────────── */}
          {step === 'form' && (
            <form id="booking-form" onSubmit={handleSubmit(onFormSubmit, onFormInvalid)}
                  noValidate className="p-5 space-y-4">

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  What do you need? *
                </label>
                <textarea
                  {...register('description')}
                  placeholder="Describe the work required…"
                  className={`${inputCls} min-h-[80px] resize-none`}
                  rows={3}
                />
                <p className="text-right text-xs text-gray-300 mt-1">
                  {description?.length ?? 0}/500
                </p>
                {errors.description && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Preferred Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  {...register('scheduledAt')}
                  min={new Date().toISOString().slice(0, 16)}
                  className={inputCls}
                />
                {errors.scheduledAt && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.scheduledAt.message}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Your Address *
                </label>
                <input
                  {...register('address')}
                  placeholder="Full address where work will be done"
                  className={inputCls}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.address.message}
                  </p>
                )}
              </div>

              {/* Additional notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Anything else the worker should know — parking, gate code, pets, etc."
                  className={`${inputCls} resize-none`}
                />
                {errors.notes && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.notes.message}
                  </p>
                )}
              </div>

              {/* Price summary */}
              {pricing?.fromChat ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="font-semibold text-blue-900 text-sm">Price Breakdown</p>
                  {[
                    { label: 'Agreed price', value: formatPrice(pricing.basePrice) },
                    ...getFeeRows(pricing, gstModeEnabled).map(({ label, value }) => ({
                      label,
                      value: `+${formatPrice(value)}`,
                    })),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm text-blue-700">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-blue-900
                                  pt-2 border-t border-blue-200 text-sm">
                    <span>Total you pay</span>
                    <span>{formatPrice(pricing.finalPrice)}</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Worker receives {formatPrice(pricing.workerReceives)} directly.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-700 text-sm font-medium">
                    Price to be discussed
                  </p>
                  <p className="text-blue-600 text-xs mt-0.5">
                    Once {worker.name} accepts your request, you'll chat together
                    to agree on a final price.
                  </p>
                </div>
              )}
            </form>
          )}

          {/* ── Confirm ─────────────────────────────────────────────── */}
          {step === 'confirm' && loadingExistingBooking && (
            <div className="p-10 flex items-center justify-center">
              <SpinnerIcon className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          )}

          {step === 'confirm' && !loadingExistingBooking && (
            <div className="p-5 space-y-4">
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Service',    value: worker.categoryName },
                  {
                    label: 'Date/Time',
                    value: displayScheduledAt
                      ? new Date(displayScheduledAt).toLocaleString('en-IN', {
                          dateStyle: 'medium', timeStyle: 'short',
                        })
                      : '—',
                  },
                  { label: 'Address',     value: displayAddress     },

                  { label: 'Description', value: displayDescription },
                  ...(displayNotes
                    ? [{ label: 'Notes', value: displayNotes }]
                    : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4">
                    <span className="text-gray-400 font-medium w-24 shrink-0">
                      {label}
                    </span>
                    <span className="text-gray-900">{value}</span>
                  </div>
                ))}
              </div>

              {existingBookingId ? (
                <>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Total Amount</span>
                      {/* ← finalPrice, not totalAmount */}
                      <span className="text-2xl font-bold text-gray-900">
                        {pricing ? formatPrice(pricing.finalPrice) : 'TBD'}
                      </span>
                    </div>
                    {pricing?.fromChat && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Price confirmed in chat
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {PAYMENT_CONFIG.enabled
                        ? 'Payment processed after confirmation.'
                        : 'Pay the worker directly on site.'}
                    </p>
                  </div>

                  {/* ── PART 4: Cannot-cancel warning on confirm step ──── */}
                  <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border-2
                                  border-red-200 rounded-2xl">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                           c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5
                           -3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-red-700 text-sm leading-relaxed">
                      <strong>After completing the booking payment, this booking
                      cannot be cancelled.</strong>
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-blue-700 text-sm font-medium">
                    Ready to send your request?
                  </p>
                  <p className="text-blue-600 text-xs mt-1 leading-relaxed">
                    {worker.name} will review these details and can accept or
                    decline. No payment is needed until you both agree on a
                    final price in chat.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Payment ─────────────────────────────────────────────── */}
          {step === 'payment' && paymentStatus && (
            <div className="px-5 pt-5">
              <PaymentStatusBanner status={paymentStatus} />
            </div>
          )}
          {step === 'payment' && (
            <div className="p-5 space-y-4">
              {/* Worker summary row */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {worker.profileImageUrl ? (
                    <img src={worker.profileImageUrl} alt={worker.name}
                         className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center
                                    bg-blue-50 text-blue-600 font-bold text-sm">
                      {(worker.name || 'W')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{worker.name}</p>
                  <p className="text-gray-500 text-xs">{worker.categoryName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Final agreed price</p>
                  <p className="font-bold text-green-700">{formatPrice(displayConfirmedPrice ?? pricing?.basePrice)}</p>
                </div>
              </div>

              {/* Full price breakdown */}
              {pricing && (
                <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Payment Summary
                    </p>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    {[
                      {
                        label: 'Agreed price (worker earnings)',
                        value: formatPrice(pricing.basePrice),
                        cls:   'text-gray-900 font-semibold',
                        hint:  'Amount the worker receives directly',
                      },
                      ...getFeeRows(pricing, gstModeEnabled).map(({ label, value, hint }) => ({
                        label,
                        value: `+ ${formatPrice(value)}`,
                        cls:   'text-gray-600',
                        hint,
                      })),
                    ].map(({ label, value, cls, hint }) => (
                      <div key={label} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{label}</p>
                          <p className="text-xs text-gray-400">{hint}</p>
                        </div>
                        <span className={`text-sm shrink-0 ${cls}`}>{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3
                                    border-t-2 border-gray-200">
                      <div>
                        <p className="font-bold text-gray-900">Total you pay</p>
                        <p className="text-xs text-gray-400">
                          Worker receives {formatPrice(pricing.workerReceives)} of this
                        </p>
                      </div>
                      <p className="text-2xl font-extrabold text-blue-600">
                        {formatPrice(pricing.finalPrice)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cannot-cancel warning */}
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border
                              border-red-200 rounded-xl">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0
                       2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0
                       L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-red-700 text-xs leading-relaxed">
                  <strong>After completing payment, this booking cannot be cancelled.</strong>
                  {' '}Please confirm all details before proceeding.
                </p>
              </div>

              {/* Secure payment note */}
              <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                       002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                       00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Secured by Razorpay
              </div>
            </div>
          )}

          {/* ── Success ─────────────────────────────────────────────── */}
          {step === 'success' && (() => {
            // Part 4: distinguish "just paid via Razorpay" from "fresh
            // booking request submitted, no payment yet" — the success
            // screen was previously identical for both, including a
            // leftover "pay in cash" status line that doesn't reflect
            // what actually happened for a completed online payment.
            const justPaid = existingBookingId && paymentStatus === 'success';
            return (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center
                              justify-center mx-auto">
                <CheckIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {justPaid
                  ? '✅ Payment Successful'
                  : existingBookingId ? 'Booking Confirmed!' : 'Booking Request Sent!'}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {justPaid ? (
                  <>Your booking with <strong>{worker.name}</strong> is confirmed and paid.</>
                ) : existingBookingId ? (
                  <>You've confirmed this booking with <strong>{worker.name}</strong>.</>
                ) : (
                  <>
                    Your booking request has been sent to{' '}
                    <strong>{worker.name}</strong>.
                    Once they accept, you'll chat together to discuss details
                    and finalise the price.
                  </>
                )}
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2">
                {[
                  ...(justPaid && bookingId
                    ? [{ label: 'Booking ID', value: bookingId }]
                    : []),
                  { label: 'Worker',  value: worker.name         },
                  { label: 'Service', value: worker.categoryName },
                  {
                    label: 'Amount',
                    /* ← finalPrice, not totalAmount */
                    value: pricing ? formatPrice(pricing.finalPrice) : 'TBD',
                  },
                  {
                    label: 'Status',
                    value: justPaid
                      ? 'Paid'
                      : existingBookingId ? 'Confirmed' : 'Pending acceptance',
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-gray-400 shrink-0">{label}</span>
                    <span className="font-medium text-gray-800 text-right break-all">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          {step === 'form' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-600
                           font-semibold rounded-xl hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="booking-form"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white
                           font-bold rounded-xl transition-colors"
              >
                Review Booking →
              </button>
            </>
          )}

          {step === 'confirm' && !loadingExistingBooking && (
            <>
              {!existingBookingId && (
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-600
                             font-semibold rounded-xl hover:border-gray-300 transition-colors"
                >
                  ← Edit
                </button>
              )}
              <button
                onClick={confirmBooking}
                disabled={submitting || (!!existingBookingId && !pricing)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                           rounded-xl transition-colors disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <SpinnerIcon className="w-4 h-4" />
                ) : existingBookingId ? (
                  'Confirm Booking'
                ) : (
                  'Send Booking Request'
                )}
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              <button
                onClick={() => setStep('success')}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-medium
                           rounded-xl text-sm hover:border-gray-300 transition-colors"
              >
                Pay later (cash)
              </button>
              <button
                onClick={handlePayment}
                disabled={submitting}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold
                           rounded-xl transition-colors disabled:opacity-50
                           flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <SpinnerIcon className="w-4 h-4" />
                ) : (
                  /* ← finalPrice, not totalAmount */
                  <>Pay {pricing ? formatPrice(pricing.finalPrice) : ''}</>
                )}
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="flex flex-col gap-2 w-full">
              {onOpenChat && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenChat(worker);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white
                             font-bold rounded-xl transition-colors flex items-center
                             justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125
                         0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375
                         0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03
                         8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41
                         20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09
                         -.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556
                         4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  Chat with {worker.name} →
                </button>
              )}
              <button
                onClick={() => {
                  onClose();
                  router.push('/customer-bookings');
                }}
                className={`w-full py-3 font-bold rounded-xl transition-colors
                            ${onOpenChat
                              ? 'border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                View My Bookings →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}