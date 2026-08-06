'use client';

import { useEffect, useMemo, useState }  from 'react';
import Link                              from 'next/link';
import { useRouter }                     from 'next/navigation';
import { usePublicAuthStore }            from '@/store/publicAuthStore';
import { useUserStore }                  from '@/store/userStore';
import { useBookingStore }               from '@/store/bookingStore';
import { useJobRequestStore }            from '@/store/jobRequestStore';
import NearbyWorkers                     from '@/components/public/NearbyWorkers';
import NotificationBell                  from '@/components/public/NotificationBell';
import ReviewModal                       from '@/components/public/ReviewModal';
import LoadingSpinner                    from '@/components/shared/LoadingSpinner';
import { formatPrice }                   from '@/lib/pricing';
import {
  BookingIcon, ServicesIcon, ArrowRightIcon,
  LogoutIcon, UserIcon, StarIcon, EditIcon,
}                                        from '@/components/icons';

const STATUS_CLS = {
  pending:   'bg-amber-100  text-amber-700',
  accepted:  'bg-blue-100   text-blue-700',
  completed: 'bg-green-100  text-green-700',
  cancelled: 'bg-gray-100   text-gray-500',
};

const JOB_STATUS_CLS = {
  open:     'bg-amber-100  text-amber-700',
  quoted:   'bg-blue-100   text-blue-700',
  accepted: 'bg-green-100  text-green-700',
  closed:   'bg-gray-100   text-gray-500',
};

// ─── Profile completion banner ────────────────────────────────────────────────

function ProfileBanner({ user }) {
  const steps = [
    { label: 'Full name',      done: !!(user?.name?.trim())                              },
    { label: 'Mobile number',  done: !!(user?.phone?.trim())                             },
    { label: 'Gender',         done: !!(user?.gender)                                    },
    { label: 'Location',       done: !!(user?.location?.address || user?.location?.lat)  },
  ];
  const pct = Math.round(steps.filter((s) => s.done).length / steps.length * 100);
  if (pct === 100) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <EditIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-amber-900">
            Complete your profile ({pct}%)
          </h3>
          <p className="text-amber-700 text-xs mt-0.5 mb-2">
            Complete your profile so workers can reach you easily.
          </p>
          <div className="h-2 bg-amber-200 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {steps.map(({ label, done }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                            text-xs font-medium
                            ${done
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'}`}
              >
                {done ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                {label}
              </span>
            ))}
          </div>
        </div>
        <Link
          href="/customer-profile"
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm
                     font-semibold rounded-xl transition-colors shrink-0"
        >
          Edit Profile
        </Link>
      </div>
    </div>
  );
}

