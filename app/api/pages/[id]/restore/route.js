export const dynamic = 'force-dynamic';

import { NextResponse }                                              from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload }   from '@/lib/auth/middleware';

export async function PATCH(req, { params }) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const payload = await getAuthPayload(req);

  const { default: prisma } = await import('@/lib/prisma/client');

  const page = await prisma.page.findFirst({
    where: { id: params.id, deletedAt: { not: null } },
  });

  if (!page) {
    return NextResponse.json({ message: 'Page not found in trash.' }, { status: 404 });
  }

  // Enforce 30-day recovery window
  const deletedAt   = new Date(page.deletedAt);
  const cutoff      = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (deletedAt < cutoff) {
    return NextResponse.json(
      { message: 'This page was deleted more than 30 days ago and cannot be recovered.' },
      { status: 410 }, // 410 Gone
    );
  }

  // Check slug isn't now taken by an active page
  const slugConflict = await prisma.page.findFirst({
    where: { slug: page.slug, deletedAt: null },
  });
  if (slugConflict) {
    return NextResponse.json(
      {
        message: `Cannot restore: slug "${page.slug}" is now in use by another active page. ` +
                 `Edit the slug before restoring.`,
      },
      { status: 409 },
    );
  }

  const restored = await prisma.page.update({
    where: { id: params.id },
    data:  { deletedAt: null, isPublished: false }, // Restore as draft
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'restore',
      collection: 'pages',
      documentId: params.id,
      beforeJson: { deletedAt: page.deletedAt.toISOString() },
      afterJson:  { deletedAt: null, isPublished: false },
    },
  });

  return NextResponse.json({
    ...restored,
    sections:    restored.sectionsJson,
    sectionsJson: undefined,
    createdAt:   restored.createdAt.toISOString(),
    updatedAt:   restored.updatedAt.toISOString(),
    deletedAt:   null,
  });
}