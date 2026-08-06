export const dynamic = 'force-dynamic';

import { NextResponse }                                              from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload }   from '@/lib/auth/middleware';

const MODE = process.env.NEXT_PUBLIC_BACKEND_MODE;

export async function PUT(req, { params }) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  if (MODE === 'firebase') {
    return NextResponse.json({ message: 'Use Firebase adapter for firebase mode.' }, { status: 501 });
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 }); }

  const { default: prisma } = await import('@/lib/prisma/client');

  const category = await prisma.category.findUnique({ where: { id: params.id } });
  if (!category) return NextResponse.json({ message: 'Category not found.' }, { status: 404 });

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: {
      name:        body.name        ?? category.name,
      description: body.description ?? category.description,
      icon:        body.icon        ?? category.icon,
      status:      body.status      ?? category.status,
    },
  });

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(req, { params }) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  if (MODE === 'firebase') {
    return NextResponse.json({ message: 'Use Firebase adapter for firebase mode.' }, { status: 501 });
  }

  const { default: prisma } = await import('@/lib/prisma/client');

  const category = await prisma.category.findUnique({ where: { id: params.id } });
  if (!category) return NextResponse.json({ message: 'Category not found.' }, { status: 404 });

  await prisma.category.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}