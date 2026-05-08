import type { AuthDependencies } from "../auth/requestAuth.js";
import {
  createGcsSignedDownloadUrl,
  createGcsSignedUploadUrl,
} from "../storage/gcsStorage.js";
import {
  createLocalDownloadToken,
  createLocalUploadToken,
} from "../storage/localTokens.js";

export const SUPPORTED_SAMPLE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/epub+zip",
  "text/plain",
] as const;

export async function buildUploadUrlResponse(
  auth: AuthDependencies,
  input: {
    authorId: string;
    documentId: string;
    fileName: string;
    mimeType: string;
    uploadId: string;
  },
) {
  if (auth.config.storageProvider === "gcs") {
    const signed = await createGcsSignedUploadUrl(auth.config, {
      contentType: input.mimeType,
      documentId: input.documentId,
      fileName: input.fileName,
      uploadId: input.uploadId,
    });
    return {
      uploadId: input.uploadId,
      documentId: input.documentId,
      uploadUrl: signed.uploadUrl,
      expiresAt: signed.expiresAt,
    };
  }

  const { expiresAt, token } = createLocalUploadToken(
    input.documentId,
    input.uploadId,
    input.authorId,
  );

  return {
    uploadId: input.uploadId,
    documentId: input.documentId,
    uploadUrl: `${buildApiBaseUrl(auth)}/api/v1/uploads/local/${token}`,
    expiresAt,
  };
}

export async function buildDownloadUrlResponse(
  auth: AuthDependencies,
  input: {
    authorId: string;
    documentId: string;
    fileName: string;
    mimeType: string;
    uploadId: string;
  },
  accessType: "author" | "admin" | "accepted_intro",
) {
  if (auth.config.storageProvider === "gcs") {
    return createGcsSignedDownloadUrl(auth.config, {
      contentType: input.mimeType,
      documentId: input.documentId,
      fileName: input.fileName,
      uploadId: input.uploadId,
    });
  }

  const { expiresAt, token } = createLocalDownloadToken(
    input.documentId,
    input.authorId,
    accessType,
  );

  return {
    downloadUrl: `${buildApiBaseUrl(auth)}/api/v1/documents/local-download/${token}`,
    expiresAt,
  };
}

function buildApiBaseUrl(auth: AuthDependencies): string {
  return auth.config.authMode === "test"
    ? auth.config.webAppUrl.replace(":5173", ":4000")
    : `http://${auth.config.host}:${String(auth.config.port ?? 4000)}`;
}
