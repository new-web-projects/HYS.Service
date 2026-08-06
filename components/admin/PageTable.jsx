'use client';

import Link               from 'next/link';
import { useConfirm }     from '@/components/shared/ConfirmDialog';
import { useToast }       from '@/components/shared/Toast';
import { useContentStore } from '@/store/contentStore';

function StatusBadge({ published }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${published
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-gray-500/10  text-gray-400  border border-gray-500/20'}`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

export default function PageTable({ pages = [] }) {
  const { deletePage, updatePage } = useContentStore();
  const toast   = useToast((s) => s.show);
  const confirm = useConfirm((s) => s.confirm);

  async function handleDelete(page) {
    const ok = await confirm(
      `Delete "${page.title}"?`,
      'The page will be moved to Trash and can be recovered within 30 days.',
    );
    if (!ok) return;
    try {
      await deletePage(page.id);
      toast('Page moved to Trash.', 'success');
    } catch (err) {
      toast(err.message ?? 'Failed to delete page.', 'error');
    }
  }

  async function handleTogglePublish(page) {
    try {
      await updatePage(page.id, { isPublished: !page.isPublished });
      toast(page.isPublished ? 'Page unpublished.' : 'Page published.', 'success');
    } catch (err) {
      toast(err.message ?? 'Failed to update page.', 'error');
    }
  }

  if (!pages.length) {
    return (
      <div className="bg-admin-card border border-admin-border rounded-2xl p-12 text-center">
        <p className="text-admin-muted">No pages yet.</p>
        <Link
          href="/pages/new"
          className="mt-4 inline-block px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Create your first page
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-border">
              {['Title', 'Slug', 'Status', 'Last Updated', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold text-admin-muted uppercase tracking-wider px-5 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {pages.map((page) => (
              <tr key={page.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-3.5 font-medium text-admin-text max-w-[200px] truncate">
                  {page.title}
                </td>
                <td className="px-5 py-3.5 text-admin-muted font-mono text-xs">/{page.slug}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge published={page.isPublished} />
                </td>
                <td className="px-5 py-3.5 text-admin-muted text-xs whitespace-nowrap">
                  {page.updatedAt
                    ? new Date(page.updatedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/pages/${page.id}/edit`}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-admin-bg border border-admin-border
                                 text-admin-text hover:border-brand-500/50 transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleTogglePublish(page)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                                  ${page.isPublished
                                    ? 'bg-admin-bg border-admin-border text-admin-muted hover:border-amber-500/50 hover:text-amber-400'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
                    >
                      {page.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleDelete(page)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-admin-bg border border-admin-border
                                 text-red-400 hover:border-red-500/50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}