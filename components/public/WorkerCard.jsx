'use client';

import React                              from 'react';
import Link                              from 'next/link';
import { formatPrice }                   from '@/lib/pricing';
import { formatDistance } from '@/lib/location';
import { VerifiedIcon }                  from '@/components/icons';

function StarRating({ rating = 0 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-3.5 h-3.5 ${
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

function Avatar({ url, name, size = 'md' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-lg';
  return (
    <div className={`${sz} rounded-2xl overflow-hidden bg-gray-100 border
                     border-gray-200 shrink-0 flex items-center justify-center`}>
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center
                        bg-blue-50 text-blue-600 font-bold">
          {(name || 'W')[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── Compact (dashboard list) ──────────────────────────────────────────────────

function CompactWorkerCard({ worker, onBook, onChat }) {
  const hasDistance = isFinite(worker.distance) && worker.distance !== Infinity;

  return (
    <Link
      href={`/worker/${worker.id}`}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4
                 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5
                 transition-all duration-200"
    >
      <Avatar url={worker.profileImageUrl} name={worker.name} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {worker.name}
          </p>
          {worker.isVerified && (
            <VerifiedIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          )}
        </div>
        <p className="text-gray-400 text-xs truncate">{worker.categoryName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <StarRating rating={worker.rating} />
          {/* Part 6: Experience years */}
          {(worker.experienceYears ?? 0) > 0 && (
            <span className="text-xs text-gray-400">
              {worker.experienceYears}yr exp
            </span>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        {hasDistance && (
          <p className="text-xs font-medium text-blue-600">
            {formatDistance(worker.distance)}
          </p>
        )}
        {(worker.startingPrice ?? worker.pricePerHour ?? 0) > 0 && (
          <p className="text-xs text-gray-500 mt-0.5">
            from {formatPrice(worker.startingPrice ?? worker.pricePerHour)}
          </p>
        )}
      </div>
    </Link>
  );
}

// ── Full card (services page) ─────────────────────────────────────────────────

function FullWorkerCard({ worker, onBook, onChat }) {
  const hasDistance = isFinite(worker.distance) && worker.distance !== Infinity;

  const startingPrice = worker.startingPrice ?? worker.pricePerHour ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                    hover:shadow-lg hover:-translate-y-1 transition-all duration-200">

      {/* Card header — white, no gradient */}
      <div className="p-5 flex items-start gap-4">
        <Avatar url={worker.profileImageUrl} name={worker.name} size="lg" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/worker/${worker.id}`}
                  className="font-bold text-gray-900 text-base truncate
                             hover:text-blue-600 transition-colors"
                >
                  {worker.name}
                </Link>
                {worker.isVerified && (
                  <VerifiedIcon className="w-4 h-4 text-blue-500 shrink-0" />
                )}
              </div>
              <p className="text-gray-500 text-sm">{worker.categoryName}</p>
            </div>
            {hasDistance && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600
                               text-xs font-semibold shrink-0">
                {formatDistance(worker.distance)}
              </span>
            )}
          </div>

          {/* Rating + experience */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StarRating rating={worker.rating ?? 0} />
            <span className="text-gray-700 font-semibold text-xs">
              {(worker.rating ?? 0).toFixed(1)}
            </span>
            <span className="text-gray-400 text-xs">
              ({worker.reviewCount ?? 0})
            </span>

            {/* Part 6: Experience badge */}
            {(worker.experienceYears ?? 0) > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full
                               bg-gray-100 text-gray-600 text-xs font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                </svg>
                {worker.experienceYears}yr exp
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Experience description (Part 6) */}
      {worker.experienceDesc && (
        <div className="px-5 pb-2">
          <p className="text-gray-500 text-xs leading-relaxed italic line-clamp-2">
            "{worker.experienceDesc}"
          </p>
        </div>
      )}

      {/* Bio */}
      {worker.bio && (
        <div className="px-5 pb-3">
          <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
            {worker.bio}
          </p>
        </div>
      )}

      {/* Skills */}
      {(worker.skills?.length ?? 0) > 0 && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {worker.skills.slice(0, 3).map((skill) => (
            <span key={skill}
                  className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600
                             text-xs font-medium">
              {skill}
            </span>
          ))}
          {worker.skills.length > 3 && (
            <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-400 text-xs">
              +{worker.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Price + actions */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {startingPrice > 0 ? (
              <>
                <p className="font-bold text-gray-900">
                  Starting from{' '}
                  <span className="text-blue-600">{formatPrice(startingPrice)}</span>
                </p>
                <p className="text-xs text-gray-400">Price may vary based on work</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Price on request</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Link
              href={`/worker/${worker.id}`}
              className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600
                         text-sm font-medium hover:border-gray-300 transition-colors"
            >
              View
            </Link>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBook?.(worker); }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-semibold transition-colors"
            >
              Book
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function WorkerCard({ worker, compact = false, onBook, onChat }) {
  if (compact) return <CompactWorkerCard worker={worker} onBook={onBook} onChat={onChat} />;
  return <FullWorkerCard worker={worker} onBook={onBook} onChat={onChat} />;
}

export default React.memo(WorkerCard, (prev, next) =>
  prev.worker.id          === next.worker.id          &&
  prev.worker.isAvailable === next.worker.isAvailable &&
  prev.worker.rating      === next.worker.rating      &&
  prev.worker.distance    === next.worker.distance    &&
  prev.compact            === next.compact,
);