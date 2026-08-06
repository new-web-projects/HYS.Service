'use client';

import { useEffect, useState, useMemo } from 'react';
import Link                             from 'next/link';
import { usePublicAuthStore }           from '@/store/publicAuthStore';
import { useUserStore }                 from '@/store/userStore';
import { useBookingStore }              from '@/store/bookingStore';
import NotificationBell                 from '@/components/public/NotificationBell';
import ChatModal                         from '@/components/public/ChatModal';
import LoadingSpinner                   from '@/components/shared/LoadingSpinner';
import { BookingCardSkeleton, StatsRowSkeleton, WithdrawalItemSkeleton, ConfirmModal } from '@/components/shared/Skeletons';
import { useEarningsStore }              from '@/store/earningsStore';
import {
  useWithdrawalStore,
  validateWithdrawalAmount,
  calculateWithdrawalFee,
  WITHDRAWAL_MIN,
  WITHDRAWAL_MAX,
  WITHDRAWAL_STEP,
}                                        from '@/store/withdrawalStore';
import { useToast }                     from '@/components/shared/Toast';
import { formatPrice, getPricingRates } from '@/lib/pricing';
import {
  BookingIcon, ServicesIcon, ArrowRightIcon,
  CheckIcon, LogoutIcon, EditIcon,
  BellIcon, PaymentIcon, VerifiedIcon,
}                                       from '@/components/icons';

const STATUS_STYLES = {
  // Part 13: full booking status flow
  pending_chat:             { label: 'New Request',     color: 'bg-amber-100  text-amber-700'  },
  discussing:               { label: 'Discussing',      color: 'bg-blue-100   text-blue-700'   },
  final_price_pending:      { label: 'Price Pending',   color: 'bg-purple-100 text-purple-700' },
  ready_for_payment:        { label: 'Awaiting Payment',color: 'bg-indigo-100 text-indigo-700' },
  paid:                     { label: 'Paid',            color: 'bg-emerald-100 text-emerald-700'},
  completed:                { label: 'Completed',       color: 'bg-green-100  text-green-700'  },
  cancelled_before_payment: { label: 'Cancelled',       color: 'bg-gray-100   text-gray-500'   },
  // Legacy fallback
  pending:                  { label: 'New Request',     color: 'bg-amber-100  text-amber-700'  },
  accepted:                 { label: 'Discussing',      color: 'bg-blue-100   text-blue-700'   },
  cancelled:                { label: 'Cancelled',       color: 'bg-gray-100   text-gray-500'   },
};

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  });
}

function formatDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Profile completion banner ────────────────────────────────────────────────

