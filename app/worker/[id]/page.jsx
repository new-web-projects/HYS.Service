'use client';

import { useEffect, useState }   from 'react';
import { useParams, useRouter }  from 'next/navigation';
import Link                      from 'next/link';
import { useUserStore }          from '@/store/userStore';
import { useReviewStore }        from '@/store/reviewStore';
import { usePublicAuthStore }    from '@/store/publicAuthStore';
import BookingModal              from '@/components/public/BookingModal';
import ChatModal                 from '@/components/public/ChatModal';
import LoadingSpinner            from '@/components/shared/LoadingSpinner';
import { formatPrice }           from '@/lib/pricing';
import {
  VerifiedIcon, StarIcon, LocationIcon,
  BookingIcon, WrenchIcon, LogoutIcon,
}                                from '@/components/icons';

// ── Star row ──────────────────────────────────────────────────────────────────
function StarRow({ rating = 0, size = 'md' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${cls} ${
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

// ── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center
                          justify-center text-blue-700 font-bold text-sm shrink-0">
            {(review.customerName || 'A')[0].toUpperCase()}
          </div>
          <p className="font-semibold text-gray-800 text-sm">{review.customerName}</p>
        </div>
        <StarRow rating={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
      )}
      <p className="text-gray-300 text-xs">
        {review.createdAt
          ? new Date(review.createdAt).toLocaleDateString('en-IN', {
              month: 'short', day: 'numeric', year: 'numeric',
            })
          : ''}
      </p>
    </div>
  );
}

// ── Document verification badge ───────────────────────────────────────────────
const DOC_LABELS = {
  pan:     'PAN Card',
  aadhaar: 'Aadhaar',
  workId:  'Work ID',
};

const DOC_STATUS_CLS = {
  verified: 'bg-green-100 text-green-700 border-green-200',
  pending:  'bg-amber-100 text-amber-700 border-amber-200',
  rejected: 'bg-red-100   text-red-600   border-red-200',
};

