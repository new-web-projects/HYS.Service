/**
 * app/api/error-reports/route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/error-reports  — create a new error report (server mode)
 * GET  /api/error-reports  — list reports (admin only, server mode)
 *
 * Firebase mode does not use this route — it writes directly to Firestore
 * from the client via lib/errorReporter.js.
 */

import { NextResponse }     from 'next/server';
import { getAuthPayload }   from '@/lib/auth/middleware';
import prisma                from '@/lib/prisma/client';
// BUG FIX: this used to be imported as `prismaClient` and called as
// `prismaClient()` below — but the default export of lib/prisma/client.js
// is an already-constructed PrismaClient *instance*, not a factory
// function, so every call here threw "prismaClient is not a function".
// Importing it directly as `prisma` (matching every other route in this
// app, e.g. /api/settings, /api/pages) fixes that.

// ─── POST — create a report ───────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();

    // Basic validation — must have a message
    if (!body?.message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Optionally read the authenticated user for server mode
    let userId = body.userId || 'anonymous';
    let role   = body.role   || 'unknown';
    try {
      const payload = await getAuthPayload(request);
      if (payload?.sub)  userId = payload.sub;
      if (payload?.role) role   = payload.role;
    } catch { /* unauthenticated — use values from body */ }

    // Persist via Prisma (MySQL / server mode)
    const report = await prisma.errorReport.create({
      data: {
        message:         String(body.message        || ''),
        type:            String(body.type           || 'Error'),
        code:            String(body.code           || ''),
        stack:           String(body.stack          || ''),
        file:            String(body.file           || 'unknown'),
        line:            String(body.line           || '?'),
        fn:              String(body.fn             || 'unknown'),
        componentStack:  String(body.componentStack || ''),
        source:          String(body.source         || 'unknown'),
        route:           String(body.route          || '/'),
        browser:         String(body.browser        || 'unknown'),
        device:          String(body.device         || 'unknown'),
        screen:          String(body.screen         || '?'),
        viewport:        String(body.viewport       || '?'),
        userId,
        role,
        errorOccurredAt: body.errorOccurredAt
          ? new Date(body.errorOccurredAt)
          : new Date(),
        status:          'new',
        notes:           '',
      },
    });

    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch (err) {
    console.error('[/api/error-reports POST]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── GET — list reports (admin only) ─────────────────────────────────────────

export async function GET(request) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status  = searchParams.get('status')  || null;
    const route   = searchParams.get('route')   || null;
    const limit   = Math.min(parseInt(searchParams.get('limit')  || '50', 10), 200);
    const offset  = parseInt(searchParams.get('offset') || '0', 10);

    const where = {};
    if (status) where.status = status;
    if (route)  where.route  = { contains: route };

    const [reports, total] = await Promise.all([
      prisma.errorReport.findMany({
        where,
        orderBy: { reportedAt: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      prisma.errorReport.count({ where }),
    ]);

    return NextResponse.json({ reports, total, limit, offset });
  } catch (err) {
    console.error('[/api/error-reports GET]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH — update status / notes (admin only) ──────────────────────────────

export async function PATCH(request) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, status, notes, assignee } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updated = await prisma.errorReport.update({
      where: { id },
      data:  {
        ...(status   !== undefined && { status }),
        ...(notes    !== undefined && { notes }),
        ...(assignee !== undefined && { assignee }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[/api/error-reports PATCH]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}