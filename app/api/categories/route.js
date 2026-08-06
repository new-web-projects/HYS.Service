export const dynamic = 'force-dynamic';

import { NextResponse }                                              from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload }   from '@/lib/auth/middleware';

const MODE = process.env.NEXT_PUBLIC_BACKEND_MODE;

export async function GET(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  // Categories are readable by authenticated admins only via API
  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  if (MODE === 'firebase') {
    // Firebase adapter handles this via getAll('categories')
    return NextResponse.json({ message: 'Use Firebase adapter directly for firebase mode.' }, { status: 501 });
  }

  const { default: prisma } = await import('@/lib/prisma/client');
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    categories.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  );
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

  const { name, description, icon, status } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ message: 'Category name must be at least 2 characters.' }, { status: 422 });
  }

  if (MODE === 'firebase') {
    return NextResponse.json({ message: 'Use Firebase adapter directly for firebase mode.' }, { status: 501 });
  }

  const { default: prisma } = await import('@/lib/prisma/client');

  // Check for duplicate name
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' } },
  });
  if (existing) {
    return NextResponse.json({ message: `Category "${name}" already exists.` }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: {
      name:        name.trim(),
      description: description ?? '',
      icon:        icon ?? '🔧',
      status:      status ?? 'active',
      submittedBy: body.submittedBy ?? payload.uid,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'create',
      collection: 'categories',
      documentId: category.id,
      beforeJson: null,
      afterJson:  { name, status },
    },
  });

  return NextResponse.json({
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }, { status: 201 });
}