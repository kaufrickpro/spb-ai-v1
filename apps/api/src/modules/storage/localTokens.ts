import { randomBytes } from "node:crypto";
import { createHash } from "node:crypto";

/**
 * A short-lived, opaque token for local fake signed URLs.
 *
 * The token encodes: documentId + uploadId + expiry timestamp.
 * We sign with a simple HMAC-SHA256 using the server's secret.
 *
 * Layout: `base64(documentId|uploadId|expiresAt|hmac)` where fields
 * are joined with "|".
 */

const LOCAL_UPLOAD_TTL_SECONDS = 60 * 15; // 15 minutes
const LOCAL_DOWNLOAD_TTL_SECONDS = 60 * 5; // 5 minutes
const SEPARATOR = "~";

function makeSecret(): string {
  // Stable within a process lifecycle — good enough for local dev.
  return process.env["LOCAL_UPLOAD_SECRET"] ?? "local-dev-secret";
}

function sign(payload: string): string {
  return createHash("sha256")
    .update(makeSecret() + ":" + payload)
    .digest("hex")
    .slice(0, 32);
}

function encode(parts: string[]): string {
  const joined = parts.join(SEPARATOR);
  const sig = sign(joined);
  return Buffer.from(joined + SEPARATOR + sig).toString("base64url");
}

function decode(token: string): string[] | null {
  try {
    const joined = Buffer.from(token, "base64url").toString("utf8");
    const parts = joined.split(SEPARATOR);
    if (parts.length < 2) return null;
    const sig = parts.pop()!;
    const payload = parts.join(SEPARATOR);
    if (sign(payload) !== sig) return null;
    return parts;
  } catch {
    return null;
  }
}

export type LocalUploadToken = {
  documentId: string;
  uploadId: string;
  authorId: string;
  expiresAt: string;
};

export type LocalDownloadToken = {
  accessType: "author" | "admin";
  documentId: string;
  authorId: string;
  expiresAt: string;
};

// ─── Upload token ─────────────────────────────────────────────────────────────

export function createLocalUploadToken(
  documentId: string,
  uploadId: string,
  authorId: string,
): { token: string; expiresAt: string } {
  const expiresAt = new Date(
    Date.now() + LOCAL_UPLOAD_TTL_SECONDS * 1000,
  ).toISOString();
  const token = encode(["upload", documentId, uploadId, authorId, expiresAt]);
  return { token, expiresAt };
}

export function verifyLocalUploadToken(token: string): LocalUploadToken | null {
  const parts = decode(token);
  if (!parts || parts[0] !== "upload" || parts.length !== 5) return null;
  const [, documentId, uploadId, authorId, expiresAt] = parts;
  if (new Date(expiresAt) < new Date()) return null;
  return { documentId, uploadId, authorId, expiresAt };
}

// ─── Download token ───────────────────────────────────────────────────────────

export function createLocalDownloadToken(
  documentId: string,
  authorId: string,
  accessType: "author" | "admin" = "author",
): { token: string; expiresAt: string } {
  const expiresAt = new Date(
    Date.now() + LOCAL_DOWNLOAD_TTL_SECONDS * 1000,
  ).toISOString();
  const token = encode([
    "download",
    documentId,
    authorId,
    accessType,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export function verifyLocalDownloadToken(
  token: string,
): LocalDownloadToken | null {
  const parts = decode(token);
  if (!parts || parts[0] !== "download" || parts.length !== 5) return null;
  const [, documentId, authorId, accessType, expiresAt] = parts;
  if (new Date(expiresAt) < new Date()) return null;
  if (accessType !== "author" && accessType !== "admin") return null;
  return { documentId, authorId, accessType, expiresAt };
}

// ─── Opaque upload ID ─────────────────────────────────────────────────────────

export function generateUploadId(): string {
  return randomBytes(16).toString("hex");
}
