/**
 * PERFORMANCE: ISR (Incremental Static Regeneration)
 *
 * revalidate: 30 means:
 * - The page is statically rendered and cached at build time
 * - After 30 seconds, the next request triggers a background re-render
 * - Visitors always see a cached page (fast) — never wait for Firestore
 * - The cache is updated in the background without blocking users
 *
 * This reduces Firestore reads from N reads/minute to 1 read/30 seconds
 * regardless of how much traffic the page receives.
 */
export const revalidate = 30;

import { notFound }          from 'next/navigation';
import { cached, AppCache }  from '@/lib/cache';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }) {
  const page = await getPage(params.slug);
  if (!page) return { title: 'Page Not Found' };
  return {
    title:       page.title,
    description: page.metaDescription || '',
    openGraph: {
      title:       page.title,
      description: page.metaDescription || '',
      type:        'website',
    },
  };
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getPage(slug) {
  const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;

  if (mode === 'server') {
    const prisma = (await import('@/lib/prisma/client')).default;
    return prisma.page.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
    });
  }

  if (mode === 'firebase') {
    return cached(
      `page:${slug}`,
      async () => {
        const { db }              = await import('@/lib/firebase/config');
        const { collection, query, where, limit, getDocs, Timestamp } =
          await import('firebase/firestore');

        const q = query(
          collection(db, 'pages'),
          where('slug',        '==',   slug),
          where('isPublished', '==',   true),
          where('deletedAt',   '==',   null),
          limit(1), // Never fetch more than 1 — we only need the matching page
        );

        const snap = await getDocs(q);
        if (snap.empty) return null;

        const d    = snap.docs[0];
        const data = d.data();

        // Normalize Timestamps to ISO strings for serialization
        return {
          id:              d.id,
          title:           data.title           ?? '',
          slug:            data.slug            ?? '',
          metaDescription: data.metaDescription ?? '',
          isPublished:     data.isPublished      ?? false,
          sections:        data.sections         ?? [],
          createdAt:       data.createdAt instanceof Timestamp
                             ? data.createdAt.toDate().toISOString()
                             : data.createdAt ?? null,
          updatedAt:       data.updatedAt instanceof Timestamp
                             ? data.updatedAt.toDate().toISOString()
                             : data.updatedAt ?? null,
        };
      },
      AppCache.PUBLIC_PAGES_TTL, // 30 seconds
    );
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

import SectionRenderer from '@/components/public/SectionRenderer';

export default async function PublicPage({ params }) {
  const page = await getPage(params.slug);

  if (!page) notFound();

  return (
    <div>
      {(page.sections ?? []).map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </div>
  );
}