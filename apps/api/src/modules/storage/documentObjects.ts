import path from "node:path";

export function sanitizeDocumentObjectFileName(fileName: string): string {
  return path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function buildDocumentObjectName(input: {
  documentId: string;
  fileName: string;
  uploadId: string;
}): string {
  const safeFileName =
    sanitizeDocumentObjectFileName(input.fileName) || "upload.bin";
  return `${input.documentId}/${input.uploadId}-${safeFileName}`;
}
