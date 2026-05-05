import { z } from "zod";
import {
  EligibilityStatusSchema,
  IsoDateTimeSchema,
  ReviewOutcomeSchema,
  UuidSchema,
} from "./common.js";

// ─── Allowed MIME types (Step 8 local scope) ─────────────────────────────────

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/epub+zip",
  "text/plain",
] as const;

export const AllowedMimeTypeSchema = z.enum(ALLOWED_MIME_TYPES);

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// ─── Status schemas ───────────────────────────────────────────────────────────

export const DocumentStorageStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "attached",
  "pending_delete",
  "deleted",
]);

export const DocumentProcessingStatusSchema = z.enum([
  "not_started",
  "queued",
  "processing",
  "succeeded",
  "failed",
]);

export const DocumentProcessingFailureCodeSchema = z.enum([
  "empty_extracted_text",
  "unsupported_file_type",
  "file_type_mismatch",
  "extracted_text_too_large",
  "chunk_limit_exceeded",
  "download_failed",
  "parser_failed",
  "embedding_failed",
  "scanner_suspicious",
  "unexpected_processing_error",
]);

export const DocumentAdminReviewStatusSchema = z.enum([
  "not_submitted",
  "pending",
  "approved",
  "rejected",
]);

// ─── Core document schema ─────────────────────────────────────────────────────

export const DocumentSchema = z.object({
  id: UuidSchema,
  manuscriptId: UuidSchema,
  authorId: UuidSchema,
  originalFileName: z.string().trim().min(1).max(255),
  mimeType: AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().nonnegative(),
  storageStatus: DocumentStorageStatusSchema,
  processingStatus: DocumentProcessingStatusSchema,
  processingFailureCode:
    DocumentProcessingFailureCodeSchema.nullable().default(null),
  adminReviewStatus: DocumentAdminReviewStatusSchema,
  eligibilityStatus: EligibilityStatusSchema.default("limited"),
  reviewOutcome: ReviewOutcomeSchema.default("needs_review"),
  uploadId: z.string().trim().min(1).max(120),
  retentionExpiresAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

// ─── Upload URL request/response ──────────────────────────────────────────────

export const UploadSignedUrlRequestSchema = z.object({
  manuscriptId: UuidSchema,
  fileName: z.string().trim().min(1).max(255),
  mimeType: AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export const UploadSignedUrlResponseSchema = z.object({
  uploadId: z.string().trim().min(1),
  documentId: UuidSchema,
  uploadUrl: z.string().url(),
  expiresAt: IsoDateTimeSchema,
});

// ─── Complete upload ──────────────────────────────────────────────────────────

export const CompleteUploadResponseSchema = z.object({
  document: DocumentSchema,
});

// ─── Download URL ─────────────────────────────────────────────────────────────

export const DocumentDownloadUrlResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: IsoDateTimeSchema,
});

// ─── Document response ────────────────────────────────────────────────────────

export const DocumentResponseSchema = z.object({
  document: DocumentSchema,
});

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type AllowedMimeType = z.infer<typeof AllowedMimeTypeSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentStorageStatus = z.infer<typeof DocumentStorageStatusSchema>;
export type DocumentProcessingStatus = z.infer<
  typeof DocumentProcessingStatusSchema
>;
export type DocumentProcessingFailureCode = z.infer<
  typeof DocumentProcessingFailureCodeSchema
>;
export type DocumentAdminReviewStatus = z.infer<
  typeof DocumentAdminReviewStatusSchema
>;
export type UploadSignedUrlRequest = z.infer<
  typeof UploadSignedUrlRequestSchema
>;
export type UploadSignedUrlResponse = z.infer<
  typeof UploadSignedUrlResponseSchema
>;
export type CompleteUploadResponse = z.infer<
  typeof CompleteUploadResponseSchema
>;
export type DocumentDownloadUrlResponse = z.infer<
  typeof DocumentDownloadUrlResponseSchema
>;
export type DocumentResponse = z.infer<typeof DocumentResponseSchema>;
