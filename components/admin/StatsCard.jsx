import React from 'react';
import { StatsCardSkeleton } from '@/components/shared/LoadingSpinner';

const ACCENT_STYLES = {
  brand:   { bg: 'bg-brand-500/10',   text: 'text-brand-400',   ring: 'ring-brand-500/20'   },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   ring: 'ring-amber-500/20'   },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-400',     ring: 'ring-red-500/20'     },
};

function StatsCard({
  label,
  value,
  icon,       // Part 5: pass an SVG icon element, e.g. <UserIcon className="w-5 h-5" /> — not an emoji string
  sub,
  trend,
  trendValue,
  loading      = false,
  accentColor  = 'brand',
}) {
  if (loading) return <StatsCardSkeleton />;

  const accent = ACCENT_STYLES[accentColor] ?? ACCENT_STYLES.brand;

  return (
    <div className="group bg-admin-card border border-admin-border rounded-2xl p-5
                     flex items-start gap-4 transition-all duration-200
                     hover:border-white/10 hover:shadow-card-hover hover:-translate-y-0.5">
      <div className={`p-3 rounded-xl ${accent.bg} ring-1 ${accent.ring} shrink-0
                       transition-transform duration-200 group-hover:scale-110`}>
        <span className={accent.text}>{icon}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-2xs font-semibold text-admin-muted uppercase tracking-widest mb-1.5">
          {label}
        </p>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-bold text-admin-text tabular-nums leading-none">
            {value ?? '—'}
          </p>
          {trend && trendValue && (
            <span className={`text-xs font-semibold mb-0.5 flex items-center gap-0.5
                              ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </span>
          )}
        </div>
        {sub && (
          <p className="text-admin-muted text-xs mt-1.5 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

/**
 * PERFORMANCE: Custom memo comparison.
 * Only re-renders when value, loading, sub, or accentColor changes.
 * Prevents the entire dashboard from re-rendering all 8 cards when
 * only one stat updates (e.g., a new page is published).
 */
export default React.memo(StatsCard, (prev, next) =>
  prev.value       === next.value &&
  prev.loading     === next.loading &&
  prev.sub         === next.sub &&
  prev.accentColor === next.accentColor &&
  prev.trend       === next.trend &&
  prev.trendValue  === next.trendValue,
);