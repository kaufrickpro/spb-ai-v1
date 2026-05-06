import { z } from "zod";
import {
  DocumentProcessingFailureCodeSchema,
  type DocumentProcessingFailureCode,
} from "@marketplace/contracts";

export const AiIngestionResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  category: z.string().optional(),
  failure_code: DocumentProcessingFailureCodeSchema.nullable().optional(),
  extracted_character_count: z.number().int().nonnegative().optional(),
  chunk_count: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type AiIngestionResult = z.infer<typeof AiIngestionResultSchema>;

export type DocumentProcessingDispatch = (input: {
  jobId: string;
}) => Promise<AiIngestionResult>;

export type DocumentProcessingRunResult = {
  jobId: string;
  status: "succeeded" | "failed" | "skipped";
  reason?: "not_found" | "not_queued";
  failureCode?: DocumentProcessingFailureCode | null;
};

export async function dispatchDocumentProcessingJobSafely(
  dispatch: DocumentProcessingDispatch,
  jobId: string,
): Promise<AiIngestionResult> {
  try {
    return await dispatch({ jobId });
  } catch {
    return {
      status: "failed",
      failure_code: "unexpected_processing_error",
      metadata: {
        failure_code: "unexpected_processing_error",
        failure_category: "system",
      },
    };
  }
}

export function normalizeFailureCode(
  failureCode: unknown,
): DocumentProcessingFailureCode {
  const parsed = DocumentProcessingFailureCodeSchema.safeParse(failureCode);
  return parsed.success ? parsed.data : "unexpected_processing_error";
}

export function sanitizeWorkerMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const input = metadata ?? {};
  return {
    ...pickSafeWorkerValue(input, "chunk_count"),
    ...pickSafeWorkerValue(input, "chunker"),
    ...pickSafeWorkerValue(input, "embedding_model"),
    ...pickSafeWorkerValue(input, "extracted_character_count"),
    ...pickSafeWorkerValue(input, "failure_category"),
    ...pickSafeWorkerValue(input, "failure_code"),
    ...pickSafeWorkerValue(input, "ingestion_version"),
    ...pickSafeWorkerValue(input, "scanner"),
    ...pickSafeWorkerValue(input, "scanner_result"),
    ...pickSafeWorkerValue(input, "scanner_version"),
    ...pickScannerSignature(input),
    ...pickSafeWorkerValue(input, "scanner_error_type"),
    ...pickSafeWorkerValue(input, "vector_index_name"),
    ...pickSafeWorkerValue(input, "worker_status_code"),
  };
}

function pickSafeWorkerValue(
  metadata: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = metadata[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? { [key]: trimmed.slice(0, 200) } : {};
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { [key]: value };
  }
  if (typeof value === "boolean" || value === null) {
    return { [key]: value };
  }
  return {};
}

function pickScannerSignature(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const scannerResult = metadata["scanner_result"];
  if (scannerResult === "clean") {
    return {};
  }
  return pickSafeWorkerValue(metadata, "scanner_signature");
}

export function parseDocumentIdFromIdempotencySource(source: string): string {
  const [documentPart] = source.split(":storage:");
  return documentPart?.startsWith("document:")
    ? documentPart.slice("document:".length)
    : "";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
