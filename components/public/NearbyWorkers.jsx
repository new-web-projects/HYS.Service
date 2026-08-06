'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getCurrentPosition,
  sortWorkersByDistance,
}                                                    from '@/lib/location';
import WorkerCard                                    from '@/components/public/WorkerCard';
import BookingModal                                  from '@/components/public/BookingModal';
import ChatModal                                     from '@/components/public/ChatModal';
import { usePublicAuthStore }                        from '@/store/publicAuthStore';

function LocationIcon({ className }) {
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

/**
 * @param {{
 *   workers:          object[],
 *   maxVisible?:      number,
 *   compact?:         boolean,
 *   initialLocation?: { lat: number, lng: number, address?: string } | null,
 *   onBook?:          (worker: object) => void,
 *   onChat?:          (worker: object) => void,
 * }} props
 */
export default function NearbyWorkers({
  workers         = [],
  maxVisible      = 12,
  compact         = false,
  initialLocation = null,   // PART 4: pre-supplied stored location
  onBook:   externalOnBook,
  onChat:   externalOnChat,
}) {
  const { user } = usePublicAuthStore();

  const [userLocation,    setUserLocation]    = useState(initialLocation);
  const [locationError,   setLocationError]   = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortMode,        setSortMode]        = useState(
    initialLocation ? 'distance' : 'rating',
  );
  const [categoryFilter,  setCategoryFilter]  = useState('all');

  const [bookingWorker, setBookingWorker] = useState(null);
  const [chatWorker,    setChatWorker]    = useState(null);

  // When the parent passes initialLocation (from stored profile), use it.
  // Only run silent GPS if no initial location was provided.
  useEffect(() => {
    if (initialLocation?.lat) {
      setUserLocation(initialLocation);
      setSortMode('distance');
    } else {
      detectLocation(true); // silent — no error shown
    }
  }, [initialLocation?.lat, initialLocation?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  async function detectLocation(silent = false) {
    if (locationLoading) return;
    setLocationLoading(true);
    try {
      const pos = await getCurrentPosition();
      setUserLocation(pos);
      setSortMode('distance');
      setLocationError('');
    } catch (err) {
      if (!silent) setLocationError(err.message);
      setSortMode('rating');
    } finally {
      setLocationLoading(false);
    }
  }

  const handleBook = useCallback((worker) => {
    // Part 1: Book creates a booking request directly — chat is now reached
    // only via an accepted booking, never as a standalone pre-booking option.
    if (externalOnBook) { externalOnBook(worker); return; }
    if (!user) { window.location.href = '/auth/login?redirect=/services'; return; }
    if (user.role !== 'customer') return;
    setBookingWorker(worker);
  }, [user, externalOnBook]);

  const handleChat = useCallback((worker) => {
    if (externalOnChat) { externalOnChat(worker); return; }
    if (!user) { window.location.href = '/auth/login?redirect=/services'; return; }
    if (user.role !== 'customer') return;
    setChatWorker(worker);
  }, [user, externalOnChat]);

  const workersWithDistance = useMemo(() => {
    if (!userLocation?.lat || !userLocation?.lng) {
      return workers.map((w) => ({ ...w, distance: Infinity }));
    }
    return sortWorkersByDistance(workers, userLocation.lat, userLocation.lng);
  }, [workers, userLocation]);

  const processed = useMemo(() => {
    let list = [...workersWithDistance];

    if (categoryFilter !== 'all') {
      list = list.filter((w) => w.categoryId === categoryFilter);
    }

    switch (sortMode) {
      case 'distance':
        list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        break;
      case 'price':
        list.sort((a, b) => (a.startingPrice ?? a.pricePerHour ?? 0) - (b.startingPrice ?? b.pricePerHour ?? 0));
        break;
      default:
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    return list.slice(0, maxVisible);
  }, [workersWithDistance, categoryFilter, sortMode, maxVisible]);

  const uniqueCategories = useMemo(() => {
    const seen = new Map();
    workers
      .filter((w) => w.categoryId && w.categoryName)
      .forEach((w) => seen.set(w.categoryId, { id: w.categoryId, name: w.categoryName }));
    return [...seen.values()];
  }, [workers]);

  if (workers.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center
                        justify-center mx-auto mb-4">
          <LocationIcon className="w-7 h-7 text-gray-400" />
        </div>
        <p className="font-semibold text-gray-500 text-lg">
          No workers available right now
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Check back soon — more are joining!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Location banners — only show when no initialLocation was supplied */}
      {!initialLocation && !userLocation && !locationLoading && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3
                        bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <LocationIcon className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-blue-800 text-sm">
                {locationError ? 'Location unavailable' : 'Share your location?'}
              </p>
              <p className="text-blue-600 text-xs truncate">
                {locationError
                  ? 'Workers sorted by rating instead.'
                  : 'See the workers closest to you first.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => detectLocation(false)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <LocationIcon className="w-3.5 h-3.5" />
            Share Location
          </button>
        </div>
      )}

      {locationLoading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border
                        border-blue-200 rounded-xl">
          <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600
                           rounded-full animate-spin shrink-0" />
          <p className="text-blue-700 text-sm font-medium">
            Detecting your location…
          </p>
        </div>
      )}

      {userLocation && !initialLocation && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border
                        border-green-200 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <p className="text-green-700 text-sm font-medium flex-1">
            Showing workers nearest to you
          </p>
          <button
            onClick={() => { setUserLocation(null); setSortMode('rating'); }}
            className="text-green-500 hover:text-green-700 text-xs font-medium
                       transition-colors shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {uniqueCategories.length > 1 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm
                       text-gray-700 focus:outline-none focus:ring-2
                       focus:ring-blue-500 bg-white"
          >
            <option value="all">All categories</option>
            {uniqueCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 ml-auto">
          {[
            { id: 'distance', label: 'Nearest',     disabled: !userLocation?.lat },
            { id: 'rating',   label: 'Top Rated'                                 },
            { id: 'price',    label: 'Lowest Price'                              },
          ].map(({ id, label, disabled }) => (
            <button
              key={id}
              onClick={() => !disabled && setSortMode(id)}
              disabled={!!disabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                          ${sortMode === id
                            ? 'bg-white text-gray-900 shadow-sm'
                            : disabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-400">
        Showing{' '}
        <span className="font-semibold text-gray-600">{processed.length}</span>
        {' '}of{' '}
        <span className="font-semibold text-gray-600">{workers.length}</span>
        {' '}workers
      </p>

      {/* Grid / list */}
      {compact ? (
        <div className="space-y-3">
          {processed.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              compact
              onBook={handleBook}
              onChat={handleChat}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {processed.map((worker) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onBook={handleBook}
              onChat={handleChat}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {bookingWorker && (
        <BookingModal
          worker={bookingWorker}
          onClose={() => setBookingWorker(null)}
          onOpenChat={(w) => {
            setBookingWorker(null);
            setChatWorker(w);
          }}
        />
      )}
      {chatWorker && user?.role === 'customer' && (
        <ChatModal
          peer={chatWorker}
          onClose={() => setChatWorker(null)}
        />
      )}
    </div>
  );
}