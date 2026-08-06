'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useUserStore }                              from '@/store/userStore';
import { useContentStore }                           from '@/store/contentStore';
import { usePublicAuthStore }                        from '@/store/publicAuthStore';
import {
  getCurrentPosition,
  sortWorkersByDistance,
  calculateDistancePricing,
  detectCity,
}                                                    from '@/lib/location';
import WorkerCard                                    from '@/components/public/WorkerCard';
import BookingModal                                  from '@/components/public/BookingModal';
import ChatModal                                     from '@/components/public/ChatModal';
import LoadingSpinner                                from '@/components/shared/LoadingSpinner';
import { formatPrice }                               from '@/lib/pricing';

// ── Filter defaults ────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  search:       '',
  categoryId:   'all',
  minRating:    0,
  maxPrice:     0,
  sortBy:       'rating',
  verifiedOnly: false,
};

// ── Location icon ─────────────────────────────────────────────────────────────

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

// ── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({
  filters, setFilters, categories,
  hasLocation, onRequestLocation, locationLoading, locationCity,
}) {
  function reset() { setFilters(DEFAULT_FILTERS); }

  const hasActiveFilters =
    filters.search !== ''       ||
    filters.categoryId !== 'all'||
    filters.minRating > 0       ||
    filters.maxPrice > 0        ||
    filters.verifiedOnly;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">

      {/* Search */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase
                           tracking-widest mb-2">
          Search
        </label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Name, skill, category…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200
                       text-gray-900 text-sm focus:outline-none focus:ring-2
                       focus:ring-blue-500 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase
                           tracking-widest mb-2">
          Category
        </label>
        <select
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm
                     text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                     bg-white"
        >
          <option value="all">All Categories</option>
          {categories
            .filter((c) => c.status === 'active')
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
      </div>

      {/* Min rating */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase
                           tracking-widest mb-2">
          Minimum Rating
        </label>
        <div className="flex items-center gap-1.5">
          {[0, 3, 3.5, 4, 4.5].map((r) => (
            <button
              key={r}
              onClick={() => setFilters((f) => ({ ...f, minRating: r }))}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2
                          transition-colors
                          ${filters.minRating === r
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {r === 0 ? 'Any' : `${r}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Max price */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Max Starting Price
          </label>
          {filters.maxPrice > 0 && (
            <span className="text-blue-600 text-xs font-semibold">
              Up to {formatPrice(filters.maxPrice)}
            </span>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={5000}
          step={100}
          value={filters.maxPrice}
          onChange={(e) =>
            setFilters((f) => ({ ...f, maxPrice: parseInt(e.target.value, 10) }))
          }
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Any price</span>
          <span>₹5,000+</span>
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase
                           tracking-widest mb-2">
          Sort By
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'rating',     label: 'Top Rated'   },
            { id: 'price_asc',  label: 'Price: Low'  },
            { id: 'price_desc', label: 'Price: High' },
            { id: 'distance',   label: 'Nearest',    disabled: !hasLocation },
          ].map(({ id, label, disabled }) => (
            <button
              key={id}
              disabled={disabled}
              onClick={() => !disabled && setFilters((f) => ({ ...f, sortBy: id }))}
              className={`py-2 rounded-xl text-xs font-semibold border-2 transition-colors
                          ${filters.sortBy === id
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : disabled
                            ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {label}
              {id === 'distance' && !hasLocation && (
                <span className="block text-[9px] font-normal mt-0.5">
                  (enable location)
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Verified only */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Verified Only</p>
          <p className="text-xs text-gray-400">Show badge-verified pros</p>
        </div>
        <div
          role="switch"
          aria-checked={filters.verifiedOnly}
          onClick={() =>
            setFilters((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))
          }
          className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors
                      ${filters.verifiedOnly ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
                        transition-transform duration-200
                        ${filters.verifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </div>
      </div>

      {/* Location status */}
      {hasLocation ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border
                        border-green-200 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-green-700 text-xs font-medium">
              Location detected
              {locationCity && ` — ${locationCity}`}
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={onRequestLocation}
          disabled={locationLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     border-2 border-blue-200 bg-blue-50 text-blue-700 text-sm
                     font-semibold hover:bg-blue-100 transition-colors disabled:opacity-60"
        >
          <LocationIcon className="w-4 h-4" />
          {locationLoading ? 'Detecting location…' : 'Use My Location'}
        </button>
      )}

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={reset}
          className="w-full py-2 rounded-xl border border-gray-200 text-gray-500
                     text-sm font-medium hover:border-gray-400 transition-colors"
        >
          Reset All Filters
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const { user, updateUserLocation } = usePublicAuthStore();
  const {
    publicWorkers,
    publicWorkersLoading,
    subscribePublicWorkers,
    unsubscribePublicWorkers,
  }                 = useUserStore();
  const {
    categories,
    categoriesLoading,
    subscribeCategories,
    unsubscribeCategories,
  }                 = useContentStore();

  const [filters,         setFilters]        = useState(DEFAULT_FILTERS);
  const [userLocation,    setUserLocation]    = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError,   setLocationError]   = useState('');
  const [locationCity,    setLocationCity]    = useState('');
  const [showFilters,     setShowFilters]     = useState(false);
  const [bookingWorker,   setBookingWorker]   = useState(null);
  const [chatWorker,      setChatWorker]      = useState(null);

  useEffect(() => {
    subscribePublicWorkers();
    subscribeCategories();
    return () => {
      unsubscribePublicWorkers();
      unsubscribeCategories();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * PART 4 FIX: On mount, check if the logged-in user already has a stored
   * location in their profile. If so, use it immediately — no permission dialog.
   * This means returning users always see sorted-by-distance results instantly.
   */
  useEffect(() => {
    if (user?.location?.lat && user?.location?.lng) {
      setUserLocation({ lat: user.location.lat, lng: user.location.lng });
      setLocationCity(user.location.address ?? '');
      setFilters((f) => ({ ...f, sortBy: 'distance' }));
    } else {
      // No stored location — attempt silent GPS detection
      detectLocation(true);
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function detectLocation(silent = false) {
    setLocationLoading(true);
    setLocationError('');
    try {
      const pos  = await getCurrentPosition();
      const city = detectCity(pos.lat, pos.lng);

      setUserLocation(pos);
      setLocationCity(city ?? '');
      setFilters((f) => ({ ...f, sortBy: 'distance' }));

      // PART 4: Persist to user profile so they don't need to re-grant next visit
      if (updateUserLocation) {
        updateUserLocation(pos.lat, pos.lng, city ?? null);
      }
    } catch (err) {
      if (!silent) setLocationError(err.message);
    } finally {
      setLocationLoading(false);
    }
  }

  const handleBook = useCallback((worker) => {
    if (!user) { window.location.href = '/auth/login?redirect=/services'; return; }
    if (user.role !== 'customer') return;
    setBookingWorker(worker);
  }, [user]);

  const handleChat = useCallback((worker) => {
    if (!user) { window.location.href = '/auth/login?redirect=/services'; return; }
    if (user.role !== 'customer') return;
    setChatWorker(worker);
  }, [user]);

  // Attach distance to every worker
  const workersWithDistance = useMemo(() => {
    if (!userLocation) {
      return publicWorkers.map((w) => ({ ...w, distance: Infinity }));
    }
    return sortWorkersByDistance(publicWorkers, userLocation.lat, userLocation.lng);
  }, [publicWorkers, userLocation]);

  // Apply all filters + sort
  const filtered = useMemo(() => {
    let list = [...workersWithDistance];

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (w) =>
          w.name?.toLowerCase().includes(q)         ||
          w.categoryName?.toLowerCase().includes(q) ||
          w.bio?.toLowerCase().includes(q)          ||
          w.skills?.some((s) => s.toLowerCase().includes(q)),
      );
    }

    if (filters.categoryId !== 'all') {
      list = list.filter((w) => w.categoryId === filters.categoryId);
    }

    if (filters.minRating > 0) {
      list = list.filter((w) => (w.rating ?? 0) >= filters.minRating);
    }

    if (filters.maxPrice > 0) {
      list = list.filter((w) => { const p = w.startingPrice ?? w.pricePerHour ?? 0; return !p || p <= filters.maxPrice; });
    }

    if (filters.verifiedOnly) {
      list = list.filter((w) => w.isVerified);
    }

    switch (filters.sortBy) {
      case 'distance':
        list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        break;
      case 'price_asc':
        list.sort((a, b) => (a.startingPrice ?? a.pricePerHour ?? 0) - (b.startingPrice ?? b.pricePerHour ?? 0));
        break;
      case 'price_desc':
        list.sort((a, b) => (b.startingPrice ?? b.pricePerHour ?? 0) - (a.startingPrice ?? a.pricePerHour ?? 0));
        break;
      default:
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    return list;
  }, [workersWithDistance, filters]);

  const hasActiveFilters =
    filters.search !== ''        ||
    filters.categoryId !== 'all' ||
    filters.minRating > 0        ||
    filters.maxPrice > 0         ||
    filters.verifiedOnly;

  const isLoading = publicWorkersLoading || categoriesLoading;

  return (
    <div className="bg-gray-50">

      {/* Page header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Find a Professional
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                {isLoading
                  ? 'Finding available workers…'
                  : `${publicWorkers.length} worker${publicWorkers.length !== 1 ? 's' : ''} available`
                    + (locationCity ? ` near ${locationCity}` : userLocation ? ' near you' : '')}
              </p>
            </div>

            {/* Mobile filter button */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="sm:hidden flex items-center gap-2 px-4 py-2 rounded-xl
                         border-2 border-gray-200 text-gray-600 text-sm font-semibold
                         hover:border-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3
                     0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5
                     1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3
                     0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </button>
          </div>

          {/* Location error */}
          {locationError && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50
                            border border-amber-200 rounded-xl max-w-lg">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none"
                   viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73
                     0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898
                     0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-amber-700 text-xs">{locationError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-6">

          {/* Desktop sidebar */}
          <aside className="hidden sm:block w-72 shrink-0">
            <div className="sticky top-20">
              <FilterPanel
                filters={filters}
                setFilters={setFilters}
                categories={categories}
                hasLocation={!!userLocation}
                onRequestLocation={() => detectLocation(false)}
                locationLoading={locationLoading}
                locationCity={locationCity}
              />
            </div>
          </aside>

          {/* Mobile filter drawer */}
          {showFilters && (
            <div
              className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFilters(false)}
            >
              <div
                className="absolute inset-y-0 right-0 w-80 bg-white shadow-2xl
                           overflow-y-auto p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900">Filters</h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <FilterPanel
                  filters={filters}
                  setFilters={setFilters}
                  categories={categories}
                  hasLocation={!!userLocation}
                  onRequestLocation={() => {
                    detectLocation(false);
                    setShowFilters(false);
                  }}
                  locationLoading={locationLoading}
                  locationCity={locationCity}
                />
              </div>
            </div>
          )}

          {/* Worker grid */}
          <main className="flex-1 min-w-0">

            {/* Results bar */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-sm text-gray-500">
                {isLoading ? 'Loading…' : (
                  <>
                    <span className="font-semibold text-gray-900">{filtered.length}</span>
                    {' '}worker{filtered.length !== 1 ? 's' : ''}
                    {hasActiveFilters ? ' matching filters' : ''}
                  </>
                )}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Skeleton loader */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100
                                          shadow-sm p-5 animate-pulse">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-2xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-full mt-4" />
                    <div className="h-10 bg-gray-200 rounded-xl mt-4" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && filtered.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                              p-16 text-center">
                <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501
                       20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676
                       0-5.216-.584-7.499-1.632z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-700 mb-2">No workers found</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                  {hasActiveFilters
                    ? 'Try adjusting your filters.'
                    : 'No workers are available right now. Check back soon!'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white
                               font-semibold text-sm rounded-xl transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Worker cards */}
            {!isLoading && filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filtered.map((worker) => (
                  <WorkerCard
                    key={worker.id}
                    worker={worker}
                    onBook={handleBook}
                    onChat={handleChat}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
      {bookingWorker && (
        <BookingModal
          worker={bookingWorker}
          onClose={() => setBookingWorker(null)}
          onOpenChat={(w) => { setBookingWorker(null); setChatWorker(w); }}
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