import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type StorageDriver = "local" | "s3";

const AUDIO_DIR = process.env.AUDIO_DIR ?? "public/audio";
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? "local") as StorageDriver;

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Faltan variables S3_ENDPOINT, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY."
    );
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

function getBucket() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("Falta la variable S3_BUCKET.");
  return bucket;
}

function getPublicBaseUrl() {
  const baseUrl = process.env.S3_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "Falta S3_PUBLIC_BASE_URL. Configura un dominio publico para el bucket."
    );
  }
  return baseUrl.replace(/\/+$/, "");
}

function getKey(fileName: string) {
  const prefix = (process.env.S3_KEY_PREFIX ?? "audio").replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/${fileName}` : fileName;
}

export async function uploadAudioFile(localPath: string, fileName: string) {
  if (STORAGE_DRIVER !== "s3") {
    return `/${AUDIO_DIR.replace(/^public\//, "").replace(/\\/g, "/")}/${fileName}`;
  }

  const key = getKey(fileName);
  const body = await fs.readFile(localPath);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: "audio/mpeg",
    })
  );

  return `${getPublicBaseUrl()}/${key}`;
}

export async function deleteAudioObject(audioPath: string | null | undefined) {
  if (!audioPath) return;

  if (STORAGE_DRIVER !== "s3" && isRemoteUrl(audioPath)) return;

  if (STORAGE_DRIVER !== "s3" || !isRemoteUrl(audioPath)) {
    const rel = audioPath.replace(/^\//, "");
    const abs = path.join(process.cwd(), "public", rel);
    await fs.unlink(abs).catch(() => {});
    return;
  }

  const key = keyFromPublicUrl(audioPath);
  if (!key) return;

  await getS3Client()
    .send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }))
    .catch(() => {});
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function keyFromPublicUrl(value: string) {
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (publicBase && value.startsWith(`${publicBase}/`)) {
    return value.slice(publicBase.length + 1);
  }

  try {
    const url = new URL(value);
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}
