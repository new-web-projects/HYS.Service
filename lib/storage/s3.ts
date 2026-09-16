import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Amazon S3 is the active storage provider but AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY aren't all set.");
  }
  client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return client;
}

export type UploadResult = { url: string; publicId: string; sizeBytes: number };

export async function uploadToS3(fileBuffer: Buffer, folder: string, filename: string, mimeType: string): Promise<UploadResult> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set.");
  const region = process.env.AWS_REGION;
  const key = `${folder}/${filename}`;

  await getClient().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: fileBuffer, ContentType: mimeType }),
  );

  return { url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`, publicId: key, sizeBytes: fileBuffer.byteLength };
}

export async function deleteFromS3(key: string): Promise<void> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set.");
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}