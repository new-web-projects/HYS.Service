'use client';

/**
 * app/(admin)/error-center/page.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin Error Center — view, filter, search, sort, and manage all reported
 * errors submitted by users via the ErrorProvider panel.
 *
 * Features:
 *   ✅ Real-time Firestore subscription (new reports appear instantly)
 *   ✅ Stats cards: total · new · investigating · fixed · closed
 *   ✅ Status filter tabs
 *   ✅ Full-text search on message / file / route
 *   ✅ Sort: newest first / oldest first
 *   ✅ Error detail drawer with full stack trace
 *   ✅ Status change: new → investigating → fixed → closed
 *   ✅ Admin notes textarea
 *   ✅ Frequency counter (same error message reported N times)
 *   ✅ Mobile responsive
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BugIcon, CheckIcon }                         from '@/components/icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['all', 'new', 'investigating', 'fixed', 'closed'];

const STATUS_STYLES = {
  new:           { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',   text: '#fca5a5', dot: '#ef4444' },
  investigating: { bg: 'rgba(234,179,8,0.15)',   border: 'rgba(234,179,8,0.3)',   text: '#fde047', dot: '#eab308' },
  fixed:         { bg: 'rgba(34,197,94,0.15)',   border: 'rgba(34,197,94,0.3)',   text: '#86efac', dot: '#22c55e' },
  closed:        { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)', text: '#9ca3af', dot: '#6b7280' },
};

function fmtTime(isoOrTs) {
  const d = typeof isoOrTs === 'number' ? new Date(isoOrTs) : new Date(isoOrTs);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function fmtRelative(isoOrTs) {
  const now  = Date.now();
  const then = typeof isoOrTs === 'number' ? isoOrTs : new Date(isoOrTs).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.closed;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}

// ─── StatsCard ────────────────────────────────────────────────────────────────

function StatsCard({ label, count, accent, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-2xl border transition-all text-left"
      style={{
        background: active ? `rgba(${accent},0.12)` : 'var(--admin-card, rgba(30,27,75,0.5))',
        borderColor: active ? `rgba(${accent},0.4)` : 'rgba(255,255,255,0.06)',
      }}
    >
      <span className="text-2xl font-black mb-1" style={{ color: active ? `rgb(${accent})` : '#d4d4d8' }}>
        {count}
      </span>
      <span className="text-xs font-semibold" style={{ color: active ? `rgba(${accent},0.8)` : '#71717a' }}>
        {label}
      </span>
    </button>
  );
}

// ─── ErrorCard (list row) ─────────────────────────────────────────────────────

function ErrorCard({ report, frequency, onSelect, selected }) {
  return (
    <button
      onClick={() => onSelect(report)}
      className="w-full text-left p-4 rounded-2xl border transition-all hover:border-white/10"
      style={{
        background:   selected ? 'rgba(99,102,241,0.1)'    : 'rgba(24,24,27,0.7)',
        borderColor:  selected ? 'rgba(99,102,241,0.35)'   : 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Left: pulse for "new" */}
        <div className="mt-1 shrink-0">
          {report.status === 'new' ? (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full" style={{ background: STATUS_STYLES[report.status]?.dot ?? '#6b7280' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Type + status + frequency */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold font-mono" style={{ color: '#f87171' }}>
              {report.type || 'Error'}
            </span>
            <StatusBadge status={report.status || 'new'} />
            {frequency > 1 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                ×{frequency}
              </span>
            )}
          </div>

          {/* Message */}
          <p className="text-sm font-mono leading-snug mb-1.5 line-clamp-2"
            style={{ color: '#a1a1aa', wordBreak: 'break-word' }}>
            {report.message}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono" style={{ color: '#52525b' }}>
            <span>{report.file}:{report.line}</span>
            <span>·</span>
            <span className="truncate max-w-[140px]">{report.route}</span>
            <span>·</span>
            <span>{report.role}</span>
            <span>·</span>
            <span>{fmtRelative(report.reportedAt?.seconds
              ? report.reportedAt.seconds * 1000
              : report.errorOccurredAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── DetailPanel ─────────────────────────────────────────────────────────────

function DetailPanel({ report, onClose, onUpdate }) {
  const [status,   setStatus]   = useState(report.status   || 'new');
  const [notes,    setNotes]    = useState(report.notes    || '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await onUpdate(report.id, { status, notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const ts = report.reportedAt?.seconds
    ? fmtTime(report.reportedAt.seconds * 1000)
    : fmtTime(report.errorOccurredAt || Date.now());

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'rgba(9,9,11,0.97)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-red-400 font-bold font-mono text-sm">{report.type}</span>
            <StatusBadge status={report.status || 'new'} />
          </div>
          <p className="text-xs font-mono mt-0.5 truncate" style={{ color: '#52525b' }}>{ts}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl transition-colors shrink-0"
          style={{ color: '#71717a' }}
          aria-label="Close detail panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Error message */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#3f3f46' }}>
            Error Message
          </p>
          <p className="text-sm font-mono leading-relaxed" style={{ color: '#fca5a5', wordBreak: 'break-word' }}>
            {report.message}
          </p>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { k: 'Error Type', v: report.type      || 'Error'   },
            { k: 'File',       v: `${report.file   || '?'}:${report.line || '?'}` },
            { k: 'Function',   v: report.fn         || 'unknown' },
            { k: 'Route',      v: report.route      || '/'       },
            { k: 'Source',     v: report.source     || 'unknown' },
            { k: 'Error Code', v: report.code       || '—'       },
            { k: 'Browser',    v: report.browser    || 'unknown' },
            { k: 'Device',     v: `${report.device || '?'}  ${report.screen || ''}` },
            { k: 'User Role',  v: report.role       || 'unknown' },
            { k: 'User',       v: report.userId     || 'anonymous' },
          ].map(({ k, v }) => (
            <div key={k} className="rounded-xl px-3 py-2" style={{ background: 'rgba(24,24,27,0.7)' }}>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#3f3f46' }}>{k}</p>
              <p className="text-xs font-mono truncate" style={{ color: '#d4d4d8' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Stack trace */}
        {report.stack && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#3f3f46' }}>
              Stack Trace
            </p>
            <div className="rounded-xl p-3 overflow-x-auto" style={{ background: 'rgba(4,4,6,0.9)', maxHeight: '200px', overflowY: 'auto' }}>
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ color: '#71717a' }}>
                {report.stack}
              </pre>
            </div>
          </div>
        )}

        {/* Component stack */}
        {report.componentStack && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: '#3f3f46' }}>
              Component Tree
            </p>
            <div className="rounded-xl p-3" style={{ background: 'rgba(4,4,6,0.9)' }}>
              <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ color: '#71717a' }}>
                {report.componentStack}
              </pre>
            </div>
          </div>
        )}

        {/* Status selector */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#3f3f46' }}>
            Status
          </p>
          <div className="flex gap-2 flex-wrap">
            {['new', 'investigating', 'fixed', 'closed'].map(s => {
              const st = STATUS_STYLES[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all"
                  style={status === s
                    ? { background: st.bg, border: `1px solid ${st.border}`, color: st.text }
                    : { background: 'rgba(24,24,27,0.7)', border: '1px solid rgba(255,255,255,0.06)', color: '#52525b' }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: '#3f3f46' }}>
            Admin Notes
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add investigation notes, root cause, fix reference…"
            rows={4}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-mono resize-none outline-none focus:ring-1"
            style={{
              background:  'rgba(24,24,27,0.7)',
              border:      '1px solid rgba(255,255,255,0.06)',
              color:       '#d4d4d8',
              lineHeight:  '1.6',
            }}
          />
        </div>
      </div>

      {/* Save footer */}
      <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors"
          style={saved
            ? { background: 'rgba(22,163,74,0.2)',  color: '#4ade80' }
            : { background: '#4f46e5',               color: '#fff', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : saved ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4" />
              Saved
            </span>
          ) : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ErrorCenterPage() {
  const [reports,     setReports]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [statusFilter,setStatusFilter]= useState('all');
  const [search,      setSearch]      = useState('');
  const [sort,        setSort]        = useState('newest');

  // ── Subscribe to errorReports with real-time updates ──────────────────────
  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const [{ db }, { collection, onSnapshot, orderBy, query }] = await Promise.all([
          import('@/lib/firebase/config'),
          import('firebase/firestore'),
        ]);

        const q = query(
          collection(db, 'errorReports'),
          orderBy('reportedAt', 'desc'),
        );

        unsub = onSnapshot(
          q,
          (snap) => {
            setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
          },
          (err) => {
            console.error('[ErrorCenter] subscription:', err.message);
            setLoading(false);
          },
        );
      } catch (err) {
        console.error('[ErrorCenter] init:', err.message);
        setLoading(false);
      }
    })();
    return () => unsub?.();
  }, []);

  // ── Update a report ────────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (reportId, updates) => {
    try {
      const [{ db }, { doc, updateDoc, serverTimestamp }] = await Promise.all([
        import('@/lib/firebase/config'),
        import('firebase/firestore'),
      ]);
      await updateDoc(doc(db, 'errorReports', reportId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      // Optimistically update local selected
      setSelected(prev => prev?.id === reportId ? { ...prev, ...updates } : prev);
    } catch (err) {
      console.error('[ErrorCenter] updateDoc:', err.message);
    }
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { new: 0, investigating: 0, fixed: 0, closed: 0 };
    reports.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    return s;
  }, [reports]);

  // ── Frequency map (how many times same message appears) ───────────────────
  const freqMap = useMemo(() => {
    const m = {};
    reports.forEach(r => {
      const key = r.message?.slice(0, 80) ?? '';
      m[key] = (m[key] || 0) + 1;
    });
    return m;
  }, [reports]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = reports;

    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.message || '').toLowerCase().includes(q) ||
        (r.route   || '').toLowerCase().includes(q) ||
        (r.file    || '').toLowerCase().includes(q) ||
        (r.type    || '').toLowerCase().includes(q) ||
        (r.userId  || '').toLowerCase().includes(q),
      );
    }

    if (sort === 'oldest') list = [...list].reverse();

    return list;
  }, [reports, statusFilter, search, sort]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-screen" style={{ background: '#0f0e1a' }}>

      {/* ── Left panel: list ─────────────────────────────────────────────── */}
      <div
        className="flex flex-col min-h-screen"
        style={{ width: selected ? '55%' : '100%', transition: 'width 0.25s ease' }}
      >
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <BugIcon className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-admin-text text-lg font-black">Error Center</h1>
              <p className="text-admin-muted text-xs">{reports.length} total reports</p>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-5 gap-2 mb-5">
            <StatsCard label="Total"         count={reports.length}        accent="161,161,170" onClick={() => setStatusFilter('all')}          active={statusFilter === 'all'} />
            <StatsCard label="New"           count={stats.new}             accent="239,68,68"   onClick={() => setStatusFilter('new')}          active={statusFilter === 'new'} />
            <StatsCard label="Investigating" count={stats.investigating}   accent="234,179,8"   onClick={() => setStatusFilter('investigating')} active={statusFilter === 'investigating'} />
            <StatsCard label="Fixed"         count={stats.fixed}           accent="34,197,94"   onClick={() => setStatusFilter('fixed')}        active={statusFilter === 'fixed'} />
            <StatsCard label="Closed"        count={stats.closed}          accent="107,114,128" onClick={() => setStatusFilter('closed')}       active={statusFilter === 'closed'} />
          </div>

          {/* Search + sort */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#52525b' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search message, route, file, user…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500/40"
                style={{
                  background:  'rgba(24,24,27,0.7)',
                  border:      '1px solid rgba(255,255,255,0.06)',
                  color:       '#d4d4d8',
                }}
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
              style={{
                background:  'rgba(24,24,27,0.7)',
                border:      '1px solid rgba(255,255,255,0.06)',
                color:       '#a1a1aa',
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
              style={statusFilter === s
                ? { background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }
                : { background: 'transparent', color: '#52525b', border: '1px solid transparent' }}
            >
              {s === 'all' ? `All (${reports.length})` : `${s} (${stats[s] ?? 0})`}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BugIcon className="w-10 h-10 mb-3" style={{ color: '#3f3f46' }} />
              <p className="text-sm font-semibold" style={{ color: '#52525b' }}>
                {search ? 'No errors match your search.' : 'No errors in this category.'}
              </p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-2 text-xs text-indigo-400 hover:underline">
                  Clear search
                </button>
              )}
            </div>
          )}

          {!loading && filtered.map(r => (
            <ErrorCard
              key={r.id}
              report={r}
              frequency={freqMap[r.message?.slice(0, 80) ?? ''] ?? 1}
              onSelect={setSelected}
              selected={selected?.id === r.id}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel: detail ───────────────────────────────────────────── */}
      {selected && (
        <div className="hidden md:flex flex-col" style={{ width: '45%' }}>
          <DetailPanel
            report={selected}
            onClose={() => setSelected(null)}
            onUpdate={handleUpdate}
          />
        </div>
      )}

      {/* Mobile detail: fullscreen overlay */}
      {selected && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(9,9,11,0.99)' }}
        >
          <DetailPanel
            report={selected}
            onClose={() => setSelected(null)}
            onUpdate={handleUpdate}
          />
        </div>
      )}
    </div>
  );
}
