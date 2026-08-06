export const dynamic = 'force-dynamic';

import { NextResponse }                                          from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload } from '@/lib/auth/middleware';

export async function GET(req, { params }) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const { default: prisma } = await import('@/lib/prisma/client');
  const page = await prisma.page.findFirst({
    where: { id: params.id, deletedAt: null },
  });

  if (!page) return NextResponse.json({ message: 'Page not found' }, { status: 404 });

  return NextResponse.json({
    ...page,
    sections:    page.sectionsJson,
    sectionsJson: undefined,
    createdAt:   page.createdAt.toISOString(),
    updatedAt:   page.updatedAt.toISOString(),
    deletedAt:   null,
  });
}

export async function PUT(req, { params }) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const payload = await getAuthPayload(req);

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 }); }

  const { default: prisma } = await import('@/lib/prisma/client');

  const current = await prisma.page.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!current) return NextResponse.json({ message: 'Page not found' }, { status: 404 });

  // Stale-write detection — caller passes the updatedAt it last saw
  if (body._loadedUpdatedAt) {
    const loadedAt = new Date(body._loadedUpdatedAt).getTime();
    if (current.updatedAt.getTime() !== loadedAt) {
      return NextResponse.json(
        { message: 'This page was modified by another user. Reload before saving.', stale: true },
        { status: 409 },
      );
    }
  }

  // Slug uniqueness — exclude the current page
  if (body.slug && body.slug !== current.slug) {
    const slugConflict = await prisma.page.findFirst({
      where: { slug: body.slug, deletedAt: null, NOT: { id: params.id } },
    });
    if (slugConflict) {
      return NextResponse.json({ message: `Slug "${body.slug}" is already in use.` }, { status: 409 });
    }
  }

  const { _loadedUpdatedAt, ...updateData } = body;

  const updated = await prisma.page.update({
    where: { id: params.id },
    data: {
      title:           updateData.title           ?? current.title,
      slug:            updateData.slug            ?? current.slug,
      metaDescription: updateData.metaDescription ?? current.metaDescription,
      sectionsJson:    updateData.sections        ?? current.sectionsJson,
      isPublished:     updateData.isPublished     ?? current.isPublished,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'update',
      collection: 'pages',
      documentId: params.id,
      beforeJson: { title: current.title, slug: current.slug, isPublished: current.isPublished },
      afterJson:  { title: updated.title,  slug: updated.slug,  isPublished: updated.isPublished },
    },
  });

  return NextResponse.json({
    ...updated,
    sections:    updated.sectionsJson,
    sectionsJson: undefined,
    createdAt:   updated.createdAt.toISOString(),
    updatedAt:   updated.updatedAt.toISOString(),
    deletedAt:   null,
  });
}

export async function DELETE(req, { params }) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const payload = await getAuthPayload(req);

  const { default: prisma } = await import('@/lib/prisma/client');

  const page = await prisma.page.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!page) return NextResponse.json({ message: 'Page not found' }, { status: 404 });

  await prisma.page.update({
    where: { id: params.id },
    data:  { deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'delete',
      collection: 'pages',
      documentId: params.id,
      beforeJson: { title: page.title, slug: page.slug },
      afterJson:  null,
    },
  });

  return NextResponse.json({ ok: true });
}