import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), "local-uploads");

type LocalStoredDocument = {
  documentId: string;
  fileName: string;
  uploadId: string;
};

function sanitizeFileName(fileName: string): string {
  return path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getDocumentDir(documentId: string): string {
  return path.join(LOCAL_UPLOAD_ROOT, documentId);
}

function getStoredPath(input: LocalStoredDocument): string {
  const safeFileName = sanitizeFileName(input.fileName) || "upload.bin";
  return path.join(
    getDocumentDir(input.documentId),
    `${input.uploadId}-${safeFileName}`,
  );
}

export async function saveLocalUpload(
  input: LocalStoredDocument & {
    bytes: Buffer;
  },
): Promise<string> {
  const dir = getDocumentDir(input.documentId);
  await mkdir(dir, { recursive: true });
  const filePath = getStoredPath(input);
  await writeFile(filePath, input.bytes);
  return filePath;
}

export async function hasLocalUpload(
  input: LocalStoredDocument,
): Promise<boolean> {
  try {
    const fileInfo = await stat(getStoredPath(input));
    return fileInfo.isFile();
  } catch {
    return false;
  }
}

export async function readLocalUpload(
  input: LocalStoredDocument,
): Promise<Buffer | null> {
  try {
    return await readFile(getStoredPath(input));
  } catch {
    return null;
  }
}
