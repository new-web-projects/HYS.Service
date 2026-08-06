export const dynamic = 'force-dynamic';

import { NextResponse }                                              from 'next/server';
import { requireAuthOrRespond, enforceSameOrigin, getAuthPayload }   from '@/lib/auth/middleware';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES }                   from '@/lib/validators/schemas';

const MODE = process.env.NEXT_PUBLIC_BACKEND_MODE;

// ─── Firebase token verification (firebase mode only) ─────────────────────────

/**
 * Verifies a Firebase ID token using the Admin SDK.
 * Returns the decoded token or null.
 * @param {Request} req
 */
async function verifyFirebaseToken(req) {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    const { getAdminAuth } = await import('@/lib/firebase/admin');
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// ─── Cloudinary server-side deletion ──────────────────────────────────────────

async function deleteFromCloudinary(url) {
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    console.warn('[media DELETE] CLOUDINARY_API_KEY/SECRET not set — skipping Cloudinary removal.');
    return;
  }

  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
  if (!match) { console.warn('[media DELETE] Could not parse public_id from URL:', url); return; }

  const publicId  = match[1];
  const timestamp = Math.floor(Date.now() / 1000);
  const { createHash } = await import('crypto');
  const signature = createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const form = new URLSearchParams({
    public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature,
  });

  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body: form.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  ).catch((err) => console.warn('[media DELETE] Cloudinary destroy failed:', err.message));
}

// ─── GET — list media ─────────────────────────────────────────────────────────

export async function GET(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const { default: prisma } = await import('@/lib/prisma/client');
  const media = await prisma.media.findMany({
    where:   { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(
    media.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      deletedAt: m.deletedAt?.toISOString() ?? null,
    })),
  );
}

// ─── POST — upload file or create media record ────────────────────────────────

export async function POST(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  const guard = await requireAuthOrRespond(req);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const action           = searchParams.get('action');

  // ── File upload (server mode) ───────────────────────────────────────────────
  if (action === 'upload') {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ message: 'Expected multipart/form-data.' }, { status: 400 });
    }

    let formData;
    try { formData = await req.formData(); }
    catch { return NextResponse.json({ message: 'Failed to parse form data.' }, { status: 400 }); }

    const file = formData.get('file');
    if (!file) return NextResponse.json({ message: 'No file field in form data.' }, { status: 422 });

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ message: `File type "${file.type}" is not allowed.` }, { status: 422 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ message: 'File exceeds the 5 MB limit.' }, { status: 422 });
    }

    const buffer   = Buffer.from(await file.arrayBuffer());
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    let processedBuffer = buffer;
    let outputFilename;
    let outputMimeType  = file.type;

    if (file.type.startsWith('image/')) {
      const { default: sharp } = await import('sharp');
      processedBuffer = await sharp(buffer)
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      outputMimeType = 'image/webp';
      outputFilename = `${Date.now()}-${baseName}.webp`;
    } else {
      outputFilename = `${Date.now()}-${file.name}`;
    }

    const path      = await import('path');
    const fs        = (await import('fs')).promises;
    const uploadDir = path.default.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.default.join(uploadDir, outputFilename), processedBuffer);

    return NextResponse.json({
      url:       `/uploads/${outputFilename}`,
      filename:  outputFilename,
      mimeType:  outputMimeType,
      sizeBytes: processedBuffer.length,
    });
  }

  // ── Create media DB record ──────────────────────────────────────────────────
  const payload = await getAuthPayload(req);

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 }); }

  const { url, filename, mimeType, sizeBytes } = body;
  if (!url || !filename || !mimeType || sizeBytes == null) {
    return NextResponse.json({ message: 'url, filename, mimeType, and sizeBytes are required.' }, { status: 422 });
  }

  const { default: prisma } = await import('@/lib/prisma/client');
  const media = await prisma.media.create({
    data: { filename, url, mimeType, sizeBytes, uploadedBy: payload.uid, deletedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      adminId:    payload.uid,
      action:     'create',
      collection: 'media',
      documentId: media.id,
      beforeJson: null,
      afterJson:  { url, filename, mimeType, sizeBytes },
    },
  });

  return NextResponse.json({
    ...media,
    createdAt: media.createdAt.toISOString(),
    deletedAt: null,
  }, { status: 201 });
}

// ─── DELETE — remove file ─────────────────────────────────────────────────────

export async function DELETE(req) {
  const corsErr = enforceSameOrigin(req);
  if (corsErr) return corsErr;

  // ── Auth: server mode uses JWT; firebase mode verifies ID token ────────────
  if (MODE === 'server') {
    const guard = await requireAuthOrRespond(req);
    if (guard) return guard;
  } else if (MODE === 'firebase') {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }
    // Verify the token holder has an admin document
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adminDoc = await getAdminDb().collection('admins').doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ message: 'Forbidden — not an admin.' }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const deleteUrl        = searchParams.get('deleteUrl');

  if (!deleteUrl) {
    return NextResponse.json({ message: 'deleteUrl query param is required.' }, { status: 422 });
  }

  if (MODE === 'firebase') {
    await deleteFromCloudinary(deleteUrl);
    return NextResponse.json({ ok: true });
  }

  // Server mode: delete local file
  try {
    const path    = await import('path');
    const fs      = (await import('fs')).promises;
    const fileUrl = new URL(deleteUrl, process.env.NEXT_PUBLIC_APP_URL);
    const relPath = fileUrl.pathname;
    const absPath = path.default.join(process.cwd(), 'public', relPath);
    await fs.unlink(absPath);
  } catch (err) {
    console.warn('[media DELETE] File removal failed (non-fatal):', err.message);
  }

  return NextResponse.json({ ok: true });
}