function ProfileBanner({ profile }) {
  const steps = [
    { label: 'Mobile number',   done: !!(profile?.phone?.trim())                              },
    { label: 'Gender',          done: !!(profile?.gender)                                     },
    { label: 'Category',        done: !!(profile?.categoryId)                                 },
    { label: 'Starting price',  done: (profile?.startingPrice ?? profile?.pricePerHour ?? 0) > 0 },
    { label: 'Location set',    done: !!(profile?.location?.lat || profile?.location?.address) },
    { label: 'Experience',      done: (profile?.experienceYears ?? 0) > 0                     },
    { label: 'Profile image',   done: !!profile?.profileImageUrl                              },
    { label: 'Bio (20+ chars)', done: (profile?.bio?.length ?? 0) >= 20                       },
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
          <div className="h-2 bg-amber-200 rounded-full overflow-hidden my-2">
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
                {/* Part 8: SVG icons instead of ✓ and ○ text chars */}
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
          href="/worker-profile"
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm
                     font-semibold rounded-xl transition-colors shrink-0"
        >
          Edit Profile
        </Link>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function WorkerDashboardPage() {
  const { user, logout }                            = usePublicAuthStore();
  const { getWorkerProfile, setWorkerAvailability } = useUserStore();
  const {
    workerBookings,
    workerBookingsLoading,
    subscribeWorkerBookings,
    unsubscribeWorkerBookings,
    acceptBooking,
    rejectBooking,
    verifyOtpAndComplete,
    cancelBooking,
  }                                                 = useBookingStore();
  const toast = useToast((s) => s.show);

  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [toggling,     setToggling]     = useState(false);
  const [actionId,     setActionId]     = useState(null);

  // Part 6 — Admin GST Mode System: controls "incl. GST" wording on withdrawal breakdown.
  const [gstModeEnabled, setGstModeEnabled] = useState(false);
  useEffect(() => {
    getPricingRates().then((rates) => setGstModeEnabled(rates.gstModeEnabled));
  }, []);
  const [chatCustomer, setChatCustomer] = useState(null);
  const [otpInputs,       setOtpInputs]       = useState({});
  const [otpErrors,       setOtpErrors]       = useState({});
  const [otpVerifying,    setOtpVerifying]    = useState({});
  const [confirmDecline,  setConfirmDecline]  = useState(null);
  const [confirmCancelWk, setConfirmCancelWk] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending_chat');

  const earningsStore        = useEarningsStore();
  const earningsList         = earningsStore.earningsList;
  const subscribeEarnings    = earningsStore.subscribeEarnings.bind(earningsStore);
  const unsubscribeEarnings  = earningsStore.unsubscribeEarnings.bind(earningsStore);
  const getMonthlyHistory    = earningsStore.getMonthlyHistory.bind(earningsStore);
  const availableBalance     = earningsStore.availableBalance;
  const pendingWithdrawal    = earningsStore.pendingWithdrawal;
  const completedWithdrawals = earningsStore.completedWithdrawals;
  const lockedBalance        = earningsStore.lockedBalance;
  const totalEarnings        = earningsStore.totalEarnings;

  const withdrawalStore       = useWithdrawalStore();
  const withdrawals           = withdrawalStore.withdrawals;
  const withdrawalsLoading    = withdrawalStore.withdrawalsLoading;
  const subscribeWithdrawals  = withdrawalStore.subscribeWithdrawals.bind(withdrawalStore);
  const unsubscribeWithdrawals = withdrawalStore.unsubscribeWithdrawals.bind(withdrawalStore);
  const loadProcessingFee     = withdrawalStore.loadProcessingFee.bind(withdrawalStore);
  const requestWithdrawal     = withdrawalStore.requestWithdrawal.bind(withdrawalStore);
  const cancelWithdrawal      = withdrawalStore.cancelWithdrawal.bind(withdrawalStore);
  const processingFeePercent  = withdrawalStore.processingFeePercent;

  const [showWithdrawModal,   setShowWithdrawModal]   = useState(false);
  const [withdrawAmount,      setWithdrawAmount]      = useState('');
  const [withdrawMethod,      setWithdrawMethod]      = useState('upi');
  const [withdrawing,         setWithdrawing]         = useState(false);
  const [withdrawError,       setWithdrawError]       = useState('');
  const [upiId,               setUpiId]               = useState('');
  const [accountHolderName,   setAccountHolderName]   = useState('');
  const [bankName,            setBankName]            = useState('');
  const [accountNumber,       setAccountNumber]       = useState('');
  const [ifscCode,            setIfscCode]            = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    getWorkerProfile(user.uid)
      .then((p) => { setProfile(p); setLoading(false); })
      .catch(() => setLoading(false));
    subscribeWorkerBookings(user.uid);
    subscribeEarnings(user.uid);
    subscribeWithdrawals(user.uid);
    loadProcessingFee();
    return () => {
      unsubscribeWorkerBookings();
      unsubscribeEarnings();
      unsubscribeWithdrawals();
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAvailability() {
    if (!profile || toggling) return;
    setToggling(true);
    const newVal = !profile.isAvailable;
    try {
      await setWorkerAvailability(user.uid, newVal);
      setProfile((p) => ({ ...p, isAvailable: newVal }));
      toast(newVal ? 'You are now visible to customers!' : 'You are now hidden.', 'success');
    } catch (err) {
      toast(err.message ?? 'Update failed.', 'error');
    } finally {
      setToggling(false);
    }
  }

  async function doAction(fn, bookingId, booking, isAccept = false) {
    setActionId(bookingId);
    try {
      await fn(bookingId, booking);
      toast(isAccept ? 'Booking accepted! Opening chat…' : 'Updated successfully.', 'success');
      if (isAccept) {
        setChatCustomer({
          uid:             booking.customerId,
          id:              booking.customerId,
          name:            booking.customerName,
          categoryName:    booking.categoryName ?? '',
          profileImageUrl: '',
        });
      }
    } catch (err) {
      toast(err.message ?? 'Action failed.', 'error');
    } finally {
      setActionId(null);
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const pendingCount   = workerBookings.filter((b) => b.status === 'pending_chat' || b.status === 'pending').length;
  const completedJobs  = useMemo(
    () => workerBookings.filter((b) => b.status === 'completed')
                        .sort((a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0)),
    [workerBookings],
  );
  const completedCount = completedJobs.length;

  // Earnings from workerEarnings collection via earningsStore (real-time)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const earningsHistory = useMemo(() => getMonthlyHistory(6), [earningsList]);
  const paidEarnings    = totalEarnings;

  const filteredBookings = statusFilter === 'all'
    ? workerBookings
    : workerBookings.filter((b) => {
        if (statusFilter === 'pending_chat') return b.status === 'pending_chat' || b.status === 'pending';
        if (statusFilter === 'cancelled_before_payment') return b.status === 'cancelled_before_payment' || b.status === 'cancelled';
        return b.status === statusFilter;
      });

  const AUTO_VERIFY_AT   = 999;
  const ordersCompleted  = profile?.ordersCompleted ?? 0;
  const verifyPct        = Math.min(100, (ordersCompleted / AUTO_VERIFY_AT) * 100);
  const ordersRemaining  = Math.max(0, AUTO_VERIFY_AT - ordersCompleted);


  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Worker Dashboard
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            Hello, {user?.name?.split(' ')[0] ?? 'Worker'}!
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {profile?.categoryName ?? 'Set your category in profile settings'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link
            href="/worker-profile"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border
                       border-gray-200 text-gray-600 text-sm font-medium
                       hover:border-gray-300 transition-colors"
          >
            <EditIcon className="w-4 h-4" />
            Edit Profile
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border
                       border-gray-200 text-gray-500 text-sm font-medium
                       hover:border-gray-300 transition-colors"
          >
            <LogoutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Profile completion — BUG FIX: now counts address too */}
      {!loading && profile && <ProfileBanner profile={profile} />}

      {/* Availability toggle */}
      {profile && (
        <div className={`rounded-2xl border-2 p-5 transition-all duration-300
                         ${profile.isAvailable
                           ? 'bg-green-50 border-green-300'
                           : 'bg-gray-50 border-gray-200'}`}>
          {/* FIXED: flex-col on mobile prevents button overflowing the card boundary.
               On sm+ breakpoint it reverts to the original side-by-side layout. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center
                               shrink-0 transition-all
                               ${profile.isAvailable ? 'bg-green-200' : 'bg-gray-200'}`}>
                <span className={`w-4 h-4 rounded-full transition-all
                                  ${profile.isAvailable
                                    ? 'bg-green-500 shadow-lg shadow-green-300'
                                    : 'bg-gray-400'}`} />
              </div>
              <div>
                <h3 className={`font-bold text-lg transition-colors
                                ${profile.isAvailable ? 'text-green-800' : 'text-gray-600'}`}>
                  {profile.isAvailable ? 'Available' : 'Unavailable'}
                </h3>
                <p className={`text-sm ${profile.isAvailable ? 'text-green-600' : 'text-gray-400'}`}>
                  {profile.isAvailable
                    ? 'Customers can see and book you.'
                    : 'Hidden from all search results.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleAvailability}
              disabled={toggling}
              className={`flex items-center justify-center gap-3 px-5 py-3 rounded-2xl font-bold
                          text-sm transition-all w-full sm:w-auto sm:shrink-0 disabled:opacity-60
                          ${profile.isAvailable
                            ? 'bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-200'
                            : 'bg-gray-300 hover:bg-gray-400 text-gray-700'}`}
            >
              <span className={`relative w-10 h-5 rounded-full transition-colors
                                ${profile.isAvailable ? 'bg-green-400' : 'bg-gray-400'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow
                                  transition-transform
                                  ${profile.isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
              <span>
                {toggling ? 'Updating…' : profile.isAvailable ? 'Turn Off' : 'Turn On'}
              </span>
            </button>
          </div>

          {profile.isAvailable && (
            <div className="mt-4 pt-4 border-t border-green-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-green-600 text-xs font-medium">
                You are live — new booking requests will appear below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: workerBookings.length,  Icon: BookingIcon  },
          { label: 'New Requests',   value: pendingCount,            Icon: BellIcon     },
          { label: 'Completed Jobs', value: completedCount,          Icon: CheckIcon    },
          { label: 'Paid Earnings',  value: formatPrice(paidEarnings), Icon: PaymentIcon },
        ].map(({ label, value, Icon }) => (
          <div key={label}
               className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <div className="flex justify-center mb-2 text-gray-400">
              <Icon className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Auto-verify progress */}
      {profile && !profile.isVerified && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <VerifiedIcon className="w-4 h-4 text-gray-400" />
                <p className="font-semibold text-gray-900 text-sm">Verification Progress</p>
              </div>
              <p className="text-gray-400 text-xs mt-0.5">
                Auto-verified after {AUTO_VERIFY_AT} completed orders.
              </p>
            </div>
            <span className="text-sm font-bold text-gray-700">
              {ordersCompleted} / {AUTO_VERIFY_AT}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                 style={{ width: `${verifyPct}%` }} />
          </div>
          <p className="text-gray-400 text-xs mt-1.5">
            {ordersRemaining} order{ordersRemaining !== 1 ? 's' : ''} to auto-verification.
          </p>
        </div>
      )}

      {/* Verified badge */}
      {profile?.isVerified && (
        <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border
                        border-blue-200 rounded-2xl">
          <VerifiedIcon className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">Verified Professional</p>
            <p className="text-blue-600 text-xs">
              Your profile shows a verified badge to customers.
            </p>
          </div>
        </div>
      )}

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Job Board */}
        <Link href="/job-board"
              className="group block bg-white rounded-2xl border border-gray-100 shadow-sm
                         p-6 hover:shadow-md hover:border-blue-200 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center
                            justify-center shrink-0">
              <ServicesIcon className="w-7 h-7 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg mb-0.5">Job Board</h3>
              <p className="text-gray-500 text-sm">Browse requests and send quotes.</p>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-300 group-hover:text-blue-500
                                        group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        </Link>

        {/* Chats */}
        <Link href="/worker-chats"
              className="group block bg-white rounded-2xl border border-gray-100 shadow-sm
                         p-6 hover:shadow-md hover:border-purple-200 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center
                            justify-center shrink-0">
              <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={1.75}>
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
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg mb-0.5">Customer Chats</h3>
              <p className="text-gray-500 text-sm">Discuss details and agree on pricing.</p>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-300 group-hover:text-purple-500
                                        group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        </Link>
      </div>

      {/* ── Booking requests ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Booking Requests</h2>
          {/* FIXED: scrollable tabs — hidden scrollbar, no flex-1, whitespace-nowrap
               prevents "Awaiting Payment" / "Price Pending" from overflowing on mobile.
               Duplicate 'all' entry removed (was causing React key conflict). */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1
                          overflow-x-auto
                          [&::-webkit-scrollbar]:hidden
                          [-ms-overflow-style:none]
                          [scrollbar-width:none]">
            {[
              { id: 'all',                      label: 'All'                   },
              { id: 'pending_chat',              label: `New (${pendingCount})` },
              { id: 'discussing',               label: 'Discussing'            },
              { id: 'final_price_pending',      label: 'Price Pending'         },
              { id: 'ready_for_payment',        label: 'Awaiting Payment'      },
              { id: 'paid',                     label: 'Paid'                  },
              { id: 'completed',                label: 'Completed'             },
              { id: 'cancelled_before_payment', label: 'Cancelled'             },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold
                            whitespace-nowrap transition-colors
                            ${statusFilter === id
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {workerBookingsLoading ? (
          <div className="space-y-4">
            {[1,2,3].map((i) => <BookingCardSkeleton key={i} />)}
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BookingIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-medium text-gray-500">
              {statusFilter === 'pending_chat' || statusFilter === 'pending' ? 'No new requests' : `No ${statusFilter.replace(/_/g, ' ')} bookings`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredBookings.map((booking) => {
              const statusInfo = STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending;
              const isActing   = actionId === booking.id;

              return (
                <div key={booking.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{booking.customerName}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                                          ${statusInfo.color}`}>
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

                  <div className="text-sm space-y-1 text-gray-600">
                    {booking.scheduledAt && (
                      <p>
                        <span className="text-gray-400">Date: </span>
                        {formatDateTime(booking.scheduledAt)}
                      </p>
                    )}
                    {booking.address && (
                      <p className="truncate">
                        <span className="text-gray-400">Address: </span>
                        {booking.address}
                      </p>
                    )}
                    {booking.description && (
                      <p className="line-clamp-2">
                        <span className="text-gray-400">Job: </span>
                        {booking.description}
                      </p>
                    )}
                    {booking.notes && (
                      <p className="line-clamp-2">
                        <span className="text-gray-400">Notes: </span>
                        {booking.notes}
                      </p>
                    )}
                  </div>

                  {/* Customer phone — revealed after payment */}
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
                          Customer Mobile — revealed after payment
                        </p>
                        <p className="font-bold text-green-900">
                          {booking.customerPhone ?? 'Not provided by customer'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Paid — cannot cancel notice */}
                  {(booking.paymentStatus === 'paid' || booking.status === 'paid') && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50
                                    border border-amber-200 rounded-xl">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none"
                           viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                             002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                             00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <p className="text-amber-700 text-xs font-medium">
                        Payment received — this booking cannot be cancelled.
                      </p>
                    </div>
                  )}

                  {(booking.status === 'pending_chat' || booking.status === 'pending') && (() => {
                    // BUG FIX: this used to check b.status === 'accepted', but
                    // markBookingPaid() always sets status to 'paid' once a
                    // booking is paid (regardless of what it was before), so
                    // that condition could never actually match a paid,
                    // unverified job — this pre-emptive warning banner never
                    // showed even though acceptBooking() itself correctly
                    // blocks on status === 'paid'. Checking 'paid' here keeps
                    // the two in sync.
                    const hasActivePaidJob = workerBookings.some(
                      (b) => b.id !== booking.id &&
                             b.paymentStatus === 'paid' &&
                             b.status === 'paid' &&
                             !b.otpVerified,
                    );
                    return (
                      <div className="space-y-2">
                        {hasActivePaidJob && (
                          <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-red-700 text-xs font-semibold">
                              ⚠ You have an active paid job in progress.
                            </p>
                            <p className="text-red-600 text-xs mt-0.5">
                              Complete your current job using the customer's OTP before accepting new orders.
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => doAction(acceptBooking, booking.id, booking, true)}
                            disabled={isActing || hasActivePaidJob}
                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white
                                       text-sm font-semibold rounded-xl transition-colors
                                       disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isActing ? <LoadingSpinner size="xs" /> : (
                              <><CheckIcon className="w-4 h-4" /> Accept</>
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDecline(booking)}
                            disabled={isActing}
                            className="flex-1 py-2.5 border-2 border-red-200 text-red-600
                                       text-sm font-semibold rounded-xl hover:bg-red-50
                                       transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {booking.status === 'paid' && booking.paymentStatus === 'paid' && booking.otpStatus !== 'locked' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700">
                        Enter Customer OTP to Complete Job
                      </p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Ask the customer for their 6-digit OTP after finishing the work.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit OTP"
                          value={otpInputs[booking.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setOtpInputs((p) => ({ ...p, [booking.id]: val }));
                            setOtpErrors((p) => ({ ...p, [booking.id]: '' }));
                          }}
                          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200
                                     text-gray-900 text-sm font-mono tracking-widest
                                     focus:outline-none focus:border-blue-500 transition-colors
                                     placeholder-gray-300"
                        />
                        <button
                          onClick={async () => {
                            const otp = (otpInputs[booking.id] ?? '').trim();
                            if (otp.length !== 6) {
                              setOtpErrors((p) => ({ ...p, [booking.id]: 'OTP must be 6 digits.' }));
                              return;
                            }
                            setOtpVerifying((p) => ({ ...p, [booking.id]: true }));
                            try {
                              await verifyOtpAndComplete(booking.id, booking, otp);
                              toast('Job completed successfully!', 'success');
                              setOtpInputs((p) => ({ ...p, [booking.id]: '' }));
                            } catch (err) {
                              setOtpErrors((p) => ({ ...p, [booking.id]: err.message }));
                              toast(err.message, 'error');
                            } finally {
                              setOtpVerifying((p) => ({ ...p, [booking.id]: false }));
                            }
                          }}
                          disabled={otpVerifying[booking.id] || (otpInputs[booking.id] ?? '').length !== 6}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                                     text-sm font-semibold rounded-xl transition-colors
                                     disabled:opacity-50 flex items-center gap-2 shrink-0"
                        >
                          {otpVerifying[booking.id]
                            ? <LoadingSpinner size="xs" />
                            : 'Verify & Complete'}
                        </button>
                      </div>
                      {otpErrors[booking.id] && (
                        <p className="text-red-500 text-xs font-medium">
                          {otpErrors[booking.id]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Persistent Chat button ────────────────────────────────
                       ROOT CAUSE FIX (Part 2): Chat was only opened once on
                       booking acceptance. After navigating away, there was no
                       way to reopen the conversation. Now always visible for
                       any accepted / active booking status. */}
                  {['discussing', 'final_price_pending', 'ready_for_payment',
                    'paid', 'accepted'].includes(booking.status) && (
                    <button
                      onClick={() => setChatCustomer({
                        uid:             booking.customerId,
                        id:              booking.customerId,
                        name:            booking.customerName ?? 'Customer',
                        categoryName:    booking.categoryName ?? '',
                        profileImageUrl: '',
                      })}
                      className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700
                                 text-sm font-semibold rounded-xl border border-blue-200
                                 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                           stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0
                             012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Chat with Customer
                    </button>
                  )}

                  {/* Worker cancel — allowed when accepted but NOT yet readyForPayment */}
                  {(booking.status === 'discussing' ||
                    booking.status === 'final_price_pending' ||
                    booking.status === 'accepted') &&
                   booking.paymentStatus !== 'paid' &&
                   !booking.readyForPayment && (
                    <button
                      onClick={() => setConfirmCancelWk(booking)}
                      disabled={isActing}
                      className="w-full py-2.5 border-2 border-red-200 text-red-600
                                 text-sm font-semibold rounded-xl hover:bg-red-50
                                 transition-colors disabled:opacity-50"
                    >
                      Cancel Booking
                    </button>
                  )}

                  {/* Locked state */}
                  {booking.status === 'paid' &&
                   booking.paymentStatus === 'paid' &&
                   booking.otpStatus === 'locked' && (
                    <div className="px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl">
                      <p className="font-bold text-red-800 text-sm">
                        ⛔ OTP Locked
                      </p>
                      <p className="text-red-700 text-xs mt-0.5 leading-relaxed">
                        Too many incorrect attempts. This booking is locked.
                        Contact support for manual resolution.
                      </p>
                    </div>
                  )}
                </div>
            );
        })}
          </div>
        )}
      </div>

      {/* ── Completed Jobs History (Part 6) ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Completed Jobs</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {completedCount} job{completedCount !== 1 ? 's' : ''} completed
            </p>
          </div>
          {completedCount > 5 && (
            <span className="text-xs text-gray-400">Showing last 5</span>
          )}
        </div>

        {completedCount === 0 ? (
          <div className="px-6 py-10 text-center">
            <CheckIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">No completed jobs yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Accept bookings and mark them complete to build your history.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {completedJobs.slice(0, 5).map((booking) => (
              <div key={booking.id}
                   className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50
                              transition-colors">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center
                                justify-center shrink-0">
                  <CheckIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {booking.customerName}
                  </p>
                  <p className="text-gray-400 text-xs">{booking.categoryName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 text-sm">
                    {formatPrice(booking.basePrice ?? booking.priceQuoted)}
                  </p>
                  <p className={`text-xs ${
                    booking.paymentStatus === 'paid' ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </p>
                  <p className="text-gray-300 text-xs mt-0.5">
                    {formatDateShort(booking.updatedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Part 7: Earnings System ──────────────────────────────────────── */}

      {/* Balance cards */}
      {earningsStore.earningsLoading ? (
        <StatsRowSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Available Balance', value: availableBalance,     color: 'emerald', hint: 'Ready to withdraw' },
          { label: 'Pending Withdrawal', value: pendingWithdrawal,   color: 'amber',  hint: 'Being processed'   },
          { label: 'Total Earned',       value: totalEarnings,       color: 'blue',   hint: 'All completed jobs' },
          { label: 'Total Withdrawn',    value: completedWithdrawals, color: 'gray',  hint: 'Paid out to you'   },
        ].map(({ label, value, color, hint }) => {
          const colorMap = {
            emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold',
            amber:   'bg-amber-50  border-amber-200  text-amber-700  font-bold',
            blue:    'bg-blue-50   border-blue-200   text-blue-700   font-bold',
            gray:    'bg-gray-50   border-gray-200   text-gray-700   font-bold',
          };
          return (
            <div key={label}
                 className={`rounded-2xl border p-4 ${colorMap[color].split(' ').slice(0,2).join(' ')}`}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-extrabold ${colorMap[color].split(' ').slice(2).join(' ')}`}>
                {formatPrice(value)}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">{hint}</p>
            </div>
          );
        })}
        </div>
      )}

      {/* Locked balance notice */}
      {lockedBalance > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25
                 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-gray-600 text-sm">
            <strong>{formatPrice(lockedBalance)}</strong> is locked pending OTP verification of active jobs.
            Complete those jobs to unlock these earnings.
          </p>
        </div>
      )}

      {/* Earnings history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-gray-900">Earnings History</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Monthly breakdown — last 6 months
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-gray-900">
              {formatPrice(paidEarnings)}
            </p>
            <p className="text-gray-400 text-xs">lifetime earned</p>
          </div>
        </div>

        {earningsHistory.length === 0 ? (
          <div className="py-8 text-center">
            <PaymentIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              No earnings yet. Complete jobs via OTP to see history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              const maxE = Math.max(...earningsHistory.map((e) => e.amount), 1);
              return earningsHistory.map(({ label, amount, count }) => {
              const pct  = Math.round((amount / maxE) * 100);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{label}</span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">
                        {formatPrice(amount)}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {count} job{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
              });
            })()}
          </div>
        )}

        {/* Per-entry earnings list */}
        {earningsList.filter((e) => e.status !== 'locked').length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
              Recent Earnings
            </p>
            <div className="space-y-2">
              {earningsList
                .filter((e) => e.status !== 'locked')
                .slice(0, 10)
                .map((e) => (
                  <div key={e.id}
                       className="flex items-center justify-between py-2.5 px-4
                                  rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {e.categoryName || 'Service'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {e.customerName} ·{' '}
                        {e.unlockedAt
                          ? new Date(e.unlockedAt).toLocaleDateString('en-IN')
                          : e.paidAt
                          ? new Date(e.paidAt).toLocaleDateString('en-IN')
                          : '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-emerald-700">
                        +{formatPrice(e.baseAmount)}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                        ${e.status === 'available'           ? 'bg-emerald-100 text-emerald-700' :
                          e.status === 'pending_withdrawal'  ? 'bg-amber-100  text-amber-700'   :
                          e.status === 'withdrawn'           ? 'bg-gray-100   text-gray-500'    :
                                                               'bg-red-100    text-red-500'     }`}>
                        {e.status === 'available'           ? 'Available'   :
                         e.status === 'pending_withdrawal'  ? 'Processing'  :
                         e.status === 'withdrawn'           ? 'Withdrawn'   : e.status}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
      {/* ── Part 8: Withdrawal System ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Withdraw Earnings</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Min ₹1,000 · Max ₹20,000 · Multiples of ₹1,000 only
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Available to withdraw</p>
            <p className="text-2xl font-extrabold text-emerald-600">
              {formatPrice(availableBalance)}
            </p>
          </div>
        </div>

        {availableBalance < WITHDRAWAL_MIN ? (
          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-gray-600 text-sm font-medium">
              Minimum withdrawal is ₹{WITHDRAWAL_MIN.toLocaleString('en-IN')}.
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              Complete more jobs and verify via OTP to increase your available balance.
            </p>
          </div>
        ) : (
          <button
            onClick={() => { setShowWithdrawModal(true); setWithdrawError(''); }}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white
                       font-bold rounded-xl transition-colors flex items-center
                       justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342
                   1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375
                   c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0
                   .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125
                   1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75
                   0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125
                   V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3
                   0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            Request Withdrawal
          </button>
        )}

        {/* Withdrawal history */}
        {withdrawalsLoading ? (
          <div className="space-y-2 mt-2">
            {[1, 2, 3].map((i) => <WithdrawalItemSkeleton key={i} />)}
          </div>
        ) : withdrawals.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Withdrawal History
            </p>
            {withdrawals.slice(0, 8).map((w) => (
              <div key={w.id}
                   className="flex items-center justify-between px-4 py-3
                              rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {formatPrice(w.amount)}
                    <span className="text-gray-400 text-xs font-normal ml-1">
                      → you receive {formatPrice(w.receivable)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {w.method === 'upi' ? `UPI: ${w.upiId}` : `Bank: ${w.bankName}`}
                    {' · '}
                    {w.createdAt
                      ? new Date(w.createdAt).toLocaleDateString('en-IN')
                      : '—'}
                  </p>
                  {w.rejectionReason && (
                    <p className="text-xs text-red-500 mt-0.5">
                      Rejected: {w.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                    ${w.status === 'pending'    ? 'bg-amber-100  text-amber-700'  :
                      w.status === 'processing' ? 'bg-blue-100   text-blue-700'   :
                      w.status === 'completed'  ? 'bg-green-100  text-green-700'  :
                      w.status === 'rejected'   ? 'bg-red-100    text-red-600'    :
                                                  'bg-gray-100   text-gray-500'   }`}>
                    {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                  </span>
                  {w.status === 'pending' && (
                    <button
                      onClick={async () => {
                        try {
                          await cancelWithdrawal(w.id, user.uid);
                          toast('Withdrawal cancelled.', 'success');
                        } catch (err) {
                          toast(err.message, 'error');
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal modal */}
      {showWithdrawModal && (() => {
        const parsed = parseInt(withdrawAmount, 10) || 0;
        const amountErr = withdrawAmount
          ? validateWithdrawalAmount(parsed, availableBalance)
          : null;
        const breakdown = parsed > 0 && !amountErr
          ? calculateWithdrawalFee(parsed, processingFeePercent)
          : null;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                          flex items-end sm:items-center justify-center p-0 sm:p-4"
               onClick={(e) => { if (e.target === e.currentTarget) setShowWithdrawModal(false); }}>
            <div className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl
                            flex flex-col max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <h3 className="font-bold text-gray-900">Request Withdrawal</h3>
                <button onClick={() => setShowWithdrawModal(false)}
                        className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Amount input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Withdrawal Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(''); }}
                      placeholder="1000"
                      min={WITHDRAWAL_MIN}
                      max={WITHDRAWAL_MAX}
                      step={WITHDRAWAL_STEP}
                      className={`w-full pl-8 pr-4 py-3 rounded-xl border text-gray-900
                                  text-sm focus:outline-none focus:ring-2 transition-colors
                                  ${amountErr ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-500'}`}
                    />
                  </div>
                  {amountErr && <p className="text-red-500 text-xs mt-1">{amountErr}</p>}
                  <p className="text-gray-400 text-xs mt-1">
                    Available: {formatPrice(availableBalance)} ·
                    Max withdrawable: {formatPrice(Math.min(WITHDRAWAL_MAX, Math.floor(availableBalance / WITHDRAWAL_STEP) * WITHDRAWAL_STEP))}
                  </p>
                  {/* Quick select chips */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[1000, 2000, 5000, 10000, 20000]
                      .filter((v) => v <= availableBalance && v <= WITHDRAWAL_MAX)
                      .map((v) => (
                        <button key={v} type="button"
                          onClick={() => { setWithdrawAmount(String(v)); setWithdrawError(''); }}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 transition-colors
                            ${parseInt(withdrawAmount) === v
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          ₹{v.toLocaleString('en-IN')}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Fee breakdown */}
                {breakdown && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      Breakdown
                    </p>
                    {[
                      { label: 'Withdrawal amount', value: formatPrice(breakdown.withdrawalAmount) },
                      {
                        label: gstModeEnabled
                          ? `Processing fee (${breakdown.feePercent}%, incl. GST)`
                          : `Processing fee (${breakdown.feePercent}%)`,
                        value: `−${formatPrice(breakdown.processingFee)}`,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm text-gray-600">
                        <span>{label}</span><span>{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-gray-900 pt-2
                                    border-t border-gray-200 text-sm">
                      <span>You will receive in bank</span>
                      <span className="text-emerald-600">{formatPrice(breakdown.receivable)}</span>
                    </div>
                  </div>
                )}

                {/* Method selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'upi',  label: 'UPI',          desc: 'Instant transfer' },
                      { key: 'bank', label: 'Bank Account',  desc: '1–3 business days' },
                    ].map(({ key, label, desc }) => (
                      <button key={key} type="button"
                        onClick={() => setWithdrawMethod(key)}
                        className={`flex flex-col items-start p-4 rounded-xl border-2 text-left
                                    transition-colors
                                    ${withdrawMethod === key
                                      ? 'border-emerald-500 bg-emerald-50'
                                      : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                            ${withdrawMethod === key ? 'border-emerald-500' : 'border-gray-400'}`}>
                            {withdrawMethod === key && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            )}
                          </span>
                          <span className={`font-semibold text-sm ${withdrawMethod === key ? 'text-emerald-700' : 'text-gray-700'}`}>
                            {label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 pl-6">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI fields */}
                {withdrawMethod === 'upi' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      UPI ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={upiId}
                      onChange={(e) => { setUpiId(e.target.value); setWithdrawError(''); }}
                      placeholder="yourname@upi"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm
                                 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-gray-400 text-xs mt-1">e.g. name@paytm, name@ybl, name@okicici</p>
                  </div>
                )}

                {/* Bank fields */}
                {withdrawMethod === 'bank' && (
                  <div className="space-y-3">
                    {[
                      { label: 'Account Holder Name', value: accountHolderName, set: setAccountHolderName, placeholder: 'Full name as per bank' },
                      { label: 'Bank Name',            value: bankName,          set: setBankName,          placeholder: 'e.g. HDFC Bank' },
                      { label: 'Account Number',       value: accountNumber,     set: setAccountNumber,     placeholder: '9–18 digit account number', type: 'tel' },
                      { label: 'IFSC Code',            value: ifscCode,          set: setIfscCode,          placeholder: 'e.g. HDFC0001234' },
                    ].map(({ label, value, set, placeholder, type = 'text' }) => (
                      <div key={label}>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {label} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type={type}
                          value={value}
                          onChange={(e) => { set(e.target.value); setWithdrawError(''); }}
                          placeholder={placeholder}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm
                                     text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {withdrawError && (
                  <p className="text-red-500 text-sm font-medium">{withdrawError}</p>
                )}

                {/* Submit */}
                <button
                  disabled={withdrawing || !!amountErr || !breakdown}
                  onClick={async () => {
                    if (!breakdown) return;
                    setWithdrawing(true);
                    setWithdrawError('');
                    try {
                      await requestWithdrawal({
                        workerId:   user.uid,
                        workerName: user.name ?? profile?.name ?? '',
                        amount:     breakdown.withdrawalAmount,
                        method:     withdrawMethod,
                        upiId,
                        accountHolderName,
                        bankName,
                        accountNumber,
                        ifscCode,
                        availableBalance,
                      });
                      toast('Withdrawal request submitted!', 'success');
                      setShowWithdrawModal(false);
                      setWithdrawAmount('');
                      setUpiId('');
                      setAccountHolderName('');
                      setBankName('');
                      setAccountNumber('');
                      setIfscCode('');
                    } catch (err) {
                      setWithdrawError(err.message);
                    } finally {
                      setWithdrawing(false);
                    }
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold
                             rounded-xl transition-colors disabled:opacity-40 flex items-center
                             justify-center gap-2"
                >
                  {withdrawing ? (
                    <><LoadingSpinner size="xs" /> Processing…</>
                  ) : breakdown ? (
                    <>Withdraw {formatPrice(breakdown.withdrawalAmount)} — Receive {formatPrice(breakdown.receivable)}</>
                  ) : (
                    'Enter amount to continue'
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDecline && (
        <ConfirmModal
          title="Decline Request?"
          message={`Decline the booking from ${confirmDecline.customerName}?`}
          confirmLabel="Yes, Decline"
          cancelLabel="Keep"
          confirmCls="bg-red-600 hover:bg-red-700"
          loading={actionId === confirmDecline.id}
          onConfirm={async () => { await doAction(rejectBooking, confirmDecline.id, confirmDecline); setConfirmDecline(null); }}
          onCancel={() => setConfirmDecline(null)}
        />
      )}

      {confirmCancelWk && (
        <ConfirmModal
          title="Cancel Booking?"
          message={`Cancel the booking with ${confirmCancelWk.customerName}? They will be notified.`}
          confirmLabel="Yes, Cancel"
          cancelLabel="Keep Booking"
          confirmCls="bg-red-600 hover:bg-red-700"
          loading={actionId === confirmCancelWk.id}
          onConfirm={async () => { await doAction((id, b) => cancelBooking(id, b, 'worker'), confirmCancelWk.id, confirmCancelWk); setConfirmCancelWk(null); }}
          onCancel={() => setConfirmCancelWk(null)}
        />
      )}

      {/* Auto-opens after worker accepts a booking */}
      {chatCustomer && (
        <ChatModal
          peer={chatCustomer}
          onClose={() => setChatCustomer(null)}
        />
      )}
    </div>
  );
}