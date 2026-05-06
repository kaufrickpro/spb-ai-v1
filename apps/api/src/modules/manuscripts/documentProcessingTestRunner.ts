import {
  AdminJobRunSchema,
  DocumentSchema,
  type AdminJobRun,
  type Document,
} from "@marketplace/contracts";
import type { AdminTestState } from "../admin/testState.js";
import type { ManuscriptTestState } from "./testState.js";
import { createTestDocumentProcessingAdminException } from "./processingOutcomes.js";
import {
  dispatchDocumentProcessingJobSafely,
  normalizeFailureCode,
  parseDocumentIdFromIdempotencySource,
  sanitizeWorkerMetadata,
  type DocumentProcessingDispatch,
  type DocumentProcessingRunResult,
} from "./documentProcessingTypes.js";

export async function processQueuedTestDocumentProcessingJobs(input: {
  adminTestState: AdminTestState;
  dispatch: DocumentProcessingDispatch;
  limit?: number;
  manuscriptTestState: ManuscriptTestState;
}): Promise<DocumentProcessingRunResult[]> {
  const queuedJobs = input.adminTestState.jobRuns
    .filter(
      (job) => job.jobType === "document_ingestion" && job.status === "queued",
    )
    .slice(0, input.limit ?? 10);

  const results: DocumentProcessingRunResult[] = [];
  for (const job of queuedJobs) {
    results.push(
      await processTestDocumentProcessingJob({ ...input, jobId: job.id }),
    );
  }
  return results;
}

export async function processTestDocumentProcessingJob(input: {
  adminTestState: AdminTestState;
  dispatch: DocumentProcessingDispatch;
  jobId: string;
  manuscriptTestState: ManuscriptTestState;
}): Promise<DocumentProcessingRunResult> {
  const jobIndex = input.adminTestState.jobRuns.findIndex(
    (job) => job.id === input.jobId && job.jobType === "document_ingestion",
  );
  if (jobIndex < 0) {
    return { jobId: input.jobId, status: "skipped", reason: "not_found" };
  }

  const job = input.adminTestState.jobRuns[jobIndex];
  if (!job || job.status !== "queued") {
    return { jobId: input.jobId, status: "skipped", reason: "not_queued" };
  }

  const documentId = parseDocumentIdFromIdempotencySource(job.source);
  const document = input.manuscriptTestState.documents.find(
    (item) => item.id === documentId,
  );
  if (!document) {
    updateTestJob(input.adminTestState, jobIndex, {
      status: "failed",
      failureCode: "unexpected_processing_error",
      errorMessage: "Document processing failed",
    });
    return {
      jobId: input.jobId,
      status: "failed",
      failureCode: "unexpected_processing_error",
    };
  }

  updateTestJob(input.adminTestState, jobIndex, {
    status: "running",
    attemptCount: (job.attemptCount ?? 0) + 1,
  });
  updateTestDocument(input.manuscriptTestState, document.id, {
    processingStatus: "processing",
    processingFailureCode: null,
  });

  const result = await dispatchDocumentProcessingJobSafely(
    input.dispatch,
    job.id,
  );
  const metadata = sanitizeWorkerMetadata(result.metadata);

  if (result.status === "succeeded") {
    updateTestJob(input.adminTestState, jobIndex, {
      status: "succeeded",
      errorMessage: null,
      failureCode: null,
    });
    updateTestDocument(input.manuscriptTestState, document.id, {
      processingStatus: "succeeded",
      processingFailureCode: null,
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
    });
    return { jobId: input.jobId, status: "succeeded", failureCode: null };
  }

  const failureCode = normalizeFailureCode(result.failure_code);
  const updatedJob = updateTestJob(input.adminTestState, jobIndex, {
    status: "failed",
    failureCode,
    errorMessage: "Document processing failed",
  });
  const updatedDocument = updateTestDocument(
    input.manuscriptTestState,
    document.id,
    {
      processingStatus: "failed",
      processingFailureCode: failureCode,
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
    },
  );

  createTestDocumentProcessingAdminException(input.adminTestState, {
    attemptCount: updatedJob.attemptCount ?? 1,
    authorId: updatedDocument.authorId,
    documentId: updatedDocument.id,
    failureCode,
    jobId: updatedJob.id,
    maxAttempts: updatedJob.maxAttempts ?? 3,
    metadata,
    mimeType: updatedDocument.mimeType,
    now: updatedJob.updatedAt,
  });

  return { jobId: input.jobId, status: "failed", failureCode };
}

function updateTestJob(
  state: AdminTestState,
  index: number,
  patch: Partial<AdminJobRun>,
): AdminJobRun {
  const updated = AdminJobRunSchema.parse({
    ...state.jobRuns[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  state.jobRuns[index] = updated;
  return updated;
}

function updateTestDocument(
  state: ManuscriptTestState,
  documentId: string,
  patch: Partial<Document>,
): Document {
  const index = state.documents.findIndex(
    (document) => document.id === documentId,
  );
  if (index < 0) {
    throw new Error(`Document ${documentId} not found in test state`);
  }
  const updated = DocumentSchema.parse({
    ...state.documents[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  state.documents[index] = updated;
  return updated;
}
