export const dynamic = 'force-dynamic';

import { NextResponse }                                              from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload }   from '@/lib/auth/middleware';

function normalizePage(p) {
  return {
    ...p,
    sections:    p.sectionsJson,
    sectionsJson: undefined,
    createdAt:   p.createdAt.toISOString(),
    updatedAt:   p.updatedAt.toISOString(),
    deletedAt:   p.deletedAt?.toISOString() ?? null,
  };
}

export async function GET(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const trash = searchParams.get('trash') === 'true';

  const { default: prisma } = await import('@/lib/prisma/client');

  if (trash) {
    // Return soft-deleted pages — only those deleted within the last 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pages  = await prisma.page.findMany({
      where:   { deletedAt: { not: null, gte: cutoff } },
      orderBy: { deletedAt: 'desc' },
    });
    return NextResponse.json(pages.map(normalizePage));
  }

  const pages = await prisma.page.findMany({
    where:   { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(pages.map(normalizePage));
}

export async function POST(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const payload = await getAuthPayload(req);

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 }); }

  const { title, slug, metaDescription, sections, isPublished } = body;

  if (!title || !slug) {
    return NextResponse.json({ message: 'title and slug are required.' }, { status: 422 });
  }

  const { default: prisma } = await import('@/lib/prisma/client');

  const existing = await prisma.page.findFirst({ where: { slug, deletedAt: null } });
  if (existing) {
    return NextResponse.json({ message: `Slug "${slug}" is already in use.` }, { status: 409 });
  }

  const page = await prisma.page.create({
    data: {
      title,
      slug,
      metaDescription:  metaDescription ?? '',
      sectionsJson:     sections ?? [],
      isPublished:      isPublished ?? false,
      deletedAt:        null,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'create',
      collection: 'pages',
      documentId: page.id,
      beforeJson: null,
      afterJson:  { title, slug, isPublished },
    },
  });

  return NextResponse.json(normalizePage(page), { status: 201 });
}