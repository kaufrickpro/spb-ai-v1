import type {
  AdminExceptionQueue,
  AdminReviewQueueItem,
  DocumentProcessingFailureCode,
} from "@marketplace/contracts";
import { AdminReviewQueueItemSchema } from "@marketplace/contracts";
import { randomUUID } from "node:crypto";
import { mapDbAdminReview } from "../admin/mappers.js";
import type { AdminTestState } from "../admin/testState.js";
import type { AuthorRequestContext } from "./access.js";
import { ManuscriptServiceError } from "./errors.js";

type AdminRiskLevel = "low" | "medium" | "high";

type DocumentProcessingExceptionDecision = {
  createAdminException: boolean;
  exceptionQueue: AdminExceptionQueue | null;
  eligibilityStatus: "limited" | "quarantined";
  reviewOutcome: "needs_review" | "quarantined";
  riskLevel: AdminRiskLevel | null;
  source: "document_processing";
  summary: string | null;
  submittedFields: Record<string, unknown>;
  riskWarnings: string[];
};

const USER_CORRECTABLE_FAILURES = new Set<DocumentProcessingFailureCode>([
  "empty_extracted_text",
  "unsupported_file_type",
  "extracted_text_too_large",
  "chunk_limit_exceeded",
  "parser_failed",
]);

const SYSTEM_OR_PROVIDER_FAILURES = new Set<DocumentProcessingFailureCode>([
  "download_failed",
  "embedding_failed",
]);

const SUSPICIOUS_SCANNER_RESULTS = new Set([
  "suspicious",
  "malware_suspected",
  "policy_suspicious",
]);

const QUARANTINE_SCANNER_RESULTS = new Set([
  "quarantined",
  "malware_detected",
  "unsafe",
]);

export function classifyDocumentProcessingFailure(input: {
  attemptCount: number;
  failureCode: DocumentProcessingFailureCode;
  jobId?: string | null;
  maxAttempts: number;
  metadata?: Record<string, unknown> | null;
  mimeType?: string | null;
}): DocumentProcessingExceptionDecision {
  const scannerResult = getStringMetadata(input.metadata, "scanner_result");
  const scannerVerdict = getScannerVerdict(scannerResult);

  if (scannerVerdict === "quarantine") {
    return buildExceptionDecision(input, {
      exceptionQueue: "quarantine",
      eligibilityStatus: "quarantined",
      reviewOutcome: "quarantined",
      riskLevel: "high",
      summary: "Document scanner quarantined the uploaded sample",
      riskWarnings: ["scanner_quarantine"],
      scannerResult,
    });
  }

  if (
    scannerVerdict === "suspicious" ||
    input.failureCode === "scanner_suspicious"
  ) {
    return buildExceptionDecision(input, {
      exceptionQueue: "needs_review",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskLevel: "high",
      summary: "Document scanner returned a suspicious result",
      riskWarnings: ["scanner_suspicious"],
      scannerResult,
    });
  }

  if (input.failureCode === "file_type_mismatch") {
    return buildExceptionDecision(input, {
      exceptionQueue: "needs_review",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskLevel: "high",
      summary: "Document upload metadata did not match processing validation",
      riskWarnings: ["validation_bypass_signal"],
      scannerResult,
    });
  }

  if (input.failureCode === "unexpected_processing_error") {
    return buildExceptionDecision(input, {
      exceptionQueue: "system_failures",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskLevel: "high",
      summary:
        "Document processing stopped because of an unexpected runtime error",
      riskWarnings: ["unexpected_runtime_error"],
      scannerResult,
    });
  }

  if (
    SYSTEM_OR_PROVIDER_FAILURES.has(input.failureCode) &&
    input.attemptCount >= input.maxAttempts
  ) {
    return buildExceptionDecision(input, {
      exceptionQueue: "system_failures",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskLevel: "medium",
      summary: "Document processing failed repeatedly after automatic retries",
      riskWarnings: ["repeated_system_or_provider_failure"],
      scannerResult,
    });
  }

  if (USER_CORRECTABLE_FAILURES.has(input.failureCode)) {
    return buildNoExceptionDecision(input);
  }

  return buildNoExceptionDecision(input);
}

export function createTestDocumentProcessingAdminException(
  adminTestState: AdminTestState,
  input: {
    attemptCount: number;
    authorId: string;
    documentId: string;
    failureCode: DocumentProcessingFailureCode;
    jobId?: string | null;
    maxAttempts: number;
    metadata?: Record<string, unknown> | null;
    mimeType?: string | null;
    now: string;
  },
): AdminReviewQueueItem | null {
  const decision = classifyDocumentProcessingFailure(input);
  if (!decision.createAdminException) {
    return null;
  }

  const existing = adminTestState.reviews.find(
    (review) =>
      review.entityType === "document" &&
      review.entityId === input.documentId &&
      review.source === decision.source &&
      review.status === "pending",
  );
  if (existing) {
    return existing;
  }

  const review = AdminReviewQueueItemSchema.parse({
    id: randomUUID(),
    entityType: "document",
    entityId: input.documentId,
    status: "pending",
    exceptionQueue: decision.exceptionQueue,
    eligibilityStatus: decision.eligibilityStatus,
    reviewOutcome: decision.reviewOutcome,
    riskLevel: decision.riskLevel,
    source: decision.source,
    summary: decision.summary,
    assigneeUserId: null,
    decidedByUserId: null,
    decisionNote: null,
    lastSignalAt: input.now,
    submittedAt: input.now,
    updatedAt: input.now,
  });
  adminTestState.reviews.unshift(review);
  return review;
}

