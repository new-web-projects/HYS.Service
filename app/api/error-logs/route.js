/**
 * app/api/error-logs/route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/error-logs  — create a log entry (no auth required; rate-limited at
 *                         app layer in errorLogger.js)
 * GET  /api/error-logs  — list logs (admin only)
 *
 * Firebase mode does not use this route — it writes directly to Firestore.
 */

import { NextResponse }   from 'next/server';
import { getAuthPayload } from '@/lib/auth/middleware';
import prisma              from '@/lib/prisma/client';
// BUG FIX: this used to be imported as `prismaClient` and called as
// `prismaClient()` below — but the default export of lib/prisma/client.js
// is an already-constructed PrismaClient *instance*, not a factory
// function, so every call here threw "prismaClient is not a function".
// Importing it directly as `prisma` (matching every other route in this
// app, e.g. /api/settings, /api/pages) fixes that.

// ─── POST — create a log entry ────────────────────────────────────────────────

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    await prisma.errorLog.create({
      data: {
        errorType:  String(body.errorType  || 'Error'),
        message:    String(body.message    || ''),
        stackTrace: String(body.stackTrace || ''),
        fileName:   String(body.fileName   || 'unknown'),
        route:      String(body.route      || '/'),
        userId:     String(body.userId     || 'anonymous'),
        role:       String(body.role       || 'unknown'),
        browser:    String(body.browser    || 'unknown'),
        device:     String(body.device     || 'unknown'),
        source:     String(body.source     || 'unknown'),
        errorCode:  String(body.errorCode  || ''),
        viewport:   String(body.viewport   || '?'),
        fn:         String(body.fn         || 'unknown'),
        line:       String(body.line       || '?'),
        timestamp:  body.timestamp ? new Date(body.timestamp) : new Date(),
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // Silently accept — logging must never cause errors itself
    console.error('[/api/error-logs POST]', err.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── GET — list logs (admin only) ─────────────────────────────────────────────

export async function GET(request) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const errorType = searchParams.get('errorType') || null;
    const route     = searchParams.get('route')     || null;
    const limit     = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset    = parseInt(searchParams.get('offset') || '0', 10);

    const where = {};
    if (errorType) where.errorType = errorType;
    if (route)     where.route     = { contains: route };

    const [logs, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      prisma.errorLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (err) {
    console.error('[/api/error-logs GET]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── DELETE — clear old logs (admin only) ─────────────────────────────────────

export async function DELETE(request) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { olderThanDays = 30 } = await request.json().catch(() => ({}));
    const cutoff = new Date(Date.now() - olderThanDays * 86400 * 1000);

    const deleted = await prisma.errorLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    return NextResponse.json({ deleted: deleted.count });
  } catch (err) {
    console.error('[/api/error-logs DELETE]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}