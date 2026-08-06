'use client';

import { useState }          from 'react';
import { CloseIcon }         from '@/components/icons';
import { useReviewStore }    from '@/store/reviewStore';
import { usePublicAuthStore } from '@/store/publicAuthStore';
import { useToast }          from '@/components/shared/Toast';

/**
 * @param {{
 *   booking:  object,   — the completed booking to review
 *   onClose:  () => void,
 *   onSuccess?: () => void,
 * }} props
 */
export default function ReviewModal({ booking, onClose, onSuccess }) {
  const { user }           = usePublicAuthStore();
  const { submitReview }   = useReviewStore();
  const toast              = useToast((s) => s.show);

  const [rating,   setRating]   = useState(5);
  const [comment,  setComment]  = useState('');
  const [hovered,  setHovered]  = useState(0);
  const [saving,   setSaving]   = useState(false);

  async function handleSubmit() {
    if (!user?.uid || !booking) return;
    setSaving(true);
    try {
      await submitReview({
        workerId:     booking.workerId,
        customerId:   user.uid,
        customerName: user.name,
        bookingId:    booking.id,
        rating,
        comment,
      });
      toast('Review submitted! Thank you.', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err.message ?? 'Review failed. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center
                 justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Leave a Review</h2>
          <button onClick={onClose}
                  className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Worker info */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center
                            justify-center text-blue-600 font-bold text-base shrink-0">
              {(booking.workerName || 'W')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{booking.workerName}</p>
              <p className="text-gray-400 text-xs">{booking.categoryName}</p>
            </div>
          </div>

          {/* Star picker */}
          <div className="text-center space-y-2">
            <p className="text-gray-600 text-sm">
              How was your experience?
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${s} star${s !== 1 ? 's' : ''}`}
                >
                  <svg
                    className={`w-10 h-10 transition-colors ${
                      s <= (hovered || rating) ? 'text-amber-400' : 'text-gray-200'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-amber-500 h-5">
              {LABELS[hovered || rating]}
            </p>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Comment
              <span className="ml-2 text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share details about your experience…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900
                         text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none placeholder-gray-400"
              rows={3}
              maxLength={500}
            />
            <p className="text-right text-xs text-gray-300 mt-1">
              {comment.length}/500
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold
                       rounded-xl transition-colors disabled:opacity-50
                       flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting…
              </>
            ) : (
              'Submit Review'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}