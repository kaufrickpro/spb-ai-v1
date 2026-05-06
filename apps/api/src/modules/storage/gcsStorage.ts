import { Storage } from "@google-cloud/storage";
import type { ApiConfig } from "../config/config.js";
import { buildDocumentObjectName } from "./documentObjects.js";

type StoredDocumentObjectInput = {
  documentId: string;
  fileName: string;
  uploadId: string;
};

export type GcsSignedUrlInput = StoredDocumentObjectInput & {
  contentType?: string;
  expiresInSeconds?: number;
};

export type GcsStorageClient = Pick<Storage, "bucket">;

const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

export function buildGcsObjectName(input: StoredDocumentObjectInput): string {
  return buildDocumentObjectName(input);
}

export async function createGcsSignedUploadUrl(
  config: Pick<ApiConfig, "gcsBucketPrivateUploads">,
  input: GcsSignedUrlInput,
  storage: GcsStorageClient = new Storage(),
): Promise<{ expiresAt: string; uploadUrl: string }> {
  const expiresAt = buildSignedUrlExpiry(input.expiresInSeconds);
  const [uploadUrl] = await storage
    .bucket(config.gcsBucketPrivateUploads!)
    .file(buildGcsObjectName(input))
    .getSignedUrl({
      action: "write",
      contentType: input.contentType,
      expires: expiresAt,
      version: "v4",
    });

  return { expiresAt: expiresAt.toISOString(), uploadUrl };
}

export async function createGcsSignedDownloadUrl(
  config: Pick<ApiConfig, "gcsBucketPrivateUploads">,
  input: GcsSignedUrlInput,
  storage: GcsStorageClient = new Storage(),
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const expiresAt = buildSignedUrlExpiry(input.expiresInSeconds);
  const [downloadUrl] = await storage
    .bucket(config.gcsBucketPrivateUploads!)
    .file(buildGcsObjectName(input))
    .getSignedUrl({
      action: "read",
      expires: expiresAt,
      version: "v4",
    });

  return { downloadUrl, expiresAt: expiresAt.toISOString() };
}

export async function hasGcsUpload(
  config: Pick<ApiConfig, "gcsBucketPrivateUploads">,
  input: StoredDocumentObjectInput,
  storage: GcsStorageClient = new Storage(),
): Promise<boolean> {
  const [exists] = await storage
    .bucket(config.gcsBucketPrivateUploads!)
    .file(buildGcsObjectName(input))
    .exists();

  return exists;
}

function buildSignedUrlExpiry(expiresInSeconds?: number): Date {
  return new Date(
    Date.now() + (expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS) * 1000,
  );
}
