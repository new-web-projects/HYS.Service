'use client';

import { useEffect, useMemo }     from 'react';
import Link                       from 'next/link';
import { useContentStore }        from '@/store/contentStore';
import { useUserStore }           from '@/store/userStore';
import StatsCard                  from '@/components/admin/StatsCard';
import {
  UserIcon, WorkerIcon, CategoryIcon, MediaIcon,
  PageIcon, GlobeIcon, EditIcon, WarningIcon,
} from '@/components/icons';

const ACTION_LABELS = {
  create:  { label: 'Created',  color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  update:  { label: 'Updated',  color: 'bg-blue-500/10   text-blue-400   border-blue-500/20'   },
  delete:  { label: 'Deleted',  color: 'bg-red-500/10    text-red-400    border-red-500/20'    },
  restore: { label: 'Restored', color: 'bg-amber-500/10  text-amber-400  border-amber-500/20'  },
};

export default function DashboardPage() {
  const {
    pages, media, auditLogs, categories,
    pagesLoading, mediaLoading, categoriesLoading,
    subscribePages, subscribeMedia, subscribeCategories,
    fetchAuditLogs,
    unsubscribePages, unsubscribeMedia, unsubscribeCategories,
  } = useContentStore();

  const {
    allUsers, allWorkers,
    allUsersLoading, allWorkersLoading,
    fetchAllUsers, fetchAllWorkers,
  } = useUserStore();

  useEffect(() => {
    subscribePages();
    subscribeMedia();
    subscribeCategories();
    // Only fetch 5 audit logs — not all of them
    fetchAuditLogs(5);
    // Fetch users + workers for dashboard counts
    fetchAllUsers();
    fetchAllWorkers();

    return () => {
      unsubscribePages();
      unsubscribeMedia();
      unsubscribeCategories();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * PERFORMANCE: useMemo prevents recalculating these derived values
   * on every render. They only recalculate when the source arrays change.
   */
  const stats = useMemo(() => ({
    totalPages:        pages.length,
    publishedPages:    pages.filter((p) => p.isPublished && !p.deletedAt).length,
    draftPages:        pages.filter((p) => !p.isPublished && !p.deletedAt).length,
    totalMedia:        media.length,
    activeCategories:  categories.filter((c) => c.status === 'active').length,
    pendingCategories: categories.filter((c) => c.status === 'pending').length,
    totalUsers:        allUsers.length,
    customers:         allUsers.filter((u) => u.role === 'customer').length,
    totalWorkers:      allWorkers.length,
    availableWorkers:  allWorkers.filter((w) => w.isAvailable).length,
    verifiedWorkers:   allWorkers.filter((w) => w.isVerified).length,
  }), [pages, media, categories, allUsers, allWorkers]);

  const loading = pagesLoading || mediaLoading;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text">Dashboard</h1>
          <p className="text-admin-muted text-sm mt-0.5">Platform overview — live data</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pages/new"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm
                           font-semibold rounded-xl transition-colors">
            + New Page
          </Link>
          <Link href="/media"
                className="px-4 py-2 bg-admin-card border border-admin-border
                           hover:border-brand-500/50 text-admin-text text-sm font-semibold
                           rounded-xl transition-colors">
            Upload Media
          </Link>
        </div>
      </div>

      {/* Platform stats */}
      <div>
        <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-3">
          Platform
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label="Total Users"   value={stats.totalUsers}
                     icon={<UserIcon className="w-5 h-5" />} sub={`${stats.customers} customers`}
                     accentColor="brand"   loading={allUsersLoading} />
          <StatsCard label="Workers"       value={stats.totalWorkers}
                     icon={<WorkerIcon className="w-5 h-5" />} sub={`${stats.availableWorkers} available · ${stats.verifiedWorkers} verified`}
                     accentColor="emerald" loading={allWorkersLoading} />
          <StatsCard label="Categories"    value={stats.activeCategories}
                     icon={<CategoryIcon className="w-5 h-5" />}
                     sub={stats.pendingCategories > 0 ? `${stats.pendingCategories} pending` : 'All active'}
                     accentColor={stats.pendingCategories > 0 ? 'amber' : 'brand'}
                     loading={categoriesLoading} />
          <StatsCard label="Media Files"   value={stats.totalMedia}
                     icon={<MediaIcon className="w-5 h-5" />} accentColor="brand"
                     loading={loading} />
        </div>
      </div>

      {/* Content stats */}
      <div>
        <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-3">
          Content
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard label="Total Pages"   value={stats.totalPages}
                     icon={<PageIcon className="w-5 h-5" />} loading={loading} />
          <StatsCard label="Published"     value={stats.publishedPages}
                     icon={<GlobeIcon className="w-5 h-5" />} accentColor="emerald"
                     sub={`${stats.draftPages} draft${stats.draftPages !== 1 ? 's' : ''}`}
                     loading={loading} />
          <StatsCard label="Draft Pages"   value={stats.draftPages}
                     icon={<EditIcon className="w-5 h-5" />} loading={loading} />
        </div>
      </div>

      {/* Pending approval alert */}
      {stats.pendingCategories > 0 && (
        <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/25
                         rounded-2xl px-5 py-4">
          <WarningIcon className="w-8 h-8 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300">
              {stats.pendingCategories} category suggestion{stats.pendingCategories !== 1 ? 's' : ''} awaiting approval
            </p>
            <p className="text-amber-300/60 text-sm mt-0.5">
              Workers suggested new service categories during signup.
            </p>
          </div>
          <Link href="/categories"
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30
                           text-amber-300 text-sm font-semibold rounded-xl transition-colors shrink-0">
            Review →
          </Link>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-admin-border">
          <h2 className="text-base font-semibold text-admin-text">Recent Activity</h2>
          <p className="text-admin-muted text-xs mt-0.5">Last 5 admin actions</p>
        </div>

        {auditLogs.length === 0 ? (
          <p className="px-5 py-10 text-admin-muted text-sm text-center">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-admin-border">
            {auditLogs.map((log) => {
              const actionInfo = ACTION_LABELS[log.action] ?? {
                label: log.action, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
              };
              return (
                <li key={log.id} className="px-5 py-3.5 flex items-center gap-4">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0
                                    ${actionInfo.color}`}>
                    {actionInfo.label}
                  </span>
                  <span className="text-sm text-admin-text flex-1 truncate">
                    {log.collection}/{log.documentId}
                  </span>
                  <span className="text-xs text-admin-muted shrink-0 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}