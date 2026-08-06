'use client';

import { useState, useEffect }       from 'react';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { z }                          from 'zod';
import { useJobRequestStore }         from '@/store/jobRequestStore';
import { usePublicAuthStore }         from '@/store/publicAuthStore';
import { useToast }                   from '@/components/shared/Toast';
import { createNotification }         from '@/lib/notifications';
import { getPricingRates }            from '@/lib/pricing';
import {
  CloseIcon, ArrowRightIcon, SpinnerIcon,
  CalendarIcon, LocationIcon, BookingIcon,
}                                     from '@/components/icons';

const schema = z.object({
  categoryId:    z.string().min(1, 'Please select a service category'),
  categoryName:  z.string().optional(),
  description:   z.string().min(20, 'Please describe your requirement in at least 20 characters').max(500),
  address:       z.string().min(10, 'Please enter a complete address'),
  preferredDate: z.string().min(1, 'Please select your preferred date'),
  budget:        z.string().optional(),
});

/**
 * @param {{
 *   categories:       Array,        — list of active categories
 *   preselectedCat?:  object,        — optional pre-selected category
 *   onClose:          function,
 *   onSuccess?:       function(requestId),
 * }} props
 */
export default function JobRequestModal({
  categories     = [],
  preselectedCat = null,
  onClose,
  onSuccess,
}) {
  const { user }            = usePublicAuthStore();
  const { createJobRequest } = useJobRequestStore();
  const toast               = useToast((s) => s.show);

  const [submitting, setSubmitting] = useState(false);
  const [step,       setStep]       = useState('form'); // form | success

  // Part 6 — Admin GST Mode System: controls whether the info box mentions GST.
  const [gstModeEnabled, setGstModeEnabled] = useState(false);
  useEffect(() => {
    getPricingRates().then((rates) => setGstModeEnabled(rates.gstModeEnabled));
  }, []);

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId:   preselectedCat?.id   ?? '',
      categoryName: preselectedCat?.name ?? '',
      description:  '',
      address:      '',
      preferredDate: '',
      budget:        '',
    },
  });

  const categoryId = watch('categoryId');

  function handleCategoryChange(e) {
    const id  = e.target.value;
    const cat = categories.find((c) => c.id === id);
    setValue('categoryId',   id,          { shouldValidate: true });
    setValue('categoryName', cat?.name ?? '');
  }

  async function onSubmit(data) {
    if (!user?.uid) {
      toast('Please sign in to submit a request.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const requestId = await createJobRequest({
        customerId:   user.uid,
        customerName: user.name,
        categoryId:   data.categoryId,
        categoryName: data.categoryName ?? categories.find((c) => c.id === data.categoryId)?.name ?? '',
        description:  data.description,
        address:      data.address,
        preferredDate: data.preferredDate,
        budget:        data.budget ? parseFloat(data.budget) : null,
      });

      setStep('success');
      onSuccess?.(requestId);
    } catch (err) {
      toast(err.message ?? 'Failed to submit request. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm ' +
    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
    'focus:border-transparent transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl
                   overflow-hidden max-h-[95vh] flex flex-col animate-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <BookingIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">
                {step === 'success' ? 'Request Submitted!' : 'Post a Job Request'}
              </h2>
              <p className="text-gray-400 text-xs">
                {step === 'success'
                  ? 'Workers will send you quotes'
                  : 'Workers in your area will send you quotes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600
                       hover:bg-gray-100 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Success state ────────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center
                              justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Request Posted!</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Your job request has been sent to all available workers in this category.
                You will receive notifications as workers send their quotes.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left space-y-2">
                {[
                  'Workers will review your request and send quotes',
                  'Each quote shows the final all-inclusive price',
                  'Accept the quote that suits you best',
                  'A booking is created automatically when you accept',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700
                                     text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-blue-800 text-xs leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Form ─────────────────────────────────────────────────────── */}
          {step === 'form' && (
            <form id="job-request-form" onSubmit={handleSubmit(onSubmit)}
                  noValidate className="p-5 space-y-4">

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Service Category *
                </label>
                {preselectedCat ? (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border
                                  border-blue-200 bg-blue-50">
                    <span className="text-blue-700 font-semibold text-sm">
                      {preselectedCat.name}
                    </span>
                    <span className="text-xs text-blue-500">Pre-selected</span>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={handleCategoryChange}
                    className={inputCls}
                  >
                    <option value="">Choose a service…</option>
                    {categories.filter((c) => c.status === 'active').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                {errors.categoryId && (
                  <p className="mt-1 text-xs text-red-500">{errors.categoryId.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Describe What You Need *
                </label>
                <textarea
                  {...register('description')}
                  placeholder="e.g. My bathroom tap is leaking and needs to be replaced. I need a qualified plumber to fix it within the next 2 days."
                  className={`${inputCls} min-h-[80px] resize-none`}
                  rows={3}
                />
                <p className="text-right text-xs text-gray-300 mt-1">
                  {watch('description')?.length ?? 0}/500
                </p>
                {errors.description && (
                  <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
                )}
              </div>

              {/* Preferred date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <CalendarIcon className="w-4 h-4 inline mr-1.5 text-gray-400" />
                  Preferred Date &amp; Time *
                </label>
                <input
                  {...register('preferredDate')}
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  className={inputCls}
                />
                {errors.preferredDate && (
                  <p className="mt-1 text-xs text-red-500">{errors.preferredDate.message}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  <LocationIcon className="w-4 h-4 inline mr-1.5 text-gray-400" />
                  Your Address *
                </label>
                <input
                  {...register('address')}
                  placeholder="Full address where the work will be done"
                  className={inputCls}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-red-500">{errors.address.message}</p>
                )}
              </div>

              {/* Budget hint (optional) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Your Budget (₹)
                  <span className="ml-2 text-gray-400 font-normal text-xs">optional</span>
                </label>
                <input
                  {...register('budget')}
                  type="number"
                  min="0"
                  placeholder="e.g. 1500"
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Helps workers understand your budget range. Workers will send their own quotes.
                </p>
              </div>

              {/* Info box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3
                              flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-amber-800 text-xs leading-relaxed">
                  {gstModeEnabled
                    ? 'All quoted prices are final, inclusive of platform fee and GST.'
                    : 'All quoted prices are final, inclusive of platform fee.'}
                  {' '}You only pay after accepting a quote.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          {step === 'form' ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-600
                           font-semibold rounded-xl hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="job-request-form"
                disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                           rounded-xl transition-colors disabled:opacity-40
                           flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <SpinnerIcon className="w-4 h-4" />
                    Posting…
                  </>
                ) : (
                  <>
                    Post Request
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                         rounded-xl transition-colors"
            >
              Done — View My Requests
            </button>
          )}
        </div>
      </div>
    </div>
  );
}