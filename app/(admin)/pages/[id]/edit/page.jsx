'use client';

import { useEffect, useState }  from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useContentStore }      from '@/store/contentStore';
import PageEditorForm           from './PageEditorForm';
import LoadingSpinner           from '@/components/shared/LoadingSpinner';

export default function EditPagePage() {
  const { id }   = useParams();
  const router   = useRouter();
  const { getPageById } = useContentStore();

  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getPageById(id)
      .then(setPage)
      .catch((err) => setError(err.message ?? 'Page not found.'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-16">
        <LoadingSpinner size="lg" label="Loading page…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-8 text-center">
          <p className="text-red-400 font-semibold">{error}</p>
          <button
            onClick={() => router.push('/pages')}
            className="mt-4 px-4 py-2 bg-admin-card border border-admin-border rounded-lg text-admin-muted text-sm"
          >
            Back to Pages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/pages')}
          className="text-admin-muted hover:text-admin-text transition-colors text-sm"
        >
          ← Pages
        </button>
        <span className="text-admin-muted">/</span>
        <h1 className="text-2xl font-bold text-admin-text">{page?.title ?? 'Edit Page'}</h1>
      </div>
      <PageEditorForm page={page} />
    </div>
  );
}