'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link                                           from 'next/link';
import { useContentStore }                            from '@/store/contentStore';
import { useToast }                                   from '@/components/shared/Toast';
import { useConfirm }                                 from '@/components/shared/ConfirmDialog';
import LoadingSpinner, { TableRowSkeleton }           from '@/components/shared/LoadingSpinner';
import { useAuthStore }                               from '@/store/authStore';
import { TrashIcon, PageIcon }                        from '@/components/icons';

const PAGE_SIZE = 20;

function StatusBadge({ isPublished }) {
  return isPublished ? (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold
                     bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      Published
    </span>
  ) : (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold
                     bg-gray-500/10 text-gray-400 border border-gray-500/20">
      Draft
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function PagesAdminPage() {
  const { pages, pagesLoading, subscribePages, unsubscribePages, deletePage } =
    useContentStore();
  const { user }   = useAuthStore();
  const toast      = useToast((s) => s.show);
  const confirm    = useConfirm((s) => s.confirm);

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage,  setCurrentPage]  = useState(1);
  const [deleting,     setDeleting]     = useState(null);

  useEffect(() => {
    subscribePages();
    return () => unsubscribePages();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  /**
   * PERFORMANCE: useMemo prevents re-running this filter on every render.
   * The filtered list only recalculates when pages, search, or statusFilter changes.
   */
  const filteredPages = useMemo(() => {
    return pages.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && p.isPublished) ||
        (statusFilter === 'draft'     && !p.isPublished);
      return matchSearch && matchStatus && !p.deletedAt;
    });
  }, [pages, search, statusFilter]);

  // Client-side pagination
  const totalPages  = Math.ceil(filteredPages.length / PAGE_SIZE);
  const paginatedPages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPages.slice(start, start + PAGE_SIZE);
  }, [filteredPages, currentPage]);

  /**
   * PERFORMANCE: useCallback prevents this function from being recreated
   * on every render. Without useCallback, every row re-renders because
   * the delete function reference changes.
   */
  const handleDelete = useCallback(async (page) => {
    const ok = await confirm(
      `Move "${page.title}" to Trash?`,
      'The page can be restored from the Trash within 30 days.',
    );
    if (!ok) return;
    setDeleting(page.id);
    try {
      await deletePage(page.id);
      toast(`"${page.title}" moved to Trash.`, 'success');
    } catch (err) {
      toast(err.message ?? 'Delete failed.', 'error');
    } finally {
      setDeleting(null);
    }
  }, [confirm, deletePage, toast]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Pages</h1>
          <p className="text-admin-muted text-sm mt-0.5">
            {filteredPages.length} page{filteredPages.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pages/trash"
            className="px-4 py-2.5 bg-admin-card border border-admin-border rounded-xl
                       text-admin-muted hover:text-admin-text text-sm font-medium transition-colors
                       flex items-center gap-2"
          >
            <TrashIcon className="w-4 h-4" />
            Trash
          </Link>
          <Link
            href="/pages/new"
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white
                       text-sm font-semibold rounded-xl transition-colors"
          >
            + New Page
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or slug…"
            className="w-full pl-9 pr-4 py-2.5 bg-admin-card border border-admin-border
                       rounded-xl text-admin-text text-sm placeholder-admin-muted/40
                       focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-1 bg-admin-bg border border-admin-border rounded-xl p-1">
          {[
            { id: 'all',       label: 'All'        },
            { id: 'published', label: 'Published'  },
            { id: 'draft',     label: 'Drafts'     },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                          ${statusFilter === id
                            ? 'bg-brand-600 text-white'
                            : 'text-admin-muted hover:text-admin-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
        {pagesLoading ? (
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </tbody>
          </table>
        ) : paginatedPages.length === 0 ? (
          <div className="p-12 text-center">
            <PageIcon className="w-12 h-12 mb-4 mx-auto text-admin-muted/40" />
            <p className="text-admin-muted font-medium">
              {search ? `No pages matching "${search}"` : 'No pages yet'}
            </p>
            {!search && (
              <Link
                href="/pages/new"
                className="mt-4 inline-block px-4 py-2 bg-brand-600 hover:bg-brand-700
                           text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Create your first page
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border">
                  {['Title', 'Slug', 'Status', 'Last Updated', 'Actions'].map((h) => (
                    <th key={h}
                        className="text-left text-xs font-semibold text-admin-muted uppercase
                                   tracking-wider px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {paginatedPages.map((page) => (
                  <tr key={page.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-admin-text truncate max-w-[200px]">
                        {page.title}
                      </p>
                      <p className="text-admin-muted text-xs mt-0.5">
                        {page.sections?.length ?? 0} section{page.sections?.length !== 1 ? 's' : ''}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-brand-400 text-xs bg-brand-600/10 px-2 py-1 rounded">
                        /{page.slug}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge isPublished={page.isPublished} />
                    </td>
                    <td className="px-5 py-4 text-admin-muted text-xs whitespace-nowrap">
                      {formatDate(page.updatedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/pages/${page.id}/edit`}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-admin-bg
                                     border border-admin-border text-admin-muted
                                     hover:text-brand-400 hover:border-brand-500/50 transition-colors"
                        >
                          Edit
                        </Link>
                        <a
                          href={`/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-admin-bg
                                     border border-admin-border text-admin-muted
                                     hover:text-admin-text transition-colors"
                        >
                          View ↗
                        </a>
                        <button
                          onClick={() => handleDelete(page)}
                          disabled={deleting === page.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-admin-bg
                                     border border-admin-border text-red-400/70
                                     hover:text-red-400 hover:border-red-500/50 transition-colors
                                     disabled:opacity-40"
                        >
                          {deleting === page.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-admin-muted text-sm">
            Showing{' '}
            {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredPages.length)}–
            {Math.min(currentPage * PAGE_SIZE, filteredPages.length)}{' '}
            of {filteredPages.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-admin-card border border-admin-border rounded-xl
                         text-admin-muted hover:text-admin-text text-sm font-medium
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) =>
                p === 1 || p === totalPages ||
                (p >= currentPage - 1 && p <= currentPage + 1),
              )
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-3 py-2 text-admin-muted text-sm">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                                ${currentPage === item
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-admin-card border border-admin-border text-admin-muted hover:text-admin-text'}`}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-admin-card border border-admin-border rounded-xl
                         text-admin-muted hover:text-admin-text text-sm font-medium
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}