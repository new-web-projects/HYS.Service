'use client';

/**
 * ErrorProvider — Global Error Reveal System
 * ─────────────────────────────────────────────────────────────────────────────
 * Intercepts EVERY category of client-side error — including errors that are
 * caught inside store try-catch blocks and only visible in the console.
 *
 * Interception sources:
 *   1. window.onerror            → uncaught synchronous JS errors
 *   2. unhandledrejection        → unhandled async / Promise errors
 *   3. console.error  override   → all [storeX] console.error calls
 *   4. console.warn   override   → HYS store + Firebase SDK warn calls
 *   5. hys:error custom event    → dispatched by React error boundaries
 *
 * Toggle:
 *   localStorage.setItem('hys_error_reveal', 'false')  → minimal badge only
 *   localStorage.setItem('hys_error_reveal', 'true')   → full technical panel
 *   Default: true  (reveal on)
 *
 * Part 4 will add the admin Settings → Developer Tools UI that writes to the
 * same localStorage key.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { reportError } from '@/lib/errorReporter';
import { logError }    from '@/lib/errorLogger';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * All HYS store names that prefix their console calls with [storeName].
 * Matches: [chatStore], [bookingStore], [withdrawalStore] … etc.
 */
const HYS_STORE_REGEX =
  /^\[(authStore|bookingStore|chatStore|contentStore|earningsStore|jobRequestStore|notificationStore|publicAuthStore|reviewStore|settingsStore|userStore|withdrawalStore)\]/i;

/**
 * Firebase SDK warning phrases we always want to surface.
 */
const FIREBASE_ERROR_REGEX =
  /Missing or insufficient permissions|transport errored|FirebaseError|permission-denied|PERMISSION_DENIED/i;

/**
 * React / Next.js / Webpack noise we explicitly skip in console.error.
 */
const SKIP_CONSOLE_ERROR = [
  /^Warning:/,
  /React does not recognize/,
  /Invalid prop/,
  /Each child in a list/,
  /Encountered two children with the same key/,
  /\[webpack/i,
  /\[HMR\]/,
  /Fast Refresh/,
  /^\[Next\.js\]/,
  /^%c/,                 // styled Next.js log messages
  /next\/dist\//,
  /ReactDOM\.render is no longer/,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read user role + session state from the cookies middleware.js sets. */
function getUserCtx() {
  try {
    const map = Object.fromEntries(
      document.cookie.split(';').map(c => {
        const idx = c.indexOf('=');
        return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1).trim())];
      }),
    );
    return {
      role:       map.user_role        || 'unauthenticated',
      hasSession: !!(map.firebase_session || map.hys_access),
    };
  } catch {
    return { role: 'unknown', hasSession: false };
  }
}

function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
  if (ua.includes('OPR/'))           return 'Opera';
  if (ua.includes('Edg/'))           return 'Edge';
  if (ua.includes('Firefox/'))       return 'Firefox';
  if (ua.includes('Chrome/'))        return 'Chrome';
  if (ua.includes('Safari/'))        return 'Safari';
  return 'Unknown';
}

function getDevice() {
  const mob = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return {
    type:     mob ? 'Mobile' : 'Desktop',
    screen:   `${window.screen?.width ?? '?'}×${window.screen?.height ?? '?'}`,
    viewport: `${window.innerWidth ?? '?'}×${window.innerHeight ?? '?'}`,
  };
}

/**
 * Extract the first meaningful frame from a V8 / Firefox / Safari stack.
 * Returns the source file, line number, and function name.
 */
