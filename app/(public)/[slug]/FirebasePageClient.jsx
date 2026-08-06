'use client';

import { useEffect, useState }        from 'react';
import { db }                         from '@/lib/firebase/config';
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
}                                     from 'firebase/firestore';
import SectionRenderer                from '@/components/public/SectionRenderer';

// ─── Coming Soon ──────────────────────────────────────────────────────────────

function ComingSoonPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-6"
          style={{ backgroundColor: 'var(--color-brand, #3B82F6)' }}
        >
          🚀
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Coming Soon</h1>
        <p className="text-gray-500 text-lg leading-relaxed">
          We're working on something great. Check back soon!
        </p>
      </div>
    </div>
  );
}

// ─── Not Found ────────────────────────────────────────────────────────────────

function NotFoundInline() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <p className="text-8xl font-black text-gray-200 mb-4">404</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-8">
          The page you're looking for doesn't exist or hasn't been published yet.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 rounded-xl text-white font-semibold btn-brand"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

/**
 * Subscribes to the Firestore page document in real-time.
 * When an admin saves changes, this component re-renders instantly
 * without the visitor needing to refresh.
 */
export default function FirebasePageClient({ slug }) {
  const [page,    setPage]    = useState(undefined); // undefined = loading
  const [noPages, setNoPages] = useState(false);

  useEffect(() => {
    // Subscribe to the matching published page by slug
    const q = query(
      collection(db, 'pages'),
      where('slug',        '==', slug),
      where('isPublished', '==', true),
      where('deletedAt',   '==', null),
      limit(1),
    );

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        if (snapshot.empty) {
          // No published page for this slug.
          // Check if ANY published page exists to decide: Coming Soon vs 404.
          const anyQ  = query(
            collection(db, 'pages'),
            where('isPublished', '==', true),
            where('deletedAt',   '==', null),
            limit(1),
          );

          // One-time check (not subscribed — we only need this once per miss)
          const { getDocs } = await import('firebase/firestore');
          const anySnap = await getDocs(anyQ);
          setNoPages(anySnap.empty);
          setPage(null);
        } else {
          const doc  = snapshot.docs[0];
          const data = doc.data();
          setPage({ id: doc.id, ...data, sections: data.sections ?? [] });
          setNoPages(false);
        }
      },
      (err) => {
        console.error('[FirebasePageClient] onSnapshot error:', err.message);
        setPage(null);
      },
    );

    return () => unsub();
  }, [slug]);

  // Loading state
  if (page === undefined) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No published pages at all → Coming Soon
  if (page === null && noPages) return <ComingSoonPage />;

  // Slug not found but other pages exist → 404
  if (page === null) return <NotFoundInline />;

  return (
    <article>
      <SectionRenderer sections={page.sections} />
    </article>
  );
}