function DocumentBadges({ documents = {} }) {
  const verified = Object.entries(documents).filter(
    ([, v]) => v?.status === 'verified',
  );
  if (verified.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {verified.map(([key]) => (
        <span
          key={key}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                      font-semibold border ${DOC_STATUS_CLS.verified}`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          {DOC_LABELS[key] ?? key}
        </span>
      ))}
    </div>
  );
}

// ── Minimal top nav ───────────────────────────────────────────────────────────
function MinimalNav({ user, onLogout }) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center
                      justify-between">
        {/*
          FIX (Part 4): MinimalNav's brand previously used `hidden sm:inline`
          on "Services", hiding it on all screens < 640px (mobile) — exactly
          the bug PublicNav had already been fixed for. On the Services page
          (PublicNav), "HYS. Services" always shows; on this Worker Details
          page (MinimalNav), only "HYS." showed on mobile.
          Fix: remove hidden sm:inline, and match PublicNav's structure/colors
          exactly (text-gray-800, ml-1.5, separate <span> for "HYS").
        */}
        <Link href="/"
              className="flex items-center font-extrabold text-xl tracking-tight
                         text-gray-900 hover:opacity-80 transition-opacity shrink-0">
          <span>HYS</span>
          <span className="text-blue-600">.</span>
          <span className="ml-1.5 text-base font-semibold text-gray-800">
            Services
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href={
                  user.role === 'worker'   ? '/worker-dashboard'   :
                  user.role === 'customer' ? '/customer-dashboard' :
                  '/dashboard'
                }
                className="px-3 py-2 text-sm font-medium text-gray-600
                           hover:text-gray-900 transition-colors"
              >
                My Dashboard
              </Link>
              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600
                           hover:bg-gray-100 transition-colors"
                aria-label="Sign out"
              >
                <LogoutIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="px-4 py-2 text-sm font-medium text-gray-600
                           hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/get-started"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-semibold transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkerPublicProfilePage() {
  const params               = useParams();
  const router               = useRouter();
  const { id }               = params;
  const { user, logout }     = usePublicAuthStore();
  const { getWorkerProfile } = useUserStore();
  const {
    workerReviews,
    workerReviewsLoading,
    fetchWorkerReviews,
  }                          = useReviewStore();

  const [worker,      setWorker]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showChat,    setShowChat]    = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getWorkerProfile(String(id)),
      fetchWorkerReviews(String(id)),
    ])
      .then(([profile]) => {
        if (!profile) setNotFound(true);
        else          setWorker(profile);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setNotFound(true); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBook() {
    if (!user) { router.push(`/auth/login?redirect=/worker/${id}`); return; }
    if (user.role !== 'customer') return;
    setShowBooking(true);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <MinimalNav user={user} onLogout={logout} />
        <div className="min-h-[80vh] flex items-center justify-center">
          <LoadingSpinner size="lg" label="Loading profile…" />
        </div>
      </>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !worker) {
    return (
      <>
        <MinimalNav user={user} onLogout={logout} />
        <div className="min-h-[80vh] flex flex-col items-center justify-center
                        gap-4 px-4">
          <WrenchIcon className="w-16 h-16 text-gray-200" />
          <h1 className="text-2xl font-bold text-gray-700">Worker not found</h1>
          <p className="text-gray-400 text-sm">
            This profile may no longer be available.
          </p>
          <Link href="/services"
                className="px-5 py-2.5 bg-blue-600 text-white font-semibold
                           rounded-xl hover:bg-blue-700 transition-colors">
            Browse Workers
          </Link>
        </div>
      </>
    );
  }

  const startingPrice = worker.startingPrice ?? worker.pricePerHour ?? 0;
  const canInteract   = user?.role === 'customer';

  // Count verified documents
  const verifiedDocCount = Object.values(worker.documents ?? {})
    .filter((d) => d?.status === 'verified').length;

  return (
    <>
      <MinimalNav user={user} onLogout={logout} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600
                     text-sm font-medium transition-colors"
        >
          ← Back
        </button>

        {/* ── Hero card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                        overflow-hidden">
          <div className="p-6 flex items-start gap-5">

            {/* Avatar — plain, no gradient */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100
                            shrink-0 border border-gray-200">
              {worker.profileImageUrl ? (
                <img src={worker.profileImageUrl} alt={worker.name}
                     className="w-full h-full object-cover"
                     onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center
                                bg-blue-50 text-blue-600 text-3xl font-bold">
                  {(worker.name || 'W')[0].toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{worker.name}</h1>
                {worker.isVerified && (
                  <VerifiedIcon className="w-5 h-5 text-blue-500 shrink-0" />
                )}
              </div>
              <p className="text-gray-500 font-medium mt-0.5">{worker.categoryName}</p>

              {/* Rating + experience */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <StarRow rating={worker.rating ?? 0} size="sm" />
                  <span className="text-gray-700 font-semibold text-sm">
                    {(worker.rating ?? 0).toFixed(1)}
                  </span>
                  <span className="text-gray-400 text-sm">
                    ({worker.reviewCount ?? 0} reviews)
                  </span>
                </div>

                {/* Part 6: Experience badge */}
                {(worker.experienceYears ?? 0) > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full
                                   bg-gray-100 text-gray-600 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                    </svg>
                    {worker.experienceYears} yr{worker.experienceYears !== 1 ? 's' : ''} experience
                  </span>
                )}

                {/* Location */}
                {worker.location?.address && (
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <LocationIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{worker.location.address}</span>
                  </div>
                )}
              </div>

              {/* Part 6: Verified documents badges */}
              {verifiedDocCount > 0 && (
                <DocumentBadges documents={worker.documents} />
              )}

              {/* Skills */}
              {(worker.skills?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {worker.skills.map((skill) => (
                    <span key={skill}
                          className="px-2.5 py-0.5 rounded-full bg-gray-100
                                     text-gray-600 text-xs font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Price + actions */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center
                          justify-between gap-4 flex-wrap">
            <div>
              {startingPrice > 0 ? (
                <>
                  <p className="text-2xl font-extrabold text-gray-900">
                    Starting from{' '}
                    <span className="text-blue-600">{formatPrice(startingPrice)}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Price may vary based on work
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-sm">Price on request</p>
              )}
            </div>

            {worker.isAvailable ? (
              <div className="flex gap-2">
                {canInteract && (
                  <button
                    onClick={handleBook}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600
                               hover:bg-blue-700 text-white font-bold rounded-xl
                               transition-colors shadow-md"
                  >
                    <BookingIcon className="w-4 h-4" />
                    Book Worker
                  </button>
                )}
                {!user && (
                  <Link
                    href={`/auth/login?redirect=/worker/${id}`}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600
                               hover:bg-blue-700 text-white font-bold rounded-xl
                               transition-colors"
                  >
                    Sign in to Book
                  </Link>
                )}
              </div>
            ) : (
              <span className="px-6 py-3 bg-gray-100 text-gray-400 font-semibold
                               rounded-xl text-sm">
                Currently Unavailable
              </span>
            )}
          </div>
        </div>

        {/* ── Experience description (Part 6) ───────────────────────── */}
        {worker.experienceDesc && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
              Experience
            </h2>
            {(worker.experienceYears ?? 0) > 0 && (
              <p className="text-blue-600 font-semibold text-sm mb-2">
                {worker.experienceYears} year{worker.experienceYears !== 1 ? 's' : ''} of professional experience
              </p>
            )}
            <p className="text-gray-600 leading-relaxed text-sm">
              {worker.experienceDesc}
            </p>
          </div>
        )}

        {/* ── Bio ────────────────────────────────────────────────────── */}
        {worker.bio && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-2">About</h2>
            <p className="text-gray-600 leading-relaxed">{worker.bio}</p>
          </div>
        )}

        {/* ── Details grid ────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Status',
                value: (
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      worker.isAvailable ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">
                      {worker.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                ),
              },
              {
                label: 'Jobs Done',
                value: (
                  <p className="text-gray-700 text-sm font-semibold">
                    {worker.ordersCompleted ?? 0}
                  </p>
                ),
              },
              {
                label: 'Experience',
                value: (
                  <p className="text-gray-700 text-sm font-semibold">
                    {(worker.experienceYears ?? 0) > 0
                      ? `${worker.experienceYears} yr${worker.experienceYears !== 1 ? 's' : ''}`
                      : '—'}
                  </p>
                ),
              },
              {
                label: 'Verified',
                value: (
                  <div className="flex items-center gap-1.5">
                    {worker.isVerified ? (
                      <>
                        <VerifiedIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-700">Yes</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-gray-400">No</span>
                    )}
                  </div>
                ),
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-gray-400 text-xs font-medium uppercase
                               tracking-wide mb-1.5">
                  {label}
                </p>
                {value}
              </div>
            ))}
          </div>

          {/* Verified documents (Part 6) */}
          {verifiedDocCount > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                Verified Documents
              </p>
              <DocumentBadges documents={worker.documents} />
            </div>
          )}
        </div>

        {/* ── Reviews ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">
            Reviews
            {(worker.reviewCount ?? 0) > 0 && (
              <span className="ml-2 text-gray-400 font-normal text-base">
                ({worker.reviewCount})
              </span>
            )}
          </h2>

          {workerReviewsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="sm" label="Loading reviews…" />
            </div>
          ) : workerReviews.length === 0 ? (
            <div className="text-center py-8">
              <StarIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workerReviews.slice(0, 10).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showBooking && (
        <BookingModal
          worker={worker}
          onClose={() => setShowBooking(false)}
          onOpenChat={() => setShowChat(true)}
        />
      )}
      {showChat && user && (
        <ChatModal peer={worker} onClose={() => setShowChat(false)} />
      )}
    </>
  );
}