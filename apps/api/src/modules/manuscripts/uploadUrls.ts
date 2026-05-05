import type { AuthDependencies } from "../auth/requestAuth.js";
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

export function buildUploadUrlResponse(
  auth: AuthDependencies,
  documentId: string,
  uploadId: string,
  authorId: string,
) {
  const { expiresAt, token } = createLocalUploadToken(
    documentId,
    uploadId,
    authorId,
  );

  return {
    uploadId,
    documentId,
    uploadUrl: `${buildApiBaseUrl(auth)}/api/v1/uploads/local/${token}`,
    expiresAt,
  };
}

export function buildDownloadUrlResponse(
  auth: AuthDependencies,
  documentId: string,
  authorId: string,
  accessType: "author" | "admin",
) {
  const { expiresAt, token } = createLocalDownloadToken(
    documentId,
    authorId,
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