function LocationPinIcon({ className }) {
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

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { user, logout } = usePublicAuthStore();

  const {
    publicWorkers, publicWorkersLoading,
    subscribePublicWorkers, unsubscribePublicWorkers,
  } = useUserStore();

  const {
    customerBookings, customerBookingsLoading,
    subscribeCustomerBookings, unsubscribeCustomerBookings,
  } = useBookingStore();

  const {
    customerRequests, customerRequestsLoading,
    subscribeCustomerRequests, unsubscribeCustomerRequests,
  } = useJobRequestStore();

  // Part 7: review modal state
  const [reviewTarget, setReviewTarget] = useState(null);

  useEffect(() => {
    subscribePublicWorkers();
    return () => unsubscribePublicWorkers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.uid) {
      subscribeCustomerBookings(user.uid);
      subscribeCustomerRequests(user.uid);
    }
    return () => {
      unsubscribeCustomerBookings();
      unsubscribeCustomerRequests();
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Part 4: pre-sort workers by stored location
  const workersForDisplay = useMemo(() => {
    const lat = user?.location?.lat;
    const lng = user?.location?.lng;
    if (!lat || !lng || publicWorkers.length === 0) return publicWorkers;
    return [...publicWorkers]
      .map((w) => {
        if (!w.location?.lat || !w.location?.lng) return { ...w, distance: Infinity };
        const dLat = ((w.location.lat - lat) * Math.PI) / 180;
        const dLng = ((w.location.lng - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((w.location.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        return { ...w, distance: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [publicWorkers, user?.location?.lat, user?.location?.lng]);

  // BUG FIX: this only matched the legacy 'pending' / 'accepted' status
  // names. The current booking flow (BookingModal + chat negotiation) uses
  // pending_chat → discussing → final_price_pending → ready_for_payment →
  // paid → completed, none of which matched, so this stat undercounted
  // (often showing 0) for most customers. customer-bookings/page.jsx and
  // worker-dashboard/page.jsx already OR the legacy names against the
  // current ones — this brings the dashboard stat in line with them.
  const activeBookings = customerBookings.filter(
    (b) => [
      'pending', 'pending_chat', 'accepted', 'discussing',
      'final_price_pending', 'ready_for_payment',
    ].includes(b.status),
  ).length;
  const openRequests = customerRequests.filter(
    (r) => r.status === 'open' || r.status === 'quoted',
  ).length;
  const recentBookings = useMemo(() => [...customerBookings].slice(0, 5), [customerBookings]);
  const recentRequests = useMemo(() => [...customerRequests].slice(0, 5), [customerRequests]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Customer Dashboard
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}!
          </h1>
          <p className="text-gray-400 mt-1 text-sm flex items-center gap-1.5 flex-wrap">
            Find skilled professionals and manage your service requests.
            {/* Part 8: replaced 📍 emoji with SVG icon */}
            {user?.location?.address && (
              <span className="inline-flex items-center gap-1 text-blue-500 font-medium
                               text-xs">
                <LocationPinIcon className="w-3 h-3" />
                {user.location.address}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <NotificationBell />
          <Link
            href="/customer-profile"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border
                       border-gray-200 text-gray-600 hover:border-gray-300
                       text-sm font-medium transition-colors"
          >
            <UserIcon className="w-4 h-4" />
            My Profile
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border
                       border-gray-200 text-gray-500 hover:border-gray-300
                       text-sm font-medium transition-colors"
          >
            <LogoutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Profile completion banner */}
      <ProfileBanner user={user} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Workers Available',
            value: publicWorkers.length,
            icon:  <UserIcon className="w-5 h-5 text-blue-500" />,
            bg:    'bg-blue-50',
          },
          {
            label: 'Active Bookings',
            value: activeBookings,
            icon:  <BookingIcon className="w-5 h-5 text-amber-500" />,
            bg:    'bg-amber-50',
          },
          {
            label: 'Open Requests',
            value: openRequests,
            icon:  (
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            ),
            bg: 'bg-purple-50',
          },
          {
            label: 'Verified Pros',
            value: publicWorkers.filter((w) => w.isVerified).length,
            icon:  (
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            ),
            bg: 'bg-emerald-50',
          },
        ].map(({ label, value, icon, bg }) => (
          <div key={label}
               className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center
                            justify-center mb-3`}>
              {icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Quick Actions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/job-requests"
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm
                           p-6 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center
                              justify-center">
                <BookingIcon className="w-6 h-6 text-blue-600" />
              </div>
              <ArrowRightIcon className="w-5 h-5 text-gray-300 group-hover:text-blue-500
                                         group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">My Job Requests</h3>
            <p className="text-gray-500 text-sm">Post a request, compare quotes, and book.</p>
          </Link>

          <Link href="/services"
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm
                           p-6 hover:shadow-md hover:border-emerald-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center
                              justify-center">
                <ServicesIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <ArrowRightIcon className="w-5 h-5 text-gray-300 group-hover:text-emerald-500
                                         group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Browse Workers</h3>
            <p className="text-gray-500 text-sm">Find professionals near you.</p>
          </Link>

          <Link href="/chats"
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm
                           p-6 hover:shadow-md hover:border-purple-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center
                              justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847
                       2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354
                       0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334
                       a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094
                       -1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345
                       -8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0
                       0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76
                       3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14
                       1.74.194V21l4.155-4.155" />
                </svg>
              </div>
              <ArrowRightIcon className="w-5 h-5 text-gray-300 group-hover:text-purple-500
                                         group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">My Chats</h3>
            <p className="text-gray-500 text-sm">Discuss details and agree on prices.</p>
          </Link>
        </div>
      </div>

      {/* Recent bookings — Part 7: "Leave Review" button for completed */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Bookings</h2>
          <Link href="/customer-bookings"
                className="text-blue-600 text-sm font-semibold hover:underline
                           flex items-center gap-1">
            View all <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        {customerBookingsLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="sm" label="Loading bookings…" />
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <BookingIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">No bookings yet</p>
            <Link href="/services"
                  className="mt-3 inline-block text-blue-600 text-sm font-semibold
                             hover:underline">
              Find a worker →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentBookings.map((booking) => (
              <div key={booking.id}
                   role="button"
                   tabIndex={0}
                   onClick={() => router.push('/customer-bookings')}
                   onKeyDown={(e) => e.key === 'Enter' && router.push('/customer-bookings')}
                   className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50
                              transition-colors cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {booking.workerName}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                      ${STATUS_CLS[booking.status] ?? STATUS_CLS.pending}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">{booking.categoryName}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Part 7: Leave Review for completed bookings */}
                  {booking.status === 'completed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReviewTarget(booking); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg
                                 bg-amber-50 border border-amber-200 text-amber-700
                                 text-xs font-semibold hover:bg-amber-100 transition-colors"
                    >
                      <StarIcon className="w-3.5 h-3.5" />
                      Review
                    </button>
                  )}

                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">
                      {booking.priceQuoted > 0
                        ? formatPrice(booking.priceQuoted)
                        : <span className="text-gray-400 font-medium">To be discussed</span>}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {booking.createdAt
                        ? new Date(booking.createdAt).toLocaleDateString('en-IN', {
                            month: 'short', day: 'numeric',
                          })
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent job requests */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Job Requests</h2>
          <Link href="/job-requests"
                className="text-blue-600 text-sm font-semibold hover:underline
                           flex items-center gap-1">
            View all <ArrowRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        {customerRequestsLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="sm" label="Loading requests…" />
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <p className="text-gray-500 font-medium text-sm">No job requests yet</p>
            <Link href="/job-requests"
                  className="mt-3 inline-block text-blue-600 text-sm font-semibold
                             hover:underline">
              Post your first request →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentRequests.map((req) => (
              <div key={req.id}
                   className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50
                              transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {req.categoryName}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                      ${JOB_STATUS_CLS[req.status] ?? JOB_STATUS_CLS.open}`}>
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">{req.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-blue-700 text-sm">
                    {req.quotesCount ?? 0} quote{req.quotesCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-gray-400 text-xs">
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
      </div>

      {/* Workers near you */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {user?.location ? 'Workers Near You' : 'Available Workers'}
            </h2>
            {user?.location?.address && (
              <p className="text-sm text-gray-400 mt-0.5">
                Near {user.location.address}
              </p>
            )}
          </div>
          <Link href="/services"
                className="text-sm font-semibold text-blue-600 hover:underline">
            View all →
          </Link>
        </div>

        {publicWorkersLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="md" label="Finding workers…" />
          </div>
        ) : (
          <NearbyWorkers
            workers={workersForDisplay}
            maxVisible={6}
            compact
            initialLocation={user?.location ?? null}
          />
        )}
      </div>

      {/* Part 7: Review modal triggered from recent bookings */}
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSuccess={() => setReviewTarget(null)}
        />
      )}
    </div>
  );
}