export async function createDocumentProcessingAdminException(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: {
    attemptCount: number;
    authorId: string;
    documentId: string;
    failureCode: DocumentProcessingFailureCode;
    jobId?: string | null;
    maxAttempts: number;
    metadata?: Record<string, unknown> | null;
    mimeType?: string | null;
  },
): Promise<AdminReviewQueueItem | null> {
  const decision = classifyDocumentProcessingFailure(input);
  if (!decision.createAdminException) {
    return null;
  }

  const { data: existing, error: existingError } = await context.serviceDb
    .from("admin_reviews")
    .select()
    .eq("entity_type", "document")
    .eq("entity_id", input.documentId)
    .eq("source", decision.source)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to load document processing admin exception",
      existingError,
    );
  }

  if (existing) {
    return mapDbAdminReview(existing);
  }

  const { data, error } = await context.serviceDb
    .from("admin_reviews")
    .insert({
      entity_type: "document",
      entity_id: input.documentId,
      status: "pending",
      exception_queue: decision.exceptionQueue,
      eligibility_status: decision.eligibilityStatus,
      review_outcome: decision.reviewOutcome,
      risk_level: decision.riskLevel,
      source: decision.source,
      summary: decision.summary,
      submitted_by_user_id: input.authorId,
      submitted_fields: decision.submittedFields,
      risk_warnings: decision.riskWarnings,
    })
    .select()
    .single();

  if (error) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to create document processing admin exception",
      error,
    );
  }

  return mapDbAdminReview(data);
}

function buildExceptionDecision(
  input: {
    attemptCount: number;
    failureCode: DocumentProcessingFailureCode;
    jobId?: string | null;
    maxAttempts: number;
    metadata?: Record<string, unknown> | null;
    mimeType?: string | null;
  },
  decision: {
    exceptionQueue: AdminExceptionQueue;
    eligibilityStatus: "limited" | "quarantined";
    reviewOutcome: "needs_review" | "quarantined";
    riskLevel: AdminRiskLevel;
    riskWarnings: string[];
    scannerResult: string | null;
    summary: string;
  },
): DocumentProcessingExceptionDecision {
  return {
    createAdminException: true,
    exceptionQueue: decision.exceptionQueue,
    eligibilityStatus: decision.eligibilityStatus,
    reviewOutcome: decision.reviewOutcome,
    riskLevel: decision.riskLevel,
    source: "document_processing",
    summary: decision.summary,
    submittedFields: buildSafeSubmittedFields(input, decision.scannerResult),
    riskWarnings: decision.riskWarnings,
  };
}

function buildNoExceptionDecision(input: {
  attemptCount: number;
  failureCode: DocumentProcessingFailureCode;
  jobId?: string | null;
  maxAttempts: number;
  metadata?: Record<string, unknown> | null;
  mimeType?: string | null;
}): DocumentProcessingExceptionDecision {
  return {
    createAdminException: false,
    exceptionQueue: null,
    eligibilityStatus: "limited",
    reviewOutcome: "needs_review",
    riskLevel: null,
    source: "document_processing",
    summary: null,
    submittedFields: buildSafeSubmittedFields(
      input,
      getStringMetadata(input.metadata, "scanner_result"),
    ),
    riskWarnings: [],
  };
}

function buildSafeSubmittedFields(
  input: {
    attemptCount: number;
    failureCode: DocumentProcessingFailureCode;
    jobId?: string | null;
    maxAttempts: number;
    mimeType?: string | null;
  },
  scannerResult: string | null,
): Record<string, unknown> {
  return {
    attemptCount: input.attemptCount,
    failureCode: input.failureCode,
    jobId: input.jobId ?? null,
    maxAttempts: input.maxAttempts,
    mimeType: input.mimeType ?? null,
    scannerResult,
  };
}

function getScannerVerdict(
  scannerResult: string | null,
): "quarantine" | "suspicious" | "none" {
  if (!scannerResult) return "none";
  if (QUARANTINE_SCANNER_RESULTS.has(scannerResult)) return "quarantine";
  if (SUSPICIOUS_SCANNER_RESULTS.has(scannerResult)) return "suspicious";
  return "none";
}

function getStringMetadata(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
