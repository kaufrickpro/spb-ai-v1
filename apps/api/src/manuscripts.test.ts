import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import { createAdminTestState } from "./modules/admin/testState.js";
import { TEST_USER_ID } from "./modules/auth/requestAuth.js";
import { completeAuthorDocumentUpload } from "./modules/manuscripts/documentService.js";
import { sanitizeWorkerMetadata } from "./modules/manuscripts/documentProcessingTypes.js";
import { queueTestDocumentIngestionJob } from "./modules/manuscripts/ingestionJobs.js";
import {
  classifyDocumentProcessingFailure,
  createTestDocumentProcessingAdminException,
} from "./modules/manuscripts/processingOutcomes.js";
import {
  createManuscriptTestState,
  createTestDocument,
  TEST_AUTHOR_MANUSCRIPT_ID,
} from "./modules/manuscripts/testState.js";
import { saveLocalUpload } from "./modules/storage/localStorage.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  webAppUrl: "http://localhost:5173",
};

function localPathFromUrl(url: string): string {
  return url.replace("http://localhost:4000", "");
}

describe("Manuscript routes", () => {
  // ─── Auth required ─────────────────────────────────────────────────────────

  it("blocks unauthenticated access to manuscript list", async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts",
    });
    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated access to manuscript create", async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/manuscripts",
      payload: { title: "Test", genre: "Deneme", language: "tr" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("blocks unauthenticated access to signed-url", async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });

  // ─── Author can list their own manuscripts ─────────────────────────────────

  it("returns empty list initially for a new author (after seeded fixture)", async () => {
    const app = buildApp({ config: testConfig });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts",
      headers: { authorization: "Bearer test-user" },
    });

    expect(response.statusCode).toBe(200);
    // Test state seeds one fixture manuscript for test-user
    expect(response.json().manuscripts).toHaveLength(1);
    expect(response.json().manuscripts[0].title).toBe("Gece Yarısı Şehri");
  });

  // ─── Create manuscript ─────────────────────────────────────────────────────

  it("creates a manuscript in draft status for an authenticated user", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/manuscripts",
      headers: { authorization: "Bearer test-user" },
      payload: {
        title: "Bozkır",
        genre: "Doğa Yazını",
        language: "tr",
        wordCount: 60000,
        synopsis: "Orta Anadolu bozkırında yaşanan bir aşk hikayesi.",
        targetAgeMin: 16,
        targetAgeMax: 99,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.manuscript).toMatchObject({
      title: "Bozkır",
      genre: "Doğa Yazını",
      language: "tr",
      wordCount: 60000,
      status: "draft",
      adminReviewStatus: "not_submitted",
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
    });
  });

  // ─── Get manuscript ────────────────────────────────────────────────────────

  it("returns a manuscript the author owns", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-user" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().manuscript.id).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
  });

  it("returns 404 when the manuscript belongs to another author", async () => {
    const app = buildApp({ config: testConfig });

    // another author tries to read test-user's manuscript
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-other-author" },
    });

    expect(response.statusCode).toBe(404);
  });

  // ─── Update manuscript ─────────────────────────────────────────────────────

  it("updates a manuscript the author owns", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-user" },
      payload: { wordCount: 95000 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().manuscript.wordCount).toBe(95000);
  });

  // ─── Upload signed URL ─────────────────────────────────────────────────────

  it("returns a signed upload URL for a valid request", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "sample.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024 * 1024, // 1 MB
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.uploadId).toBeTruthy();
    expect(body.documentId).toBeTruthy();
    expect(body.uploadUrl).toMatch(/\/api\/v1\/uploads\/local\//);
    expect(body.expiresAt).toBeTruthy();
  });

  it("allows the local signed upload URL to accept file bytes without auth headers", async () => {
    const app = buildApp({ config: testConfig });
    const fileBytes = Buffer.from("hello world!");

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "sample.txt",
        mimeType: "text/plain",
        fileSizeBytes: fileBytes.length,
      },
    });

    const { uploadUrl } = signedUrlResponse.json() as { uploadUrl: string };
    const uploadPath = localPathFromUrl(uploadUrl);

    const uploadResponse = await app.inject({
      method: "PUT",
      url: uploadPath,
      payload: fileBytes,
      headers: { "content-type": "text/plain" },
    });

    expect(uploadResponse.statusCode).toBe(200);
    expect(uploadResponse.json()).toEqual({ ok: true });
  });

  it("rejects a stale local upload token after the document is completed", async () => {
    const app = buildApp({ config: testConfig });
    const originalBytes = Buffer.from("original");

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "stale.txt",
        mimeType: "text/plain",
        fileSizeBytes: originalBytes.length,
      },
    });

    const { documentId, uploadUrl } = signedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };
    const uploadPath = localPathFromUrl(uploadUrl);

    expect(
      (
        await app.inject({
          method: "PUT",
          url: uploadPath,
          payload: originalBytes,
          headers: { "content-type": "text/plain" },
        })
      ).statusCode,
    ).toBe(200);

    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const staleResponse = await app.inject({
      method: "PUT",
      url: uploadPath,
      payload: Buffer.from("overwrite"),
      headers: { "content-type": "text/plain" },
    });

    expect(staleResponse.statusCode).toBe(400);
    expect(staleResponse.json()).toMatchObject({
      error: { code: "upload_not_pending" },
    });
  });

  it("rejects local upload bytes whose content type differs from the signed metadata", async () => {
    const app = buildApp({ config: testConfig });
    const fileBytes = Buffer.from("plain text");

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "mismatch.txt",
        mimeType: "text/plain",
        fileSizeBytes: fileBytes.length,
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: localPathFromUrl(signedUrlResponse.json().uploadUrl),
      payload: fileBytes,
      headers: { "content-type": "application/pdf" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "upload_content_type_mismatch" },
    });
  });

  it("rejects local upload bytes whose size differs from the signed metadata", async () => {
    const app = buildApp({ config: testConfig });

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "wrong-size.txt",
        mimeType: "text/plain",
        fileSizeBytes: 5,
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: localPathFromUrl(signedUrlResponse.json().uploadUrl),
      payload: Buffer.from("too long"),
      headers: { "content-type": "text/plain" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "upload_size_mismatch" },
    });
  });

  it("rejects unsupported MIME types", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "image.png",
        mimeType: "image/png",
        fileSizeBytes: 500,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects files over 25 MB", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "huge.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 26 * 1024 * 1024, // 26 MB
      },
    });

    expect(response.statusCode).toBe(400);
  });

  // ─── Complete upload flow ──────────────────────────────────────────────────

  it("completes upload and returns updated document", async () => {
    const app = buildApp({ config: testConfig });

    // Step 1: request signed URL (creates the pending_upload document)
    const urlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "chapter1.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 8,
      },
    });

    expect(urlResponse.statusCode).toBe(201);
    const { documentId } = urlResponse.json() as { documentId: string };

    const uploadPath = localPathFromUrl(urlResponse.json().uploadUrl);
    const uploadResponse = await app.inject({
      method: "PUT",
      url: uploadPath,
      payload: Buffer.from("%PDF-1.7"),
      headers: { "content-type": "application/pdf" },
    });
    expect(uploadResponse.statusCode).toBe(200);

    // Step 2: complete upload
    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().document.storageStatus).toBe("uploaded");
    expect(completeResponse.json().document.processingStatus).toBe("queued");
    expect(completeResponse.json().document.processingFailureCode).toBeNull();
  });

  it("rejects stale upload completion when no local file was stored for the pending document", async () => {
    const app = buildApp({ config: testConfig });

    const urlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "missing.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
      },
    });

    const { documentId } = urlResponse.json() as { documentId: string };

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    expect(completeResponse.statusCode).toBe(409);
    expect(completeResponse.json()).toMatchObject({
      error: { code: "stale_upload_completion" },
    });
  });

  it("leaves a pending upload unattached when ingestion job creation fails", async () => {
    const adminTestState = createAdminTestState();
    const testState = createManuscriptTestState();
    const documentId = "10000000-0000-4000-8000-000000000099";
    const uploadId = "upload-job-failure";

    adminTestState.failIngestionJobDocumentIds = new Set([documentId]);
    createTestDocument(
      testState,
      documentId,
      uploadId,
      TEST_AUTHOR_MANUSCRIPT_ID,
      TEST_USER_ID,
      "job-failure.txt",
      "text/plain",
      11,
    );
    await saveLocalUpload({
      bytes: Buffer.from("hello world"),
      documentId,
      fileName: "job-failure.txt",
      uploadId,
    });

    await expect(
      completeAuthorDocumentUpload(
        { mode: "test" },
        {
          adminTestState,
          authorId: TEST_USER_ID,
          documentId,
          testState,
        },
      ),
    ).rejects.toMatchObject({ kind: "storage" });

    expect(
      testState.documents.find((item) => item.id === documentId),
    ).toMatchObject({
      storageStatus: "pending_upload",
      processingStatus: "not_started",
    });
    expect(
      testState.manuscripts.find(
        (item) => item.id === TEST_AUTHOR_MANUSCRIPT_ID,
      )?.sampleDocumentId,
    ).toBeNull();
    expect(
      adminTestState.jobRuns.find((item) => item.source.includes(documentId)),
    ).toBeUndefined();
  });

  it("rejects repeated upload completion and keeps a single ingestion job", async () => {
    const app = buildApp({ config: testConfig });
    const fileBytes = Buffer.from("once only");

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "repeat.txt",
        mimeType: "text/plain",
        fileSizeBytes: fileBytes.length,
      },
    });

    const { documentId, uploadUrl } = signedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };

    await app.inject({
      method: "PUT",
      url: localPathFromUrl(uploadUrl),
      payload: fileBytes,
      headers: { "content-type": "text/plain" },
    });

    const firstComplete = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(firstComplete.statusCode).toBe(200);

    const secondComplete = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(secondComplete.statusCode).toBe(409);

    const jobsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/jobs/health",
      headers: { authorization: "Bearer test-admin-mfa" },
    });
    const matchingJobs = jobsResponse
      .json()
      .runs.filter(
        (item: { jobType: string; source: string }) =>
          item.jobType === "document_ingestion" &&
          item.source.includes(documentId),
      );
    expect(matchingJobs).toHaveLength(1);
  });

  it("reuses an existing idempotent ingestion job when completion is retried internally", async () => {
    const adminTestState = createAdminTestState();
    const testState = createManuscriptTestState();
    const documentId = "10000000-0000-4000-8000-000000000098";
    const uploadId = "upload-existing-job";
    const updatedAt = new Date().toISOString();

    createTestDocument(
      testState,
      documentId,
      uploadId,
      TEST_AUTHOR_MANUSCRIPT_ID,
      TEST_USER_ID,
      "existing-job.txt",
      "text/plain",
      11,
    );
    queueTestDocumentIngestionJob(adminTestState, {
      documentId,
      fileSizeBytes: 11,
      mimeType: "text/plain",
      originalFileName: "existing-job.txt",
      uploadId,
      updatedAt,
    });
    await saveLocalUpload({
      bytes: Buffer.from("hello world"),
      documentId,
      fileName: "existing-job.txt",
      uploadId,
    });

    const document = await completeAuthorDocumentUpload(
      { mode: "test" },
      {
        adminTestState,
        authorId: TEST_USER_ID,
        documentId,
        testState,
      },
    );

    expect(document.processingStatus).toBe("queued");
    expect(
      adminTestState.jobRuns.filter((item) => item.source.includes(documentId)),
    ).toHaveLength(1);
  });

  it("keeps user-correctable document processing failures out of admin queues", () => {
    const adminTestState = createAdminTestState();
    const existingReviewCount = adminTestState.reviews.length;

    for (const failureCode of [
      "empty_extracted_text",
      "unsupported_file_type",
      "extracted_text_too_large",
      "chunk_limit_exceeded",
      "parser_failed",
    ] as const) {
      expect(
        classifyDocumentProcessingFailure({
          attemptCount: 3,
          failureCode,
          maxAttempts: 3,
          metadata: { scanner_result: "clean" },
          mimeType: "text/plain",
        }),
      ).toMatchObject({
        createAdminException: false,
        exceptionQueue: null,
        riskWarnings: [],
      });

      expect(
        createTestDocumentProcessingAdminException(adminTestState, {
          attemptCount: 3,
          authorId: TEST_USER_ID,
          documentId: "10000000-0000-4000-8000-000000000088",
          failureCode,
          maxAttempts: 3,
          metadata: { scanner_result: "clean" },
          mimeType: "text/plain",
          now: "2026-05-05T12:00:00.000Z",
        }),
      ).toBeNull();
    }

    expect(adminTestState.reviews).toHaveLength(existingReviewCount);
  });

  it("creates safe admin exception decisions for suspicious processing outcomes", () => {
    const suspiciousDecision = classifyDocumentProcessingFailure({
      attemptCount: 1,
      failureCode: "scanner_suspicious",
      jobId: "job-scanner",
      maxAttempts: 3,
      metadata: {
        scanner: "clamav",
        scanner_result: "suspicious",
        scanner_signature: "Eicar-Test-Signature",
        original_filename: "secret.txt",
        storage_path: "private/document/path",
        signed_url: "https://example.invalid/private-token",
        raw_provider_payload: { unsafe: true },
        author_id: TEST_USER_ID,
      },
      mimeType: "text/plain",
    });

    expect(suspiciousDecision).toMatchObject({
      createAdminException: true,
      exceptionQueue: "needs_review",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskLevel: "high",
      riskWarnings: ["scanner_suspicious"],
      submittedFields: {
        failureCode: "scanner_suspicious",
        jobId: "job-scanner",
        scanner: "clamav",
        scannerResult: "suspicious",
        scannerSignature: "Eicar-Test-Signature",
      },
    });
    expect(suspiciousDecision.submittedFields).not.toHaveProperty(
      "original_filename",
    );
    expect(suspiciousDecision.submittedFields).not.toHaveProperty(
      "storage_path",
    );
    expect(suspiciousDecision.submittedFields).not.toHaveProperty("signed_url");
    expect(suspiciousDecision.submittedFields).not.toHaveProperty(
      "raw_provider_payload",
    );
    expect(suspiciousDecision.submittedFields).not.toHaveProperty("author_id");

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "scanner_suspicious",
        jobId: "job-scanner",
        maxAttempts: 3,
        metadata: { scanner_result: "suspicious" },
        mimeType: "text/plain",
      }),
    ).toMatchObject({ submittedFields: { scannerSignature: null } });

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "scanner_suspicious",
        maxAttempts: 3,
        metadata: { scanner_result: "quarantined" },
        mimeType: "text/plain",
      }),
    ).toMatchObject({
      createAdminException: true,
      exceptionQueue: "quarantine",
      eligibilityStatus: "quarantined",
      reviewOutcome: "quarantined",
      riskLevel: "high",
      riskWarnings: ["scanner_quarantine"],
    });

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "file_type_mismatch",
        maxAttempts: 3,
        metadata: { signedUrl: "https://example.invalid/private-token" },
        mimeType: "application/pdf",
      }),
    ).toMatchObject({
      createAdminException: true,
      exceptionQueue: "needs_review",
      riskWarnings: ["validation_bypass_signal"],
      submittedFields: {
        failureCode: "file_type_mismatch",
        mimeType: "application/pdf",
      },
    });
    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "file_type_mismatch",
        maxAttempts: 3,
        metadata: { signedUrl: "https://example.invalid/private-token" },
        mimeType: "application/pdf",
      }).submittedFields,
    ).not.toHaveProperty("signedUrl");

    const adminTestState = createAdminTestState();
    const review = createTestDocumentProcessingAdminException(adminTestState, {
      attemptCount: 1,
      authorId: TEST_USER_ID,
      documentId: "10000000-0000-4000-8000-000000000087",
      failureCode: "scanner_suspicious",
      jobId: "job-scanner",
      maxAttempts: 3,
      metadata: {
        scanner: "clamav",
        scanner_result: "suspicious",
        scanner_signature: "Eicar-Test-Signature",
        original_filename: "secret.txt",
        storage_path: "private/document/path",
      },
      mimeType: "text/plain",
      now: "2026-05-05T12:00:00.000Z",
    });

    expect(review).toMatchObject({
      entityType: "document",
      entityId: "10000000-0000-4000-8000-000000000087",
      exceptionQueue: "needs_review",
      source: "document_processing",
      status: "pending",
    });
    expect(
      adminTestState.reviews.filter(
        (item) =>
          item.entityType === "document" &&
          item.entityId === "10000000-0000-4000-8000-000000000087",
      ),
    ).toHaveLength(1);
  });

  it("sanitizes worker metadata with an explicit scanner allowlist", () => {
    expect(
      sanitizeWorkerMetadata({
        scanner: " clamav ",
        scanner_result: "clean",
        scanner_version: " 1.4.0 ",
        scanner_signature: "should-not-store-for-clean",
        scanner_error_type: "timeout",
        storage_path: "private/path",
        signed_url: "https://example.invalid/private-token",
        original_filename: "secret.txt",
        author_id: TEST_USER_ID,
        raw_provider_payload: { result: "clean" },
      }),
    ).toEqual({
      scanner: "clamav",
      scanner_result: "clean",
      scanner_version: "1.4.0",
      scanner_error_type: "timeout",
    });

    expect(
      sanitizeWorkerMetadata({
        scanner_result: "suspicious",
        scanner_signature: "x".repeat(250),
      }),
    ).toEqual({
      scanner_result: "suspicious",
      scanner_signature: "x".repeat(200),
    });
  });

  it("creates admin exceptions only after repeated system/provider failures, plus unexpected runtime errors", () => {
    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "embedding_failed",
        maxAttempts: 3,
        mimeType: "text/plain",
      }),
    ).toMatchObject({ createAdminException: false });

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "scanner_failed",
        maxAttempts: 3,
        metadata: { scanner_error_type: "timeout" },
        mimeType: "text/plain",
      }),
    ).toMatchObject({ createAdminException: false });

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 3,
        failureCode: "embedding_failed",
        maxAttempts: 3,
        mimeType: "text/plain",
      }),
    ).toMatchObject({
      createAdminException: true,
      exceptionQueue: "system_failures",
      riskWarnings: ["repeated_system_or_provider_failure"],
    });

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 3,
        failureCode: "scanner_failed",
        maxAttempts: 3,
        metadata: { scanner_error_type: "timeout" },
        mimeType: "text/plain",
      }),
    ).toMatchObject({
      createAdminException: true,
      exceptionQueue: "system_failures",
      riskWarnings: ["repeated_system_or_provider_failure"],
    });

    expect(
      classifyDocumentProcessingFailure({
        attemptCount: 1,
        failureCode: "unexpected_processing_error",
        maxAttempts: 3,
        mimeType: "text/plain",
      }),
    ).toMatchObject({
      createAdminException: true,
      exceptionQueue: "system_failures",
      riskWarnings: ["unexpected_runtime_error"],
    });
  });

  // ─── Download URL ──────────────────────────────────────────────────────────

  it("returns a download URL for a document the author owns", async () => {
    const app = buildApp({ config: testConfig });

    // Create doc first
    const urlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "sample.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSizeBytes: 10,
      },
    });
    const { documentId } = urlResponse.json() as { documentId: string };

    const uploadPath = localPathFromUrl(urlResponse.json().uploadUrl);
    await app.inject({
      method: "PUT",
      url: uploadPath,
      payload: Buffer.from("docx bytes"),
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const downloadResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}/download-url`,
      headers: { authorization: "Bearer test-user" },
    });

    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.json().downloadUrl).toContain(
      "/api/v1/documents/local-download/",
    );
  });

  it("serves stored local file bytes from the signed download URL", async () => {
    const app = buildApp({ config: testConfig });

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "chapter.txt",
        mimeType: "text/plain",
        fileSizeBytes: 13,
      },
    });

    const { documentId, uploadUrl } = signedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };

    await app.inject({
      method: "PUT",
      url: localPathFromUrl(uploadUrl),
      payload: Buffer.from("Merhaba dunya"),
      headers: { "content-type": "text/plain" },
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const downloadResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}/download-url`,
      headers: { authorization: "Bearer test-user" },
    });

    const downloadPath = localPathFromUrl(downloadResponse.json().downloadUrl);
    const fileResponse = await app.inject({
      method: "GET",
      url: downloadPath,
    });

    expect(fileResponse.statusCode).toBe(200);
    expect(fileResponse.headers["content-disposition"]).toBe(
      'attachment; filename="chapter.txt"',
    );
    expect(fileResponse.body).toBe("Merhaba dunya");
  });

  it("blocks another user from getting download URL for someone else's document", async () => {
    const app = buildApp({ config: testConfig });

    const urlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "private.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 7,
      },
    });
    const { documentId } = urlResponse.json() as { documentId: string };

    await app.inject({
      method: "PUT",
      url: localPathFromUrl(urlResponse.json().uploadUrl),
      payload: Buffer.from("private"),
      headers: { "content-type": "application/pdf" },
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    // another author (different userId) tries to get download URL
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}/download-url`,
      headers: { authorization: "Bearer test-other-author" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("blocks a publisher user from every manuscript and upload endpoint", async () => {
    const app = buildApp({ config: testConfig });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts",
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(listResponse.statusCode).toBe(403);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/manuscripts",
      headers: { authorization: "Bearer test-publisher" },
      payload: { title: "Nope", genre: "Roman", language: "tr" },
    });
    expect(createResponse.statusCode).toBe(403);

    const getResponse = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(getResponse.statusCode).toBe(403);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-publisher" },
      payload: { title: "Still nope" },
    });
    expect(updateResponse.statusCode).toBe(403);

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-publisher" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "sample.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
      },
    });
    expect(signedUrlResponse.statusCode).toBe(403);
  });

  it("blocks a non-owner author from another author's manuscript and document routes", async () => {
    const app = buildApp({ config: testConfig });

    const ownerSignedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "owner.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024,
      },
    });

    const { documentId, uploadUrl } = ownerSignedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };

    await app.inject({
      method: "PUT",
      url: localPathFromUrl(uploadUrl),
      payload: Buffer.from("owner-file"),
      headers: { "content-type": "application/pdf" },
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const manuscriptResponse = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-other-author" },
    });
    expect(manuscriptResponse.statusCode).toBe(404);

    const documentResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}`,
      headers: { authorization: "Bearer test-other-author" },
    });
    expect(documentResponse.statusCode).toBe(404);

    const downloadResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}/download-url`,
      headers: { authorization: "Bearer test-other-author" },
    });
    expect(downloadResponse.statusCode).toBe(404);
  });

  it("keeps the active sample when a replacement signed URL is abandoned", async () => {
    const app = buildApp({ config: testConfig });

    const firstUpload = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "first.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 5,
      },
    });
    const first = firstUpload.json() as {
      documentId: string;
      uploadUrl: string;
    };
    await app.inject({
      method: "PUT",
      url: localPathFromUrl(first.uploadUrl),
      payload: Buffer.from("first"),
      headers: { "content-type": "application/pdf" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${first.documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const abandonedReplacement = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "abandoned.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 9,
      },
    });
    expect(abandonedReplacement.statusCode).toBe(201);

    const oldDocumentResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${first.documentId}`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(oldDocumentResponse.statusCode).toBe(200);
    expect(oldDocumentResponse.json().document.storageStatus).toBe("uploaded");

    const manuscriptResponse = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-user" },
    });
    expect(manuscriptResponse.json().manuscript.sampleDocumentId).toBe(
      first.documentId,
    );
  });

  it("marks the prior active sample as pending_delete when a replacement upload is completed", async () => {
    const app = buildApp({ config: testConfig });

    const firstUpload = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "first.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 5,
      },
    });
    const first = firstUpload.json() as {
      documentId: string;
      uploadUrl: string;
    };
    await app.inject({
      method: "PUT",
      url: localPathFromUrl(first.uploadUrl),
      payload: Buffer.from("first"),
      headers: { "content-type": "application/pdf" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${first.documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const secondUpload = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "second.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 6,
      },
    });
    const second = secondUpload.json() as {
      documentId: string;
      uploadUrl: string;
    };
    await app.inject({
      method: "PUT",
      url: localPathFromUrl(second.uploadUrl),
      payload: Buffer.from("second"),
      headers: { "content-type": "application/pdf" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${second.documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });

    const oldDocumentResponse = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${first.documentId}`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(oldDocumentResponse.statusCode).toBe(200);
    expect(oldDocumentResponse.json().document.storageStatus).toBe(
      "pending_delete",
    );

    const manuscriptResponse = await app.inject({
      method: "GET",
      url: "/api/v1/manuscripts/10000000-0000-4000-8000-000000000001",
      headers: { authorization: "Bearer test-user" },
    });
    expect(manuscriptResponse.json().manuscript.sampleDocumentId).toBe(
      second.documentId,
    );
  });

  it("auto-approves a clean manuscript without creating an admin exception", async () => {
    const app = buildApp({ config: testConfig });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/manuscripts",
      headers: { authorization: "Bearer test-user" },
      payload: {
        title: "Moderation Test",
        genre: "Roman",
        language: "tr",
      },
    });

    const manuscriptId = createResponse.json().manuscript.id as string;
    expect(createResponse.json().manuscript).toMatchObject({
      adminReviewStatus: "not_submitted",
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
    });

    const queueResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reviews?entityType=manuscript",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    const review = queueResponse
      .json()
      .reviews.find(
        (item: { entityId: string }) => item.entityId === manuscriptId,
      );
    expect(review).toBeUndefined();
  });

  it("queues a clean uploaded document for ingestion without creating an admin exception", async () => {
    const app = buildApp({ config: testConfig });

    const signedUrlResponse = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "moderation.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
      },
    });

    const { documentId, uploadUrl } = signedUrlResponse.json() as {
      documentId: string;
      uploadUrl: string;
    };

    await app.inject({
      method: "PUT",
      url: new URL(uploadUrl).pathname,
      payload: Buffer.from("moderation"),
      headers: { "content-type": "application/pdf" },
    });

    const completeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${documentId}/complete-upload`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(completeResponse.json().document).toMatchObject({
      adminReviewStatus: "not_submitted",
      processingStatus: "queued",
      processingFailureCode: null,
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
    });

    const queueResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reviews?entityType=document",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    const review = queueResponse
      .json()
      .reviews.find(
        (item: { entityId: string }) => item.entityId === documentId,
      );
    expect(review).toBeUndefined();

    const jobsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/jobs/health",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    const ingestionJob = jobsResponse
      .json()
      .runs.find(
        (item: { jobType: string; source: string }) =>
          item.jobType === "document_ingestion" &&
          item.source.includes(documentId),
      );
    expect(ingestionJob).toMatchObject({
      status: "queued",
      failureCode: null,
      attemptCount: 0,
      maxAttempts: 3,
    });
  });

  // ─── Fake upload token ─────────────────────────────────────────────────────

  it("rejects an expired or malformed local upload token", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/uploads/local/invalid-token",
      headers: { authorization: "Bearer test-user" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects malformed local download tokens", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/documents/local-download/invalid-token",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "download_token_invalid" },
    });
  });
});
