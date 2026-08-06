/**
 * components/shared/Skeletons.jsx — Part 14
 *
 * Production-grade skeleton components for all loading states.
 * Uses the existing .skeleton CSS class from globals.css.
 */

// ── Base pulse block ──────────────────────────────────────────────────────────
export function SkeletonPulse({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
  );
}

// ── Booking card skeleton ─────────────────────────────────────────────────────
export function BookingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="h-5 w-48" />
          <SkeletonPulse className="h-3.5 w-32" />
        </div>
        <SkeletonPulse className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map((i) => (
          <div key={i} className="space-y-1.5">
            <SkeletonPulse className="h-3 w-16" />
            <SkeletonPulse className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <SkeletonPulse className="h-10 flex-1 rounded-xl" />
        <SkeletonPulse className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}

// ── Worker card skeleton ──────────────────────────────────────────────────────
export function WorkerCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <SkeletonPulse className="w-16 h-16 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="h-5 w-36" />
          <SkeletonPulse className="h-3.5 w-24" />
          <SkeletonPulse className="h-3.5 w-20" />
        </div>
        <SkeletonPulse className="h-8 w-24 rounded-xl shrink-0" />
      </div>
      <div className="mt-4 flex gap-2">
        {[1,2,3].map((i) => <SkeletonPulse key={i} className="h-6 w-16 rounded-lg" />)}
      </div>
    </div>
  );
}

// ── Earnings card skeleton ────────────────────────────────────────────────────
export function EarningsCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <SkeletonPulse className="h-3.5 w-28 mb-2" />
      <SkeletonPulse className="h-8 w-24 mb-1" />
      <SkeletonPulse className="h-3 w-20" />
    </div>
  );
}

// ── Chat message skeleton ─────────────────────────────────────────────────────
export function ChatMessageSkeleton({ isSelf = false }) {
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`space-y-1 max-w-[60%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
        <SkeletonPulse className="h-10 w-full rounded-2xl" />
        <SkeletonPulse className="h-3 w-12" />
      </div>
    </div>
  );
}

// ── Stats card skeleton ───────────────────────────────────────────────────────
export function StatsRowSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <SkeletonPulse className="h-3.5 w-24 mb-2" />
          <SkeletonPulse className="h-8 w-20 mb-1" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Withdrawal history skeleton ───────────────────────────────────────────────
export function WithdrawalItemSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl
                    bg-gray-50 border border-gray-100">
      <div className="flex-1 space-y-1.5">
        <SkeletonPulse className="h-4 w-32" />
        <SkeletonPulse className="h-3 w-48" />
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <SkeletonPulse className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

// ── Error state with retry ────────────────────────────────────────────────────
export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center
                     ${compact ? 'py-8 px-4' : 'py-16 px-6'}`}>
      <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center
                      justify-center mb-3">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
               c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5
               -3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <p className="font-semibold text-gray-700 mb-1">Something went wrong</p>
      <p className="text-gray-400 text-sm mb-4 max-w-xs leading-relaxed">
        {message ?? 'Failed to load data. Please check your connection and try again.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-semibold rounded-xl transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0
                 l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7
                 l3.181 3.182m0-4.991v4.99" />
          </svg>
          Try Again
        </button>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && (
        <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center
                        justify-center mb-4">
          <span className="text-gray-300">{icon}</span>
        </div>
      )}
      <p className="font-semibold text-gray-600 mb-1">{title}</p>
      {message && (
        <p className="text-gray-400 text-sm max-w-xs leading-relaxed mb-4">
          {message}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
                     font-semibold rounded-xl transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Payment status UI ─────────────────────────────────────────────────────────
export function PaymentStatusBanner({ status }) {
  const config = {
    processing: {
      icon: (
        <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none"
             viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                  strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ),
      title: 'Processing Payment…',
      body:  'Please wait. Do not close this window.',
      cls:   'bg-blue-50 border-blue-200',
      tCls:  'text-blue-900',
      bCls:  'text-blue-600',
    },
    success: {
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Payment Successful!',
      body:  'Your booking is confirmed. Worker contact details are now visible.',
      cls:   'bg-green-50 border-green-200',
      tCls:  'text-green-900',
      bCls:  'text-green-600',
    },
    failed: {
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Payment Failed',
      body:  'Your payment could not be processed. No amount was deducted.',
      cls:   'bg-red-50 border-red-200',
      tCls:  'text-red-900',
      bCls:  'text-red-600',
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <div className={`flex items-start gap-3 px-4 py-4 border-2 rounded-2xl ${c.cls}`}>
      <div className="shrink-0 mt-0.5">{c.icon}</div>
      <div>
        <p className={`font-bold text-sm ${c.tCls}`}>{c.title}</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${c.bCls}`}>{c.body}</p>
      </div>
    </div>
  );
}

// ── Confirmation modal ────────────────────────────────────────────────────────
export function ConfirmModal({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  confirmCls = 'bg-red-600 hover:bg-red-700',
  onConfirm, onCancel, loading = false,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                    flex items-center justify-center p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center
                          justify-center shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71
                   c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5
                   -3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 border-2 border-gray-200 text-gray-600
                       font-semibold rounded-xl hover:border-gray-300 transition-colors
                       disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors
                        disabled:opacity-50 flex items-center justify-center gap-2
                        ${confirmCls}`}
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────
export function OfflineBanner() {
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-gray-900 text-white
                    text-xs font-semibold py-2 text-center flex items-center
                    justify-center gap-2">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 3l18 18M8.111 8.111A7.5 7.5 0 0021 12M3 12a7.5 7.5 0 0010.88
             6.584M6.343 6.343A3.75 3.75 0 0112 12m0 0a3.75 3.75 0 005.657
             5.657M12 12H3m9 0l9 .001" />
      </svg>
      You are offline — changes will sync when connection is restored
    </div>
  );
}
