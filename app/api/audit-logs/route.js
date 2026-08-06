export const dynamic = 'force-dynamic';

import { NextResponse }   from 'next/server';
import {
  requireAuthOrRespond,
  enforceSameOrigin,
}                         from '@/lib/auth/middleware';

const MODE = process.env.NEXT_PUBLIC_BACKEND_MODE;

// ── GET — admin only ──────────────────────────────────────────────────────────

export async function GET(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  if (MODE === 'firebase') {
    // Firebase mode: read via Admin SDK so no security-rule restriction
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adminDb  = getAdminDb();
    const snapshot = await adminDb
      .collection('audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const logs = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id:         d.id,
        adminId:    data.adminId,
        adminName:  data.adminName ?? 'Admin',
        action:     data.action,
        collection: data.collection,
        documentId: data.documentId,
        timestamp:  data.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      };
    });

    return NextResponse.json(logs);
  }

  // Server mode: Prisma
  const { default: prisma } = await import('@/lib/prisma/client');
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take:    limit,
    include: { admin: { select: { name: true, email: true } } },
  });

  return NextResponse.json(
    logs.map((l) => ({
      id:         l.id,
      adminId:    l.adminId,
      adminName:  l.admin?.name  ?? 'System',
      adminEmail: l.admin?.email ?? '',
      action:     l.action,
      collection: l.collection,
      documentId: l.documentId,
      timestamp:  l.timestamp.toISOString(),
    })),
  );
}

// ── POST — XSS attempt logging (unauthenticated, action-restricted) ───────────
//
// This endpoint is intentionally open to unauthenticated callers because it is
// called from the public-facing renderer (CustomSection) where no admin session
// exists. It ONLY accepts action="xss_attempt_blocked" — any other action is
// rejected with 403 to prevent abuse.

export async function POST(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 }); }

  if (body.action !== 'xss_attempt_blocked') {
    return NextResponse.json(
      { message: 'Only xss_attempt_blocked may be logged without authentication.' },
      { status: 403 },
    );
  }

  const entry = {
    adminId:    'public-renderer',
    action:     'xss_attempt_blocked',
    collection: body.collection ?? 'pages',
    documentId: body.documentId ?? 'custom-section',
    before:     body.before ?? null,
    after:      null,
  };

  if (MODE === 'firebase') {
    // Use Admin SDK to bypass Firestore security rules — the public client
    // cannot write to audit_logs directly (and should not be able to).
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adminDb = getAdminDb();
    await adminDb.collection('audit_logs').add({
      ...entry,
      timestamp: new Date(),
    });
    return NextResponse.json({ ok: true });
  }

  // Server mode: Prisma
  const { default: prisma } = await import('@/lib/prisma/client');
  await prisma.auditLog.create({
    data: {
      ...entry,
      beforeJson: entry.before,
      afterJson:  null,
    },
  });

  return NextResponse.json({ ok: true });
}