'use client';

/**
 * app/global-error.jsx — Global Error Boundary
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js renders this when the ROOT LAYOUT itself throws.  Unlike app/error.jsx,
 * this component MUST render its own <html> and <body> because it replaces the
 * entire document.
 *
 * IMPORTANT: Tailwind CSS is NOT guaranteed to be loaded at this point (the
 * layout that loads the stylesheet may have been the one that crashed).  All
 * styles here use inline CSS for reliability.
 *
 * This page always shows technical details since root-layout crashes are
 * exclusively developer/infra issues.
 */

import { useEffect } from 'react';

// ─── Inline style constants ───────────────────────────────────────────────────

const S = {
  body: {
    margin: 0,
    padding: 0,
    minHeight: '100vh',
    background: '#07040c',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: {
    width: '100%',
    maxWidth: '680px',
    margin: '0 auto',
    padding: '24px',
  },
  card: {
    background: 'rgba(18, 12, 28, 0.97)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 20px',
    background: 'rgba(127, 29, 29, 0.25)',
    borderBottom: '1px solid rgba(239,68,68,0.15)',
  },
  pulse: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ef4444',
    animation: 'pulse 1.5s infinite',
  },
  title: {
    color: '#f87171',
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '15px',
    margin: 0,
    flex: 1,
  },
  badge: {
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: '20px',
  },
  body2: {
    padding: '20px',
    borderBottom: '1px solid rgba(39,39,42,0.5)',
  },
  message: {
    color: '#fca5a5',
    fontFamily: 'monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: 0,
    wordBreak: 'break-word',
  },
  digest: {
    color: '#3f3f46',
    fontFamily: 'monospace',
    fontSize: '11px',
    marginTop: '8px',
  },
  preWrap: {
    background: 'rgba(9,9,11,0.9)',
    borderRadius: '12px',
    padding: '14px',
    margin: '12px 20px 0',
    overflow: 'auto',
    maxHeight: '220px',
  },
  pre: {
    color: '#71717a',
    fontFamily: 'monospace',
    fontSize: '11px',
    lineHeight: '1.7',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  label: {
    color: '#3f3f46',
    fontFamily: 'monospace',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '14px 20px 6px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px',
    flexWrap: 'wrap',
  },
  btnPrimary: {
    padding: '10px 22px',
    background: '#1d4ed8',
    color: '#fff',
    fontWeight: 700,
    fontSize: '14px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnSecondary: {
    padding: '10px 22px',
    background: 'rgba(39,39,42,0.8)',
    color: '#a1a1aa',
    fontWeight: 700,
    fontSize: '14px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  },
  hint: {
    textAlign: 'center',
    color: '#3f3f46',
    fontSize: '11px',
    fontFamily: 'monospace',
    marginTop: '14px',
  },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[GlobalError] Root layout crashed:', error?.name, error?.message, error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Critical Error — HYS Services</title>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
          }
          * { box-sizing: border-box; }
        `}</style>
      </head>
      <body style={S.body}>
        <div style={S.wrap}>
          <div style={S.card}>

            {/* Header */}
            <div style={S.header}>
              <div style={S.pulse} />
              <p style={S.title}>{error?.name || 'Fatal Error'} — Root Layout Crashed</p>
              <span style={S.badge}>CRITICAL</span>
            </div>

            {/* Message */}
            <div style={S.body2}>
              <p style={S.message}>
                {error?.message || 'A critical error occurred in the application root.'}
              </p>
              {error?.digest && (
                <p style={S.digest}>digest: {error.digest}</p>
              )}
            </div>

            {/* Stack trace */}
            {error?.stack && (
              <>
                <p style={S.label}>Stack Trace</p>
                <div style={S.preWrap}>
                  <pre style={S.pre}>{error.stack}</pre>
                </div>
              </>
            )}

            {/* Component stack */}
            {error?.componentStack && (
              <>
                <p style={{ ...S.label, paddingTop: '12px' }}>Component Tree</p>
                <div style={{ ...S.preWrap, maxHeight: '130px' }}>
                  <pre style={S.pre}>{error.componentStack.trim()}</pre>
                </div>
              </>
            )}

            {/* Actions */}
            <div style={S.actions}>
              <button onClick={reset} style={S.btnPrimary}>
                ↺ Try Again
              </button>
              <a href="/" style={S.btnSecondary}>
                ⌂ Go Home
              </a>
            </div>
          </div>

          <p style={S.hint}>
            HYS Services · Global Error Boundary ·{' '}
            {new Date().toLocaleString('en-IN', { hour12: true })}
          </p>
        </div>
      </body>
    </html>
  );
}
