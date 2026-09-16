import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is the active storage provider but CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET aren't all set.",
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  configured = true;
}

export type UploadResult = { url: string; publicId: string; sizeBytes: number };

/**
 * Signed server-side upload — deliberately not the unsigned-preset
 * pattern V1 used (Part 1 audit flagged that as a real gap: anyone who
 * discovered the preset name could upload directly to the account,
 * bypassing this app's auth/validation entirely). Every upload here goes
 * through this authenticated route, so a signed upload is both simpler
 * to configure (no preset needed) and closes that gap by construction.
 */
export async function uploadToCloudinary(fileBuffer: Buffer, folder: string, filename: string): Promise<UploadResult> {
  ensureConfigured();
  const targetFolder = process.env.CLOUDINARY_FOLDER ? `${process.env.CLOUDINARY_FOLDER}/${folder}` : folder;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: targetFolder, public_id: filename, resource_type: "auto", overwrite: false },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload returned no result."));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id, sizeBytes: result.bytes });
      },
    );
    stream.end(fileBuffer);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId);
}