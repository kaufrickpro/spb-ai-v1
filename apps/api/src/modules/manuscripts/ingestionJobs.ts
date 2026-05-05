import { createHash, randomUUID } from "node:crypto";
import { AdminJobRunSchema } from "@marketplace/contracts";
import type { AdminTestState } from "../admin/testState.js";
import type { AuthorRequestContext } from "./access.js";
import { ManuscriptServiceError } from "./errors.js";

const INGESTION_VERSION = "ingestion-v1";
const CHUNKER_VERSION = "paragraph-v1";
const EMBEDDING_MODEL = "local-reference-v1";
const INITIAL_INGESTION_METADATA = {
  ingestion_version: INGESTION_VERSION,
  chunker: CHUNKER_VERSION,
  embedding_model: EMBEDDING_MODEL,
  scanner: "local-none",
  scanner_result: "not_scanned",
  failure_code: null,
  failure_category: null,
} as const;

export function buildDocumentIngestionIdempotencyKey(input: {
  documentId: string;
  fileSizeBytes: number;
  mimeType: string;
  originalFileName: string;
  uploadId: string;
}): string {
  const storageIdentity = createHash("sha256")
    .update(
      [
        input.documentId,
        input.uploadId,
        input.originalFileName,
        input.mimeType,
        input.fileSizeBytes.toString(),
      ].join(":"),
    )
    .digest("hex")
    .slice(0, 24);

  return [
    `document:${input.documentId}`,
    `storage:${storageIdentity}`,
    `ingestion:${INGESTION_VERSION}`,
    `embedding:${EMBEDDING_MODEL}`,
  ].join(":");
}

export function buildInitialDocumentIngestionJob(input: {
  documentId: string;
  fileSizeBytes: number;
  mimeType: string;
  originalFileName: string;
  uploadId: string;
}): {
  idempotencyKey: string;
  metadata: Record<string, unknown>;
} {
  return {
    idempotencyKey: buildDocumentIngestionIdempotencyKey(input),
    metadata: { ...INITIAL_INGESTION_METADATA },
  };
}

export function queueTestDocumentIngestionJob(
  adminTestState: AdminTestState,
  input: {
    documentId: string;
    fileSizeBytes: number;
    mimeType: string;
    originalFileName: string;
    uploadId: string;
    updatedAt: string;
  },
): void {
  if (adminTestState.failIngestionJobDocumentIds?.has(input.documentId)) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to queue document ingestion",
    );
  }

  const { idempotencyKey } = buildInitialDocumentIngestionJob(input);
  const existing = adminTestState.jobRuns.find(
    (job) =>
      job.jobType === "document_ingestion" && job.source === idempotencyKey,
  );

  if (existing) {
    return;
  }

  adminTestState.jobRuns.unshift(
    AdminJobRunSchema.parse({
      id: randomUUID(),
      jobType: "document_ingestion",
      status: "queued",
      source: idempotencyKey,
      errorMessage: null,
      failureCode: null,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
    }),
  );
}

export async function queueSupabaseDocumentIngestionJob(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: {
    documentId: string;
    fileSizeBytes: number;
    mimeType: string;
    originalFileName: string;
    uploadId: string;
  },
): Promise<void> {
  const { idempotencyKey, metadata } = buildInitialDocumentIngestionJob(input);
  const { error } = await context.serviceDb
    .from("document_processing_jobs")
    .upsert(
      {
        document_id: input.documentId,
        status: "queued",
        attempt_count: 0,
        max_attempts: 3,
        idempotency_key: idempotencyKey,
        error_message: null,
        metadata,
      },
      { onConflict: "document_id,idempotency_key" },
    );

  if (error) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to queue document ingestion",
      error,
    );
  }
}
