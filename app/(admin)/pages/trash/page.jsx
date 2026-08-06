'use client';

import { useEffect, useState, useMemo } from 'react';
import Link                             from 'next/link';
import { useContentStore }              from '@/store/contentStore';
import { useToast }                     from '@/components/shared/Toast';
import { useConfirm }                   from '@/components/shared/ConfirmDialog';
import LoadingSpinner                   from '@/components/shared/LoadingSpinner';
import {
  TrashIcon, ArrowRightIcon, RefreshIcon,
}                                       from '@/components/icons';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function daysLeft(deletedAtIso) {
  if (!deletedAtIso) return 0;
  const deletedAt  = new Date(deletedAtIso).getTime();
  const expiresAt  = deletedAt + 30 * 24 * 60 * 60 * 1000;
  const remaining  = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

export default function TrashPage() {
  const {
    trashPages,
    trashLoading,
    fetchTrashPages,
    restorePage,
    deletePage,
  } = useContentStore();

  const toast   = useToast((s) => s.show);
  const confirm = useConfirm((s) => s.confirm);

  const [restoringId, setRestoringId] = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    fetchTrashPages();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() =>
    search
      ? trashPages.filter((p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase()),
        )
      : trashPages,
    [trashPages, search],
  );

  async function handleRestore(page) {
    setRestoringId(page.id);
    try {
      await restorePage(page.id);
      toast(`"${page.title}" restored successfully.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Restore failed.', 'error');
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePermanentDelete(page) {
    const ok = await confirm(
      `Permanently delete "${page.title}"?`,
      'This action cannot be undone. The page will be gone forever.',
    );
    if (!ok) return;
    setDeletingId(page.id);
    try {
      // Hard delete (bypass soft-delete for trash items)
      const { db }           = await import('@/lib/firebase/config');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'pages', page.id));
      // Remove from local trash state
      useContentStore.setState((s) => ({
        trashPages: s.trashPages.filter((p) => p.id !== page.id),
      }));
      toast(`"${page.title}" permanently deleted.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Delete failed.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/pages"
                  className="text-admin-muted hover:text-admin-text text-sm transition-colors">
              Pages
            </Link>
            <span className="text-admin-muted">/</span>
            <span className="text-admin-text text-sm font-medium">Trash</span>
          </div>
          <h1 className="text-2xl font-bold text-admin-text flex items-center gap-2.5">
            <TrashIcon className="w-6 h-6 text-admin-muted" />
            Trash
          </h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {trashPages.length} deleted page{trashPages.length !== 1 ? 's' : ''} —
            auto-purged after 30 days
          </p>
        </div>
        <button
          onClick={fetchTrashPages}
          className="flex items-center gap-2 px-4 py-2.5 bg-admin-card border
                     border-admin-border rounded-xl text-admin-muted hover:text-admin-text
                     text-sm font-medium transition-colors"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20
                      rounded-xl px-4 py-3">
        <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none"
             viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-amber-300 text-xs leading-relaxed">
          Pages in Trash are automatically purged 30 days after deletion.
          Restore a page to make it accessible again (it will be set to Draft).
        </p>
      </div>

      {/* Search */}
      {trashPages.length > 0 && (
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deleted pages…"
            className="w-full pl-9 pr-4 py-2.5 bg-admin-card border border-admin-border
                       rounded-xl text-admin-text text-sm placeholder-admin-muted/40
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Loading */}
      {trashLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="Loading trash…" />
        </div>
      )}

      {/* Empty state */}
      {!trashLoading && filtered.length === 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
          <TrashIcon className="w-12 h-12 text-admin-border mx-auto mb-4" />
          <p className="text-admin-muted font-medium">
            {search ? `No deleted pages matching "${search}"` : 'Trash is empty'}
          </p>
          <Link href="/pages"
                className="mt-4 inline-flex items-center gap-2 text-brand-400
                           hover:text-brand-300 text-sm font-semibold transition-colors">
            Back to Pages
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Pages list */}
      {!trashLoading && filtered.length > 0 && (
        <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border">
                  {['Title', 'Slug', 'Deleted On', 'Expires In', 'Actions'].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-semibold text-admin-muted uppercase
                                   tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {filtered.map((page) => {
                  const days = daysLeft(page.deletedAt);
                  return (
                    <tr key={page.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-admin-text truncate max-w-[200px]">
                          {page.title}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <code className="text-admin-muted text-xs">/{page.slug}</code>
                      </td>
                      <td className="px-5 py-4 text-admin-muted text-xs whitespace-nowrap">
                        {formatDate(page.deletedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-semibold
                                          ${days <= 5
                                            ? 'text-red-400'
                                            : days <= 10
                                            ? 'text-amber-400'
                                            : 'text-admin-muted'}`}>
                          {days} day{days !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestore(page)}
                            disabled={restoringId === page.id || deletingId === page.id}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg
                                       bg-brand-600/15 border border-brand-500/30 text-brand-400
                                       hover:bg-brand-600/25 transition-colors disabled:opacity-40"
                          >
                            {restoringId === page.id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(page)}
                            disabled={deletingId === page.id || restoringId === page.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg
                                       bg-admin-bg border border-admin-border text-red-400/70
                                       hover:text-red-400 hover:border-red-500/50 transition-colors
                                       disabled:opacity-40"
                          >
                            {deletingId === page.id ? 'Deleting…' : 'Delete Forever'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}