function parseStack(stack) {
  if (!stack) return { file: 'unknown', line: '?', fn: 'unknown' };
  for (const raw of stack.split('\n')) {
    const ln = raw.trim();
    // V8: "at FnName (path/file.js:42:7)"
    const m1 = ln.match(/^at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
    if (m1) {
      const file = m1[2].split('/').pop().split('?')[0];
      return {
        fn:   m1[1].length > 80 ? '…' + m1[1].slice(-80) : m1[1],
        file: file.length > 55  ? '…' + file.slice(-55)  : file,
        line: m1[3],
      };
    }
    // V8 anonymous: "at path/file.js:42:7"
    const m2 = ln.match(/^at\s+(.+?):(\d+):\d+$/);
    if (m2) return { fn: '(anonymous)', file: m2[1].split('/').pop(), line: m2[2] };
    // Firefox/Safari: "fnName@path/file.js:42:7"
    const m3 = ln.match(/^(.+?)@(.+?):(\d+):\d+$/);
    if (m3) return { fn: m3[1] || '(anonymous)', file: m3[2].split('/').pop(), line: m3[3] };
  }
  return { file: 'unknown', line: '?', fn: 'unknown' };
}

/**
 * Build a complete, serialisable error record from a raw Error or any value.
 *
 * @param {Error|any}  rawError
 * @param {string}     source     Human-readable origin label
 * @param {boolean}    hasStack   false for errors caught by stores (stack would
 *                                point to ErrorProvider, not the actual origin)
 */
function buildRecord(rawError, source = 'window', hasStack = true) {
  const err =
    rawError instanceof Error
      ? rawError
      : Object.assign(new Error(String(rawError ?? 'Unknown error')), {
          name: 'UnknownError',
        });

  const { role, hasSession } = getUserCtx();
  const browser = getBrowser();
  const { type: device, screen, viewport } = getDevice();
  const { file, line, fn } = hasStack
    ? parseStack(err.stack ?? '')
    : { file: 'caught inside store', line: '—', fn: source };

  return {
    id:             `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message:        err.message || 'An unexpected error occurred.',
    type:           err.name    || err.constructor?.name || 'Error',
    code:           err.code    || '',
    stack:          hasStack ? (err.stack || '') : '',
    componentStack: '',          // filled later by React boundary dispatcher
    file,
    line,
    fn,
    route:          typeof window !== 'undefined' ? window.location.pathname : '/',
    timestamp:      Date.now(),
    source,
    role,
    userId:         hasSession ? '(authenticated)' : 'anonymous',
    browser,
    device,
    screen,
    viewport,
  };
}

/**
 * PART 10 FIX — Circular JSON crash investigation.
 *
 * Root cause: the console.error / console.warn overrides below used to call
 * JSON.stringify(a) directly on whatever extra arguments were passed to
 * console.error/warn. That is unsafe for two real, observed sources:
 *
 *   1. Firestore's WebChannelConnection logs internal transport/stream
 *      objects via console.warn when a 'Listen' stream errors (the
 *      "WebChannelConnection RPC 'Listen' stream transport errored" message
 *      FIREBASE_ERROR_REGEX matches below). Those internal objects contain
 *      circular references back to their own stream/connection state.
 *   2. Any app code that ever logs a raw DOM node, React fiber/event, or
 *      other self-referencing object alongside a message.
 *
 * JSON.stringify() throws "Converting circular structure to JSON" on such
 * values — and because that throw happened *inside this error handler*
 * (not inside try/catch anywhere), it surfaced as a brand new, confusing
 * crash on /worker-dashboard and /chats — both pages with multiple
 * simultaneous onSnapshot listeners, i.e. exactly the pages most likely to
 * hit a transient WebChannel transport hiccup. The original Firestore
 * warning is harmless and self-recovers; the crash was solely a side effect
 * of trying to *log* it unsafely.
 *
 * This helper NEVER throws, no matter what is passed in. It still produces
 * a readable summary for circular/complex objects instead of just dropping
 * the information, so debugging/monitoring/reporting all keep working —
 * the error itself is not suppressed.
 */
function safeStringify(value, maxLen = 200) {
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
        // DOM nodes (e.g. an <img>/event target) are themselves circular
        // and never useful in a log message — summarize instead.
        if (typeof Node !== 'undefined' && val instanceof Node) {
          return `[DOMNode: ${val.nodeName ?? 'unknown'}]`;
        }
      }
      return val;
    });
    return (json ?? String(value)).slice(0, maxLen);
  } catch {
    // Absolute last resort — must never throw regardless of input.
    try {
      return String(value).slice(0, maxLen);
    } catch {
      return '[Unserializable value]';
    }
  }
}

/** Check localStorage toggle — default ON */
function isRevealEnabled() {
  try {
    const v = localStorage.getItem('hys_error_reveal');
    return v === null ? true : v !== 'false';
  } catch {
    return true;
  }
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

// ─── ErrorPanel UI ────────────────────────────────────────────────────────────

function ErrorPanel({ errors, onDismiss, onDismissAll, onReport, reveal }) {
  const [expanded,   setExpanded]   = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [copied,     setCopied]     = useState(false);
  const [reporting,  setReporting]  = useState(false);   // in-flight
  const [reportedId, setReportedId] = useState(null);    // confirmed reportId
  const [reportErr,  setReportErr]  = useState(null);    // failure message

  // Clamp index if errors list shrinks
  const safeIdx = Math.min(activeIdx, Math.max(0, errors.length - 1));
  const err     = errors[safeIdx];

  // ── Report to platform owner ─────────────────────────────────────────────
  async function handleReport() {
    if (!onReport || reporting || reportedId) return;
    setReporting(true);
    setReportErr(null);
    try {
      const result = await onReport(err);
      if (result?.success) {
        setReportedId(result.reportId || 'sent');
      } else {
        setReportErr(result?.error || 'Failed to send report. Please try again.');
      }
    } catch (e) {
      setReportErr(e.message || 'Unexpected error while reporting.');
    } finally {
      setReporting(false);
    }
  }
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onDismissAll(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismissAll]);

  // Reset report feedback when user switches to a different error tab
  useEffect(() => {
    setReporting(false);
    setReportedId(null);
    setReportErr(null);
  }, [activeIdx]);

  if (!err) return null;

  // ── Copy to clipboard ────────────────────────────────────────────────────
  async function handleCopy() {
    const text = [
      '━━━ HYS Services — Error Report ━━━',
      `Message:    ${err.message}`,
      `Type:       ${err.type}`,
      `Code:       ${err.code || '—'}`,
      `File:       ${err.file}:${err.line}`,
      `Function:   ${err.fn}`,
      `Route:      ${err.route}`,
      `Source:     ${err.source}`,
      `Timestamp:  ${fmtTime(err.timestamp)}`,
      `User Role:  ${err.role}`,
      `Session:    ${err.userId}`,
      `Browser:    ${err.browser}`,
      `Device:     ${err.device}  ·  Screen: ${err.screen}`,
      `Viewport:   ${err.viewport}`,
      '',
      'Stack Trace:',
      err.stack || '(not available — error was caught inside the store)',
      err.componentStack ? `\nComponent Tree:\n${err.componentStack}` : '',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked in some browsers */ }
  }

  // ── Minimal badge (reveal OFF) ───────────────────────────────────────────
  if (!reveal) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] pointer-events-auto">
        <div
          className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-2xl shadow-2xl"
          style={{
            background:    'rgba(220,38,38,0.9)',
            backdropFilter:'blur(8px)',
            border:        '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
          <span className="text-white text-xs font-bold">
            {errors.length} error{errors.length !== 1 ? 's' : ''} detected
          </span>
          <button
            onClick={onDismissAll}
            className="ml-0.5 p-1 rounded-lg text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ── Full developer panel (reveal ON) ─────────────────────────────────────
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] pointer-events-none"
      role="alert"
      aria-live="assertive"
    >
      <div className="p-3 sm:p-4 pointer-events-auto">
        <div
          className="border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            maxWidth:      '720px',
            margin:        '0 auto',
            background:    'rgba(7,4,12,0.97)',
            backdropFilter:'blur(12px)',
          }}
        >
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-red-500/15"
            style={{ background: 'rgba(127,29,29,0.25)' }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />

            <span className="text-red-400 font-bold text-sm font-mono truncate flex-1">
              {err.type}
              {err.code && (
                <span className="text-red-700 ml-2 text-xs">({err.code})</span>
              )}
            </span>

            {errors.length > 1 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold shrink-0"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border:     '1px solid rgba(239,68,68,0.3)',
                  color:      '#fca5a5',
                }}
              >
                {errors.length}
              </span>
            )}

            <code
              className="hidden sm:block text-xs font-mono shrink-0"
              style={{ color: '#4b5563' }}
            >
              {err.route}
            </code>

            <button
              onClick={() => setExpanded(v => !v)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0"
              style={{ background: 'rgba(39,39,42,0.8)', color: '#9ca3af' }}
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
            >
              {expanded ? '▲ Less' : '▼ More'}
            </button>

            <button
              onClick={onDismissAll}
              className="p-1.5 rounded-lg transition-colors shrink-0"
              style={{ background: 'rgba(39,39,42,0.8)', color: '#6b7280' }}
              aria-label="Dismiss all errors (Escape)"
              title="Dismiss all (Esc)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Always-visible summary ─────────────────────────────────────── */}
          <div className="px-4 py-3">
            <p
              className="text-sm font-mono leading-snug"
              style={{ color: '#fca5a5', wordBreak: 'break-word' }}
            >
              {err.message}
            </p>
            <div
              className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5 text-xs font-mono"
              style={{ color: '#4b5563' }}
            >
              <span>{err.file}:{err.line}</span>
              <span>·</span>
              <span>{err.fn}</span>
              <span>·</span>
              <span>{fmtTime(err.timestamp)}</span>
              <span>·</span>
              <span style={{ color: '#713f12' }}>{err.source}</span>
            </div>
          </div>

          {/* ── Expanded details ───────────────────────────────────────────── */}
          {expanded && (
            <div className="border-t" style={{ borderColor: 'rgba(39,39,42,0.6)' }}>

              {/* Info grid */}
              <div className="px-4 pt-3.5 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { k: 'Error Type', v: err.type                                       },
                  { k: 'File',       v: `${err.file}:${err.line}`                      },
                  { k: 'Function',   v: err.fn                                          },
                  { k: 'Route',      v: err.route        || '/'                         },
                  { k: 'Source',     v: err.source       || 'unknown'                   },
                  { k: 'Timestamp',  v: fmtTime(err.timestamp)                         },
                  { k: 'User Role',  v: err.role         || 'unknown'                   },
                  { k: 'Session',    v: err.userId                                      },
                  { k: 'Browser',    v: err.browser      || 'unknown'                   },
                  { k: 'Device',     v: err.device       || '?'                         },
                  { k: 'Screen',     v: err.screen       || '?'                         },
                  { k: 'Error Code', v: err.code         || '—'                         },
                ].map(({ k, v }) => (
                  <div
                    key={k}
                    className="rounded-xl px-3 py-2"
                    style={{ background: 'rgba(24,24,27,0.7)' }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-widest font-semibold mb-0.5"
                      style={{ color: '#3f3f46' }}
                    >
                      {k}
                    </p>
                    <p className="text-xs font-mono truncate" style={{ color: '#d4d4d8' }}>
                      {v}
                    </p>
                  </div>
                ))}
              </div>

              {/* Stack trace */}
              {err.stack ? (
                <div className="px-4 pb-3">
                  <p
                    className="text-[10px] uppercase tracking-widest font-semibold mb-1.5"
                    style={{ color: '#3f3f46' }}
                  >
                    Stack Trace
                  </p>
                  <div
                    className="rounded-xl p-3 overflow-x-auto"
                    style={{ background: 'rgba(9,9,11,0.9)', maxHeight: '160px', overflowY: 'auto' }}
                  >
                    <pre
                      className="text-xs font-mono leading-relaxed whitespace-pre-wrap"
                      style={{ color: '#71717a' }}
                    >
                      {err.stack.length > 1400
                        ? err.stack.slice(0, 1400) + '\n\n… (truncated — use Copy for full trace)'
                        : err.stack}
                    </pre>
                  </div>
                </div>
              ) : (
                /* Caught-in-store note — no stack available */
                <div className="px-4 pb-3">
                  <div
                    className="rounded-xl px-3 py-2.5"
                    style={{
                      background: 'rgba(24,24,27,0.7)',
                      border:     '1px solid rgba(255,193,7,0.12)',
                    }}
                  >
                    <p className="text-xs font-mono" style={{ color: '#78716c' }}>
                      ⚠ Stack trace unavailable — this error was caught inside{' '}
                      <strong style={{ color: '#a8a29e' }}>{err.source}</strong>.
                      Check that store function for the full error context.
                    </p>
                  </div>
                </div>
              )}

              {/* React component tree */}
              {err.componentStack && (
                <div className="px-4 pb-3">
                  <p
                    className="text-[10px] uppercase tracking-widest font-semibold mb-1.5"
                    style={{ color: '#3f3f46' }}
                  >
                    Component Tree
                  </p>
                  <div
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(9,9,11,0.9)' }}
                  >
                    <pre
                      className="text-xs font-mono leading-relaxed whitespace-pre-wrap"
                      style={{ color: '#71717a' }}
                    >
                      {err.componentStack.trim()}
                    </pre>
                  </div>
                </div>
              )}

              {/* Multi-error tabs */}
              {errors.length > 1 && (
                <div className="px-4 pb-3">
                  <p
                    className="text-[10px] uppercase tracking-widest font-semibold mb-1.5"
                    style={{ color: '#3f3f46' }}
                  >
                    All Errors ({errors.length})
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {errors.slice(0, 10).map((e, i) => (
                      <button
                        key={e.id}
                        onClick={() => setActiveIdx(i)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors"
                        style={
                          safeIdx === i
                            ? { background: '#dc2626', color: '#fff' }
                            : { background: 'rgba(39,39,42,0.8)', color: '#71717a' }
                        }
                      >
                        #{i + 1} {e.type}
                      </button>
                    ))}
                    {errors.length > 10 && (
                      <span
                        className="px-2.5 py-1.5 text-xs font-mono"
                        style={{ color: '#3f3f46' }}
                      >
                        +{errors.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action row */}
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{
                    background: 'rgba(39,39,42,0.8)',
                    color: copied ? '#4ade80' : '#a1a1aa',
                  }}
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  {copied ? 'Copied!' : 'Copy Error'}
                </button>

                {/* Report — wired to reportError via onReport prop */}
                {onReport && (
                  <div className="flex-1 min-w-[140px] flex flex-col gap-1">
                    <button
                      onClick={handleReport}
                      disabled={reporting || !!reportedId}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={reportedId
                        ? { background: 'rgba(22,163,74,0.2)',  color: '#4ade80',
                            border: '1px solid rgba(22,163,74,0.3)',
                            opacity: 1, cursor: 'default' }
                        : reporting
                          ? { background: 'rgba(37,99,235,0.15)', color: '#93c5fd',
                              border: '1px solid rgba(37,99,235,0.2)',
                              opacity: 0.7, cursor: 'wait' }
                          : { background: 'rgba(37,99,235,0.25)', color: '#93c5fd',
                              border: '1px solid rgba(37,99,235,0.3)',
                              opacity: 1, cursor: 'pointer' }}
                    >
                      {reporting  ? '⏳ Sending report…'  :
                       reportedId ? '✅ Report sent!'      :
                                    'Report to Platform Owner'}
                    </button>
                    {reportedId && (
                      <p className="text-[10px] font-mono text-center px-1" style={{ color: '#3f3f46' }}>
                        Report ID: {String(reportedId).slice(0, 20)}
                      </p>
                    )}
                    {reportErr && (
                      <p className="text-[10px] font-mono px-1" style={{ color: '#f87171' }}>
                        ⚠ {reportErr}
                      </p>
                    )}
                  </div>
                )}

                {/* Dismiss active */}
                <button
                  onClick={() => { onDismiss(safeIdx); setActiveIdx(0); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(39,39,42,0.8)', color: '#71717a' }}
                >
                  Dismiss
                </button>
              </div>

              {/* Keyboard hint */}
              <p
                className="text-center text-[10px] font-mono pb-2"
                style={{ color: '#27272a' }}
              >
                Press Esc to dismiss all
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ErrorProvider (main export) ─────────────────────────────────────────────

export default function ErrorProvider({ children }) {
  const [errors, setErrors] = useState([]);
  const [reveal, setReveal] = useState(true);
  const seenRef             = useRef(new Set());

  // Read toggle on mount
  useEffect(() => {
    setReveal(isRevealEnabled());
  }, []);

  /** Deduplicate by message+source, cap at 20 errors. */
  const addError = useCallback((record) => {
    const key = `${record.message.slice(0, 100)}|${record.source}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    setErrors(prev => (prev.length >= 20 ? prev : [...prev, record]));

    // ── Part 5: Auto-log every error silently to errorLogs collection ──────
    // Fires for ALL detected errors (window.onerror, store warns, React errors…)
    // Rate-limited to MAX_LOGS per session inside logError.
    logError(record).catch(() => { /* logging must never throw */ });
  }, []);

  // ── 1. window.onerror — uncaught synchronous errors ────────────────────
  useEffect(() => {
    const prev = window.onerror;
    window.onerror = function (message, _src, _lineno, _colno, error) {
      const err =
        error instanceof Error
          ? error
          : new Error(typeof message === 'string' ? message : String(message));
      addError(buildRecord(err, 'window.onerror', true));
      return typeof prev === 'function'
        ? prev(message, _src, _lineno, _colno, error)
        : false;
    };
    return () => { window.onerror = prev; };
  }, [addError]);

  // ── 2. unhandledrejection — unhandled Promise rejections ───────────────
  useEffect(() => {
    function handler(ev) {
      const reason = ev.reason;
      if (!reason) return;
      const err =
        reason instanceof Error
          ? reason
          : Object.assign(new Error(String(reason)), { name: 'UnhandledRejection' });
      addError(buildRecord(err, 'unhandledRejection', true));
    }
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [addError]);

  // ── 3. hys:error — dispatched by React error boundaries ────────────────
  useEffect(() => {
    function handler(ev) {
      const { error, source, componentStack } = ev.detail ?? {};
      if (!error) return;
      const record = buildRecord(
        error instanceof Error ? error : new Error(String(error)),
        source || 'ReactBoundary',
        true,
      );
      addError({ ...record, componentStack: componentStack || '' });
    }
    window.addEventListener('hys:error', handler);
    return () => window.removeEventListener('hys:error', handler);
  }, [addError]);

  // ── 4. console.error override ──────────────────────────────────────────
  //    Captures [storeX] console.error calls + Firebase errors + API errors.
  //    Skips React / Next.js / Webpack internal messages.
  useEffect(() => {
    const orig = console.error.bind(console);
    console.error = (...args) => {
      orig(...args);                            // always pass through first
      const first = String(args[0] ?? '');
      if (SKIP_CONSOLE_ERROR.some(p => p.test(first))) return;

      // Build the error record
      let err;
      if (args[0] instanceof Error) {
        err = args[0];
      } else {
        const msg = args
          .map(a =>
            a instanceof Error
              ? a.message
              : typeof a === 'object' && a !== null
                ? (a.message || safeStringify(a))
                : String(a),
          )
          .join(' ');
        err = new Error(msg);
        // If first arg has a store name prefix, use it as error type
        const storeMatch = first.match(/^\[(.+?)\]/);
        if (storeMatch) err.name = storeMatch[1];
      }

      addError(buildRecord(err, `console.error — ${err.name || 'Error'}`, args[0] instanceof Error));
    };
    return () => { console.error = orig; };
  }, [addError]);

  // ── 5. console.warn override ───────────────────────────────────────────
  //    Only captures HYS store warnings and Firebase SDK error warnings.
  //    All other console.warn calls pass through silently.
  useEffect(() => {
    const orig = console.warn.bind(console);
    console.warn = (...args) => {
      orig(...args);                            // always pass through first
      const combined = args.map(a => String(a ?? '')).join(' ');
      const isHYSStore  = HYS_STORE_REGEX.test(combined);
      const isFirebase  = FIREBASE_ERROR_REGEX.test(combined);
      if (!isHYSStore && !isFirebase) return;

      const storeMatch = combined.match(/^\[(.+?)\]/);
      const storeName  = storeMatch?.[1] || 'Firebase';
      const fullMsg    = args
        .map(a =>
          typeof a === 'object' && a !== null
            ? (a?.message || safeStringify(a))
            : String(a),
        )
        .join(' ');

      const err       = Object.assign(new Error(fullMsg), { name: storeName });
      addError(buildRecord(err, `${storeName} (caught in store)`, false));
    };
    return () => { console.warn = orig; };
  }, [addError]);

  // ── Report handler — passed to ErrorPanel as onReport ─────────────────
  const handleReport = useCallback(async (record) => {
    return reportError(record);
  }, []);

  // ── Dismiss handlers ───────────────────────────────────────────────────

  /** Dismiss the error at a specific index. */
  const dismissOne = useCallback((idx = 0) => {
    setErrors(prev => {
      const next = [...prev];
      next.splice(idx, 1);
      if (next.length === 0) seenRef.current.clear();
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setErrors([]);
    seenRef.current.clear();
  }, []);

  return (
    <>
      {children}
      {errors.length > 0 && (
        <ErrorPanel
          errors={errors}
          onDismiss={dismissOne}
          onDismissAll={dismissAll}
          onReport={handleReport}
          reveal={reveal}
        />
      )}
    </>
  );
}