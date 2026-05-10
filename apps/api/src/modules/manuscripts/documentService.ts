import type { AdminTestState } from "../admin/testState.js";
import type { ApiConfig } from "../config/config.js";
import type { AuthorRequestContext } from "./access.js";
import { assertStoredUploadExists } from "./documentStorage.js";
import { createDocumentProcessingEnqueue } from "./documentProcessingQueue.js";
import { ManuscriptServiceError } from "./errors.js";
import {
  buildInitialDocumentIngestionJob,
  queueTestDocumentIngestionJob,
} from "./ingestionJobs.js";
import { mapDbDocument } from "./mappers.js";
import type { ManuscriptTestState } from "./testState.js";
import { completeTestDocumentUpload } from "./testState.js";

export async function completeAuthorDocumentUpload(
  context: AuthorRequestContext,
  input: {
    adminTestState: AdminTestState;
    authorId: string;
    config: ApiConfig;
    documentId: string;
    testState: ManuscriptTestState;
  },
) {
  if (context.mode === "test") {
    return completeTestUploadAndQueueReview(input);
  }

  const docRow = await getPendingSupabaseDocument(context, input);
  await assertStoredUploadExists({
    config: input.config,
    id: docRow.id,
    originalFileName: docRow.original_file_name,
    uploadId: docRow.upload_id,
  });

  const completion = await completeSupabaseDocumentUploadAndQueueJob(context, {
    ...input,
    documentId: docRow.id,
    fileSizeBytes: Number(docRow.file_size_bytes),
    mimeType: docRow.mime_type,
    originalFileName: docRow.original_file_name,
    uploadId: docRow.upload_id,
  });
  const enqueue = createDocumentProcessingEnqueue(input.config);
  if (enqueue) {
    await enqueue({ jobId: completion.jobId });
  }

  return mapDbDocument(completion.document);
}

async function completeTestUploadAndQueueReview(input: {
  adminTestState: AdminTestState;
  authorId: string;
  documentId: string;
  testState: ManuscriptTestState;
}) {
  await assertExistingTestUploadWasStored(input);

  const pendingDocument = input.testState.documents.find(
    (item) => item.id === input.documentId && item.authorId === input.authorId,
  );
  if (!pendingDocument) {
    throw new ManuscriptServiceError("not_found", "Document not found");
  }

  if (pendingDocument.storageStatus !== "pending_upload") {
    throw new ManuscriptServiceError(
      "conflict",
      "The upload is no longer pending completion",
    );
  }

  queueTestDocumentIngestionJob(input.adminTestState, {
    documentId: pendingDocument.id,
    fileSizeBytes: pendingDocument.fileSizeBytes,
    mimeType: pendingDocument.mimeType,
    originalFileName: pendingDocument.originalFileName,
    uploadId: pendingDocument.uploadId,
    updatedAt: pendingDocument.updatedAt,
  });

  const document = completeTestDocumentUpload(
    input.testState,
    input.documentId,
    input.authorId,
  );
  if (!document) {
    throw new ManuscriptServiceError("not_found", "Document not found");
  }

  return document;
}

async function assertExistingTestUploadWasStored(input: {
  authorId: string;
  documentId: string;
  testState: ManuscriptTestState;
}): Promise<void> {
  const document = input.testState.documents.find(
    (item) => item.id === input.documentId && item.authorId === input.authorId,
  );
  if (!document) {
    throw new ManuscriptServiceError("not_found", "Document not found");
  }

  await assertStoredUploadExists({
    config: {
      appConfigMode: "local",
      authMode: "test",
      documentProcessingProvider: "local",
      documentScannerMode: "local_fake",
      emailProviderMode: "local_fake",
      host: "0.0.0.0",
      logLevel: "silent",
      paytrProviderMode: "disabled",
      paytrTokenUrl: "https://www.paytr.com/odeme/api/get-token",
      port: 4000,
      sentryEnvironment: "local",
      sentryTracesSampleRate: 0,
      storageProvider: "local",
      webAppUrl: "http://localhost:5173",
    },
    id: document.id,
    originalFileName: document.originalFileName,
    uploadId: document.uploadId,
  });
}

async function getPendingSupabaseDocument(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: { authorId: string; documentId: string },
) {
  const { data, error } = await context.db
    .from("documents")
    .select()
    .eq("id", input.documentId)
    .eq("author_id", input.authorId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ManuscriptServiceError(
        "not_found",
        "Document not found",
        error,
      );
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to load document before upload completion",
      error,
    );
  }

  if (data.storage_status !== "pending_upload") {
    throw new ManuscriptServiceError(
      "conflict",
      "The upload is no longer pending completion",
    );
  }

  return data;
}

async function completeSupabaseDocumentUploadAndQueueJob(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: {
    authorId: string;
    documentId: string;
    fileSizeBytes: number;
    mimeType: string;
    originalFileName: string;
    uploadId: string;
  },
) {
  const ingestionJob = buildInitialDocumentIngestionJob(input);
  const { data, error } = await context.serviceDb.rpc(
    "complete_document_upload",
    {
      p_actor_user_id: input.authorId,
      p_document_id: input.documentId,
      p_ingestion_idempotency_key: ingestionJob.idempotencyKey,
      p_ingestion_metadata: ingestionJob.metadata,
    },
  );

  if (error) {
    if (error.code === "P0002" || error.code === "P0003") {
      throw new ManuscriptServiceError(
        "conflict",
        "The upload is no longer pending completion",
        error,
      );
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to complete document upload",
      error,
    );
  }

  const jobId = await getDocumentProcessingJobId(context, {
    documentId: input.documentId,
    idempotencyKey: ingestionJob.idempotencyKey,
  });

  return { document: data, jobId };
}

async function getDocumentProcessingJobId(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: { documentId: string; idempotencyKey: string },
): Promise<string> {
  const { data, error } = await context.serviceDb
    .from("document_processing_jobs")
    .select("id")
    .eq("document_id", input.documentId)
    .eq("idempotency_key", input.idempotencyKey)
    .single();

  if (error || !data) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to resolve queued document processing job",
      error,
    );
  }

  return data.id;
}
