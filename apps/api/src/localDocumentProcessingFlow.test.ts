import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import { createAdminTestState } from "./modules/admin/testState.js";
import { createManuscriptTestState } from "./modules/manuscripts/testState.js";
import { processQueuedTestDocumentProcessingJobs } from "./modules/manuscripts/documentProcessingRunner.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  documentProcessingProvider: "local" as const,
  documentScannerMode: "local_fake" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  storageProvider: "local" as const,
  webAppUrl: "http://localhost:5173",
};

function localPathFromUrl(url: string): string {
  return url.replace("http://localhost:4000", "");
}

describe("local Step 9 document processing flow", () => {
  it("validates author upload through queued processing and ready document query state", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createManuscriptTestState();
    const app = buildApp({
      config: testConfig,
      testState: {
        admin: adminTestState,
        manuscripts: manuscriptTestState,
      },
    });
    const fileBytes = Buffer.from("First paragraph.\n\nSecond paragraph.");

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/manuscripts",
      headers: { authorization: "Bearer test-user" },
      payload: {
        title: "Local Flow Check",
        genre: "Roman",
        language: "tr",
        wordCount: 42000,
        synopsis: "A local smoke-test manuscript.",
        targetAgeMin: 16,
        targetAgeMax: null,
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const manuscriptId = createResponse.json().manuscript.id as string;

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId,
        fileName: "local-flow.txt",
        mimeType: "text/plain",
        fileSizeBytes: fileBytes.length,
      },
    });
    expect(signedUrlResponse.statusCode).toBe(201);
    const { documentId, uploadUrl } = signedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };

    const uploadResponse = await app.inject({
      method: "PUT",
      url: localPathFromUrl(uploadUrl),
      headers: { "content-type": "text/plain" },
      payload: fileBytes,
    });
    expect(uploadResponse.statusCode).toBe(200);

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().document.processingStatus).toBe("queued");

    const queuedJobs = adminTestState.jobRuns.filter(
      (job) => job.jobType === "document_ingestion" && job.status === "queued",
    );
    expect(queuedJobs).toHaveLength(1);
    const queuedJob = queuedJobs[0];
    expect(queuedJob).toBeDefined();

    const results = await processQueuedTestDocumentProcessingJobs({
      adminTestState,
      manuscriptTestState,
      dispatch: async ({ jobId }) => {
        expect(jobId).toBe(queuedJob?.id);
        return {
          status: "succeeded",
          category: "succeeded",
          failure_code: null,
          extracted_character_count: fileBytes.toString("utf8").length,
          chunk_count: 1,
          metadata: {
            chunk_count: 1,
            chunker: "paragraph-v1",
            embedding_model: "local-reference-v1",
            extracted_character_count: fileBytes.toString("utf8").length,
            ingestion_version: "ingestion-v1",
            scanner_result: "not_scanned",
            vector_index_name: "local-reference-index",
          },
        };
      },
    });
    expect(results).toEqual([
      { jobId: queuedJob?.id, status: "succeeded", failureCode: null },
    ]);

    const documentResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(documentResponse.statusCode).toBe(200);
    expect(documentResponse.json().document).toMatchObject({
      id: documentId,
      processingStatus: "succeeded",
      processingFailureCode: null,
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
    });
  });

  it("validates user-correctable local processing failure without admin exception", async () => {
    const adminTestState = createAdminTestState();
    const manuscriptTestState = createManuscriptTestState();
    const app = buildApp({
      config: testConfig,
      testState: {
        admin: adminTestState,
        manuscripts: manuscriptTestState,
      },
    });
    const initialReviewCount = adminTestState.reviews.length;
    const fileBytes = Buffer.from("  \n\n  ");

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "empty.txt",
        mimeType: "text/plain",
        fileSizeBytes: fileBytes.length,
      },
    });
    expect(signedUrlResponse.statusCode).toBe(201);
    const { documentId, uploadUrl } = signedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };

    const uploadResponse = await app.inject({
      method: "PUT",
      url: localPathFromUrl(uploadUrl),
      headers: { "content-type": "text/plain" },
      payload: fileBytes,
    });
    expect(uploadResponse.statusCode).toBe(200);

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(completeResponse.statusCode).toBe(200);

    const [result] = await processQueuedTestDocumentProcessingJobs({
      adminTestState,
      manuscriptTestState,
      dispatch: async () => ({
        status: "failed",
        category: "user_correctable",
        failure_code: "empty_extracted_text",
        metadata: {
          failure_category: "user_correctable",
          failure_code: "empty_extracted_text",
          scanner_result: "not_scanned",
        },
      }),
    });
    expect(result).toMatchObject({
      status: "failed",
      failureCode: "empty_extracted_text",
    });

    const documentResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(documentResponse.statusCode).toBe(200);
    expect(documentResponse.json().document).toMatchObject({
      processingStatus: "failed",
      processingFailureCode: "empty_extracted_text",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
    });
    expect(adminTestState.reviews).toHaveLength(initialReviewCount);
  });
});
