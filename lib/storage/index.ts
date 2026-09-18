/** File Path: lib/storage/index.ts */

import { getSettings } from "@/lib/settings";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/storage/cloudinary";
import { uploadToS3, deleteFromS3 } from "@/lib/storage/s3";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export type StoredFile = { url: string; provider: "CLOUDINARY" | "S3"; publicId: string; sizeBytes: number };

/**
 * Reads Settings.storageProvider fresh on every call (admin can flip this
 * at any time with no redeploy) and uploads through whichever backend is
 * currently active — this is the one place that decision gets made,
 * matching the master prompt's "selected provider must be used for new
 * uploads" requirement precisely. Old files already stored under the
 * other provider are untouched and keep working (their Media row already
 * records which provider serves them) — switching providers is
 * forward-only, never a migration of existing files.
 */
export async function uploadFile(
  fileBuffer: Buffer,
  mimeType: string,
  folder: string,
  filenameHint: string,
): Promise<StoredFile> {
  const settings = await getSettings();
  const filename = `${Date.now()}-${filenameHint.replace(/[^a-zA-Z0-9._-]/g, "-")}`;

  if (settings.storageProvider === "S3") {
    const result = await uploadToS3(fileBuffer, folder, filename, mimeType);
    return { ...result, provider: "S3" };
  }
  const result = await uploadToCloudinary(fileBuffer, folder, filename);
  return { ...result, provider: "CLOUDINARY" };
}

/** Deletes from whichever provider the file actually lives on — always
 * the Media row's own recorded provider, never the currently-active one,
 * since those can differ after a provider switch. */
export async function deleteFile(provider: "CLOUDINARY" | "S3", publicId: string): Promise<void> {
  if (provider === "S3") {
    await deleteFromS3(publicId);
  } else {
    await deleteFromCloudinary(publicId);
  }
}