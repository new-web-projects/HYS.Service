'use client';

/**
 * app/error.jsx — Route-Level Error Boundary
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js renders this component in place of any route segment that throws
 * during render.  It handles two modes:
 *
 *   REVEAL ON  → Shows full technical breakdown (for admin/debugging)
 *   REVEAL OFF → Shows a clean, user-facing "Something went wrong" page
 *
 * The error is ALSO dispatched as a `hys:error` custom event so the floating
 * ErrorProvider panel (in the root layout) can pick it up independently.
 */

import { useEffect, useState } from 'react';
import Link                    from 'next/link';

// ─── Helpers (duplicated from ErrorProvider to avoid import issues) ───────────

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

function parseStack(stack) {
  if (!stack) return { file: 'unknown', line: '?', fn: 'unknown' };
  for (const raw of stack.split('\n')) {
    const ln = raw.trim();
    const m1 = ln.match(/^at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
    if (m1) {
      return {
        fn:   m1[1],
        file: m1[2].split('/').pop().split('?')[0],
        line: m1[3],
      };
    }
    const m2 = ln.match(/^at\s+(.+?):(\d+):\d+$/);
    if (m2) {
      return { fn: '(anonymous)', file: m2[1].split('/').pop().split('?')[0], line: m2[2] };
    }
  }
  return { file: 'unknown', line: '?', fn: 'unknown' };
}

// ─── Reveal mode ─────────────────────────────────────────────────────────────

function getReveal() {
  try {
    const v = localStorage.getItem('hys_error_reveal');
    return v === null ? true : v !== 'false';
  } catch {
    return true;
  }
}

// ─── Technical Error Page (reveal: ON) ───────────────────────────────────────

function TechErrorPage({ error, reset }) {
  const { file, line, fn } = parseStack(error?.stack ?? '');
  const ts = fmtTime(Date.now());

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full" style={{ maxWidth: '700px' }}>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden shadow-2xl border border-red-500/25"
          style={{ background: 'rgba(7, 4, 12, 0.97)' }}
        >
          {/* Title bar */}
          <div
            className="flex items-center gap-3 px-5 py-3.5 border-b border-red-500/15"
            style={{ background: 'rgba(127, 29, 29, 0.25)' }}
          >
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <div className="w-3 h-3 rounded-full" style={{ background: '#2d2d2d' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#2d2d2d' }} />
            </div>
            <span className="text-red-400 font-bold font-mono text-sm flex-1">
              {error?.name || 'Error'} — Route Crashed
            </span>
            <span className="text-xs font-mono" style={{ color: '#3f3f46' }}>{ts}</span>
          </div>

          {/* Error message */}
          <div className="px-5 py-4 border-b border-zinc-800/50">
            <p
              className="font-mono text-sm leading-relaxed"
              style={{ color: '#fca5a5', wordBreak: 'break-word' }}
            >
              {error?.message || 'An unexpected rendering error occurred.'}
            </p>
            {error?.digest && (
              <p className="mt-1.5 text-xs font-mono" style={{ color: '#3f3f46' }}>
                digest: {error.digest}
              </p>
            )}
          </div>

          {/* Info grid */}
          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-2 border-b border-zinc-800/50">
            {[
              { k: 'Error Type', v: error?.name || 'Error'                         },
              { k: 'File',       v: `${file}:${line}`                              },
              { k: 'Function',   v: fn                                              },
              { k: 'Route',      v: typeof window !== 'undefined' ? window.location.pathname : '/' },
              { k: 'Timestamp',  v: ts                                              },
              { k: 'Source',     v: 'ReactErrorBoundary'                           },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(24,24,27,0.7)' }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5"
                  style={{ color: '#3f3f46' }}>{k}</p>
                <p className="text-xs font-mono truncate" style={{ color: '#d4d4d8' }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Stack trace */}
          {error?.stack && (
            <div className="px-5 py-4 border-b border-zinc-800/50">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
                style={{ color: '#3f3f46' }}>Stack Trace</p>
              <div
                className="rounded-xl p-3 overflow-x-auto"
                style={{ background: 'rgba(9,9,11,0.9)', maxHeight: '200px', overflowY: 'auto' }}
              >
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap"
                  style={{ color: '#71717a' }}>
                  {error.stack}
                </pre>
              </div>
            </div>
          )}

          {/* Component stack */}
          {error?.componentStack && (
            <div className="px-5 py-4 border-b border-zinc-800/50">
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-2"
                style={{ color: '#3f3f46' }}>Component Tree</p>
              <div className="rounded-xl p-3" style={{ background: 'rgba(9,9,11,0.9)' }}>
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap"
                  style={{ color: '#71717a' }}>
                  {error.componentStack.trim()}
                </pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 flex flex-wrap gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: '#1d4ed8', color: '#fff' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'rgba(39,39,42,0.8)', color: '#a1a1aa' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </Link>
          </div>
        </div>

        {/* Hint */}
        <p className="mt-3 text-center text-xs" style={{ color: '#3f3f46' }}>
          Error Reveal System is{' '}
          <span style={{ color: '#22c55e' }}>active</span>
          {' '}· To disable:{' '}
          <code style={{ color: '#71717a' }}>
            localStorage.setItem(&apos;hys_error_reveal&apos;, &apos;false&apos;)
          </code>
        </p>
      </div>
    </div>
  );
}

// ─── Friendly Error Page (reveal: OFF) ───────────────────────────────────────

function FriendlyErrorPage({ reset }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(239,68,68,0.1)' }}
        >
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          We hit an unexpected error on this page. Our team has been notified.
          Please try again or return home.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function RouteError({ error, reset }) {
  const [reveal, setReveal] = useState(true);

  useEffect(() => {
    // Read toggle
    try {
      const v = localStorage.getItem('hys_error_reveal');
      setReveal(v === null ? true : v !== 'false');
    } catch { /* proceed with reveal = true */ }

    // Dispatch to floating ErrorProvider panel
    window.dispatchEvent(new CustomEvent('hys:error', {
      detail: {
        error,
        source:         'ReactErrorBoundary',
        componentStack: error?.componentStack ?? '',
      },
    }));

    // Always log to console for server-side log collection
    console.error('[RouteError]', error?.name, error?.message, error);
  }, [error]);

  return reveal
    ? <TechErrorPage  error={error} reset={reset} />
    : <FriendlyErrorPage reset={reset} />;
}
