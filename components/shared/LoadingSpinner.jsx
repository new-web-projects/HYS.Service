import React from 'react';

// ── Spinner ────────────────────────────────────────────────────────────────

function LoadingSpinner({ size = 'md', label = '', className = '' }) {
  const sizes = {
    xs: 'w-3 h-3 border-[1.5px]',
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4',
  };
  return (
    <span
      className={`inline-flex flex-col items-center gap-2 ${className}`}
      role="status"
      aria-label={label || 'Loading'}
    >
      <span
        className={`${sizes[size] ?? sizes.md} border-brand-500/30 border-t-brand-500
                    rounded-full animate-spin`}
      />
      {label && (
        <span className="text-admin-muted text-sm">{label}</span>
      )}
    </span>
  );
}

// ── Skeleton block ─────────────────────────────────────────────────────────

/**
 * BUG FIX (Bug 4): Skeleton loaders prevent blank/flash screens during loading.
 * Usage: <SkeletonBlock className="h-6 w-32 rounded" />
 */
export function SkeletonBlock({ className = '' }) {
  return (
    <div
      className={`skeleton-dark rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}

// ── Stats card skeleton ────────────────────────────────────────────────────

export function StatsCardSkeleton() {
  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-5 flex items-start gap-4">
      <SkeletonBlock className="w-11 h-11 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-7 w-14" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
    </div>
  );
}

// ── Table row skeleton ─────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 5 }) {
  const widths = ['w-40', 'w-28', 'w-20', 'w-28', 'w-32'];
  return (
    <tr className="border-b border-admin-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <SkeletonBlock className={`h-4 ${widths[i % widths.length]}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Media grid skeleton ────────────────────────────────────────────────────

export function MediaGridSkeleton({ count = 10 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

// ── Page editor skeleton ───────────────────────────────────────────────────

export function PageEditorSkeleton() {
  return (
    <div className="space-y-5 p-6">
      <div className="space-y-1.5">
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
      <div className="space-y-1.5">
        <SkeletonBlock className="h-4 w-12" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
      <SkeletonBlock className="h-28 w-full" />
      <SkeletonBlock className="h-20 w-full" />
      <SkeletonBlock className="h-20 w-full" />
    </div>
  );
}

export default React.memo(LoadingSpinner);