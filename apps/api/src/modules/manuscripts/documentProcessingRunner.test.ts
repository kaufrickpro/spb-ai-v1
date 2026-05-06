import { describe, expect, it } from "vitest";
import { AdminJobRunSchema } from "@marketplace/contracts";
import { createAdminTestState } from "../admin/testState.js";
import {
  processQueuedTestDocumentProcessingJobs,
  processTestDocumentProcessingJob,
  type AiIngestionResult,
} from "./documentProcessingRunner.js";
import {
  createManuscriptTestState,
  createTestDocument,
  TEST_AUTHOR_MANUSCRIPT_ID,
} from "./testState.js";
import { TEST_USER_ID } from "../auth/requestAuth.js";

const DOCUMENT_ID = "20000000-0000-4000-8000-000000000001";
const JOB_ID = "20000000-0000-4000-8000-000000000002";

describe("document processing runner", () => {
  it("picks up a queued job and dispatches only the durable job id", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createReadyDocumentState();
    adminTestState.jobRuns.unshift(createJob({ status: "queued" }));
    const dispatchedJobIds: string[] = [];

    const results = await processQueuedTestDocumentProcessingJobs({
      adminTestState,
      manuscriptTestState,
      dispatch: async ({ jobId }) => {
        dispatchedJobIds.push(jobId);
        return succeededResult();
      },
    });

    expect(results).toEqual([
      { jobId: JOB_ID, status: "succeeded", failureCode: null },
    ]);
    expect(dispatchedJobIds).toEqual([JOB_ID]);
    expect(adminTestState.jobRuns[0]).toMatchObject({
      id: JOB_ID,
      status: "succeeded",
      attemptCount: 1,
      errorMessage: null,
      failureCode: null,
    });
    expect(manuscriptTestState.documents[0]).toMatchObject({
      id: DOCUMENT_ID,
      processingStatus: "succeeded",
      processingFailureCode: null,
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
    });
  });

  it("skips already-running jobs without dispatching them", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createReadyDocumentState();
    adminTestState.jobRuns.unshift(createJob({ status: "running" }));
    let dispatchCount = 0;

    const result = await processTestDocumentProcessingJob({
      adminTestState,
      manuscriptTestState,
      jobId: JOB_ID,
      dispatch: async () => {
        dispatchCount += 1;
        return succeededResult();
      },
    });

    expect(result).toEqual({
      jobId: JOB_ID,
      status: "skipped",
      reason: "not_queued",
    });
    expect(dispatchCount).toBe(0);
    expect(adminTestState.jobRuns[0]?.status).toBe("running");
  });

  it("skips already-succeeded jobs without dispatching them", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createReadyDocumentState();
    adminTestState.jobRuns.unshift(createJob({ status: "succeeded" }));
    let dispatchCount = 0;

    const result = await processTestDocumentProcessingJob({
      adminTestState,
      manuscriptTestState,
      jobId: JOB_ID,
      dispatch: async () => {
        dispatchCount += 1;
        return succeededResult();
      },
    });

    expect(result).toEqual({
      jobId: JOB_ID,
      status: "skipped",
      reason: "not_queued",
    });
    expect(dispatchCount).toBe(0);
    expect(adminTestState.jobRuns[0]?.status).toBe("succeeded");
  });

  it("stores a safe failed outcome without leaking worker private fields", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createReadyDocumentState();
    adminTestState.jobRuns.unshift(createJob({ status: "queued" }));

    const result = await processTestDocumentProcessingJob({
      adminTestState,
      manuscriptTestState,
      jobId: JOB_ID,
      dispatch: async () => ({
        status: "failed",
        failure_code: "empty_extracted_text",
        metadata: {
          failure_code: "empty_extracted_text",
          failure_category: "user_correctable",
          signed_url: "https://storage.example/private-token",
          storage_path: "/private/uploads/sample.txt",
          manuscript_text: "do not store me",
        },
      }),
    });

    expect(result).toEqual({
      jobId: JOB_ID,
      status: "failed",
      failureCode: "empty_extracted_text",
    });
    expect(adminTestState.jobRuns[0]).toMatchObject({
      status: "failed",
      attemptCount: 1,
      errorMessage: "Document processing failed",
      failureCode: "empty_extracted_text",
    });
    expect(manuscriptTestState.documents[0]).toMatchObject({
      processingStatus: "failed",
      processingFailureCode: "empty_extracted_text",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
    });
    expect(
      adminTestState.reviews.some(
        (review) =>
          review.entityId === DOCUMENT_ID && review.source === "document_processing",
      ),
    ).toBe(false);
  });

  it("converts thrown worker failures into stable safe failed outcomes", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createReadyDocumentState();
    adminTestState.jobRuns.unshift(createJob({ status: "queued" }));

    const result = await processTestDocumentProcessingJob({
      adminTestState,
      manuscriptTestState,
      jobId: JOB_ID,
      dispatch: async () => {
        throw new Error("private storage path /tmp/sample.txt");
      },
    });

    expect(result).toEqual({
      jobId: JOB_ID,
      status: "failed",
      failureCode: "unexpected_processing_error",
    });
    expect(adminTestState.jobRuns[0]).toMatchObject({
      status: "failed",
      failureCode: "unexpected_processing_error",
      errorMessage: "Document processing failed",
    });
    expect(manuscriptTestState.documents[0]).toMatchObject({
      processingStatus: "failed",
      processingFailureCode: "unexpected_processing_error",
    });
  });
});

function createReadyDocumentState() {
  const manuscriptTestState = createManuscriptTestState();
  createTestDocument(
    manuscriptTestState,
    DOCUMENT_ID,
    "upload-1",
    TEST_AUTHOR_MANUSCRIPT_ID,
    TEST_USER_ID,
    "sample.txt",
    "text/plain",
    128,
  );
  manuscriptTestState.documents[0] = {
    ...manuscriptTestState.documents[0]!,
    storageStatus: "uploaded",
    processingStatus: "queued",
  };
  return manuscriptTestState;
}

function createJob(input: { status: "queued" | "running" | "succeeded" }) {
  const now = new Date("2026-05-06T09:00:00.000Z").toISOString();
  return AdminJobRunSchema.parse({
    id: JOB_ID,
    jobType: "document_ingestion",
    status: input.status,
    source: `document:${DOCUMENT_ID}:storage:abc:ingestion:ingestion-v1`,
    errorMessage: null,
    failureCode: null,
    attemptCount: input.status === "queued" ? 0 : 1,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now,
  });
}

function succeededResult(): AiIngestionResult {
  return {
    status: "succeeded",
    category: "succeeded",
    failure_code: null,
    extracted_character_count: 32,
    chunk_count: 1,
    metadata: {
      ingestion_version: "ingestion-v1",
      chunker: "paragraph-v1",
      embedding_model: "local-reference-v1",
      extracted_character_count: 32,
      chunk_count: 1,
    },
  };
}
