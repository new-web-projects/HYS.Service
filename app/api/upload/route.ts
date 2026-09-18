/** File Path: app/api/upload/route.ts */

import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { uploadFile, deleteFile, ALLOWED_IMAGE_TYPES, ALLOWED_DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";

const DOCUMENT_TYPES = ["AADHAAR", "PAN", "WORK_ID"];

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const { allowed } = await rateLimit(`upload:${user.id}`, 20, 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });

  const file = form.get("file");
  const purpose = form.get("purpose");
  if (!(file instanceof File) || typeof purpose !== "string") {
    return NextResponse.json({ error: "Missing file or purpose." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large (5MB max)." }, { status: 400 });
  }

  if (purpose === "profile_photo") {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Profile photos must be JPEG, PNG, or WebP." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await uploadFile(buffer, file.type, `profile-photos/${user.role.toLowerCase()}`, `${user.id}.${file.type.split("/")[1]}`);

    const previous = await prisma.media.findFirst({ where: { uploadedById: user.id, purpose: "profile_photo" } });

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { image: stored.url } }),
      prisma.media.create({
        data: {
          url: stored.url,
          provider: stored.provider,
          publicId: stored.publicId,
          mimeType: file.type,
          sizeBytes: stored.sizeBytes,
          uploadedById: user.id,
          purpose: "profile_photo",
        },
      }),
    ]);

    if (previous) {
      await deleteFile(previous.provider, previous.publicId ?? "").catch((err) => console.error("Failed to clean up old profile photo", err));
      await prisma.media.delete({ where: { id: previous.id } }).catch(() => {});
    }

    return NextResponse.json({ url: stored.url });
  }

  if (purpose === "worker_document") {
    if (user.role !== "WORKER") {
      return NextResponse.json({ error: "Only workers can upload verification documents." }, { status: 403 });
    }
    const documentType = form.get("documentType");
    if (typeof documentType !== "string" || !DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: "A valid document type is required." }, { status: 400 });
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Documents must be JPEG, PNG, WebP, or PDF." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await uploadFile(buffer, file.type, "worker-documents", `${user.id}-${documentType}.${file.type.split("/")[1] ?? "bin"}`);

    const previous = await prisma.media.findFirst({ where: { uploadedById: user.id, purpose: "worker_document" } });

    await prisma.$transaction([
      prisma.workerProfile.update({
        where: { userId: user.id },
        data: {
          documentType: documentType as "AADHAAR" | "PAN" | "WORK_ID",
          documentUrl: stored.url,
          documentVerifiedAt: null, // a new upload always needs re-review
        },
      }),
      prisma.media.create({
        data: {
          url: stored.url,
          provider: stored.provider,
          publicId: stored.publicId,
          mimeType: file.type,
          sizeBytes: stored.sizeBytes,
          uploadedById: user.id,
          purpose: "worker_document",
        },
      }),
    ]);

    if (previous) {
      await deleteFile(previous.provider, previous.publicId ?? "").catch((err) => console.error("Failed to clean up old document", err));
      await prisma.media.delete({ where: { id: previous.id } }).catch(() => {});
    }

    return NextResponse.json({ url: stored.url, documentType });
  }

  return NextResponse.json({ error: "Unknown upload purpose." }, { status: 400 });
}