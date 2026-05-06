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
  const safeKeys = new Set([
    "chunk_count",
    "chunker",
    "embedding_model",
    "extracted_character_count",
    "failure_category",
    "failure_code",
    "ingestion_version",
    "scanner",
    "scanner_result",
    "vector_index_name",
    "worker_status_code",
  ]);
  return Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([key]) => safeKeys.has(key)),
  );
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
