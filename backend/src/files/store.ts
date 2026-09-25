import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "../config/env.js";

export interface ObjectStore {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Railway bucket first, then generic S3_* names. Missing credentials stay on local disk. */
export function objectStore(): ObjectStore | null {
  const settings = env();
  const bucket = settings.RAILWAY_BUCKET || settings.S3_BUCKET;
  const accessKeyId = settings.RAILWAY_ACCESS_KEY_ID || settings.S3_ACCESS_KEY_ID;
  const secretAccessKey = settings.RAILWAY_SECRET_ACCESS_KEY || settings.S3_SECRET_ACCESS_KEY;
  const endpoint = settings.RAILWAY_ENDPOINT || settings.S3_ENDPOINT;
  const region = settings.RAILWAY_REGION || settings.S3_REGION || "auto";
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return { bucket, endpoint, region, accessKeyId, secretAccessKey };
}

export function s3Enabled(): boolean {
  return objectStore() != null;
}

export function fileRoot(): string {
  return path.resolve(env().FILE_ROOT || "uploads");
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const store = objectStore();
  if (store) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = s3Client(store, S3Client);
    await client.send(
      new PutObjectCommand({
        Bucket: store.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const full = path.join(fileRoot(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

export async function signedGetUrl(key: string, expiresIn = 3600): Promise<string | null> {
  const store = objectStore();
  if (!store) return null;
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = s3Client(store, S3Client);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: store.bucket, Key: key }), { expiresIn });
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  const store = objectStore();
  if (store) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = s3Client(store, S3Client);
    const result = await client.send(new GetObjectCommand({ Bucket: store.bucket, Key: key }));
    const bytes = await streamToBuffer(result.Body as Readable | undefined);
    return { body: bytes, contentType: result.ContentType || guessType(key) };
  }
  const body = await readFile(path.join(fileRoot(), key));
  return { body, contentType: guessType(key) };
}

function s3Client(
  store: ObjectStore,
  S3Client: typeof import("@aws-sdk/client-s3").S3Client,
) {
  return new S3Client({
    region: store.region || "auto",
    endpoint: store.endpoint || undefined,
    forcePathStyle: Boolean(store.endpoint),
    credentials: {
      accessKeyId: store.accessKeyId,
      secretAccessKey: store.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

async function streamToBuffer(body: Readable | undefined): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function guessType(key: string): string {
  if (key.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
