import type { DocumentProcessingFailureCode } from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiConfig } from "../config/config.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { createDocumentProcessingAdminException } from "./processingOutcomes.js";
import { createAiServiceDocumentProcessingDispatch } from "./documentProcessingClient.js";
import { mapDbDocument } from "./mappers.js";
import {
  dispatchDocumentProcessingJobSafely,
  isRecord,
  normalizeFailureCode,
  sanitizeWorkerMetadata,
  type DocumentProcessingDispatch,
  type DocumentProcessingRunResult,
} from "./documentProcessingTypes.js";

type QueuedDocumentProcessingJob = {
  id: string;
  documentId: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  metadata: Record<string, unknown>;
};

export async function processQueuedSupabaseDocumentProcessingJobs(input: {
  config: ApiConfig;
  dispatch?: DocumentProcessingDispatch;
  limit?: number;
}): Promise<DocumentProcessingRunResult[]> {
  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db
    .from("document_processing_jobs")
    .select()
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(input.limit ?? 10);

  if (error) throw error;

  const dispatch =
    input.dispatch ?? createAiServiceDocumentProcessingDispatch(input.config);
  const results: DocumentProcessingRunResult[] = [];
  for (const row of data ?? []) {
    results.push(
      await processSupabaseDocumentProcessingJob({
        db,
        dispatch,
        jobId: row.id,
      }),
    );
  }
  return results;
}

export async function processSupabaseDocumentProcessingJob(input: {
  db: SupabaseClient;
  dispatch: DocumentProcessingDispatch;
  jobId: string;
}): Promise<DocumentProcessingRunResult> {
  const job = await getSupabaseJob(input.db, input.jobId);
  if (!job)
    return { jobId: input.jobId, status: "skipped", reason: "not_found" };
  if (job.status !== "queued") {
    return { jobId: input.jobId, status: "skipped", reason: "not_queued" };
  }

  const claimed = await claimSupabaseJob(input.db, job);
  if (!claimed) {
    return { jobId: input.jobId, status: "skipped", reason: "not_queued" };
  }
  await markSupabaseDocumentProcessing(input.db, job.documentId);

  const result = await dispatchDocumentProcessingJobSafely(
    input.dispatch,
    job.id,
  );
  if (result.status === "succeeded") {
    await markSupabaseJobSucceeded(input.db, job.id, result.metadata);
    await markSupabaseDocumentProcessed(input.db, job.documentId);
    return { jobId: input.jobId, status: "succeeded", failureCode: null };
  }

  const failureCode = normalizeFailureCode(result.failure_code);
  const metadata = sanitizeWorkerMetadata(result.metadata);
  await markSupabaseJobFailed(input.db, job.id, failureCode, metadata);
  const document = await markSupabaseDocumentFailed(
    input.db,
    job.documentId,
    failureCode,
  );
  if (document) {
    await createDocumentProcessingAdminException(
      { mode: "supabase", db: input.db, serviceDb: input.db },
      {
        attemptCount: claimed.attemptCount,
        authorId: document.authorId,
        documentId: document.id,
        failureCode,
        jobId: job.id,
        maxAttempts: job.maxAttempts,
        metadata,
        mimeType: document.mimeType,
      },
    );
  }

  return { jobId: input.jobId, status: "failed", failureCode };
}

async function getSupabaseJob(
  db: SupabaseClient,
  jobId: string,
): Promise<QueuedDocumentProcessingJob | null> {
  const { data, error } = await db
    .from("document_processing_jobs")
    .select()
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    documentId: data.document_id,
    status: data.status,
    attemptCount: Number(data.attempt_count ?? 0),
    maxAttempts: Number(data.max_attempts ?? 3),
    metadata: isRecord(data.metadata) ? data.metadata : {},
  };
}

async function claimSupabaseJob(
  db: SupabaseClient,
  job: QueuedDocumentProcessingJob,
): Promise<{ attemptCount: number } | null> {
  const nextAttemptCount = job.attemptCount + 1;
  const { data, error } = await db
    .from("document_processing_jobs")
    .update({
      status: "running",
      attempt_count: nextAttemptCount,
      started_at: new Date().toISOString(),
      error_message: null,
      metadata: {
        ...job.metadata,
        failure_code: null,
        failure_category: null,
      },
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (error) throw error;
  return data ? { attemptCount: Number(data.attempt_count) } : null;
}

async function markSupabaseJobSucceeded(
  db: SupabaseClient,
  jobId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await db
    .from("document_processing_jobs")
    .update({
      status: "succeeded",
      error_message: null,
      completed_at: new Date().toISOString(),
      metadata: sanitizeWorkerMetadata(metadata),
    })
    .eq("id", jobId)
    .eq("status", "running");
  if (error) throw error;
}

async function markSupabaseJobFailed(
  db: SupabaseClient,
  jobId: string,
  failureCode: DocumentProcessingFailureCode,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await db
    .from("document_processing_jobs")
    .update({
      status: "failed",
      error_message: "Document processing failed",
      completed_at: new Date().toISOString(),
      metadata: { ...metadata, failure_code: failureCode },
    })
    .eq("id", jobId)
    .eq("status", "running");
  if (error) throw error;
}

async function markSupabaseDocumentProcessing(
  db: SupabaseClient,
  documentId: string,
): Promise<void> {
  const { error } = await db
    .from("documents")
    .update({
      processing_status: "processing",
      processing_failure_code: null,
    })
    .eq("id", documentId);
  if (error) throw error;
}

async function markSupabaseDocumentProcessed(
  db: SupabaseClient,
  documentId: string,
): Promise<void> {
  const { error } = await db
    .from("documents")
    .update({
      processing_status: "succeeded",
      processing_failure_code: null,
      eligibility_status: "eligible",
      review_outcome: "auto_approved",
    })
    .eq("id", documentId);
  if (error) throw error;
}

async function markSupabaseDocumentFailed(
  db: SupabaseClient,
  documentId: string,
  failureCode: DocumentProcessingFailureCode,
): Promise<ReturnType<typeof mapDbDocument> | null> {
  const { data, error } = await db
    .from("documents")
    .update({
      processing_status: "failed",
      processing_failure_code: failureCode,
      eligibility_status: "limited",
      review_outcome: "needs_review",
    })
    .eq("id", documentId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data ? mapDbDocument(data) : null;
}
