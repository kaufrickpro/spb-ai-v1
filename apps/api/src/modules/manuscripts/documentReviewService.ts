import { AdminReviewQueueItemSchema } from "@marketplace/contracts";
import { randomUUID } from "node:crypto";
import type { AdminTestState } from "../admin/testState.js";
import type { AuthorRequestContext } from "./access.js";
import { ManuscriptServiceError } from "./errors.js";

export function queueTestDocumentReview(
  adminTestState: AdminTestState,
  document: {
    id: string;
    originalFileName: string;
    updatedAt: string;
  },
): void {
  adminTestState.reviews.unshift(
    AdminReviewQueueItemSchema.parse({
      id: randomUUID(),
      entityType: "document",
      entityId: document.id,
      status: "pending",
      riskLevel: "low",
      summary: `Sample document uploaded: ${document.originalFileName}`,
      submittedAt: document.updatedAt,
      updatedAt: document.updatedAt,
    }),
  );
}

export async function createDocumentAdminReview(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: {
    authorId: string;
    documentId: string;
    fileSizeBytes: number;
    mimeType: string;
    originalFileName: string;
  },
): Promise<void> {
  const result = await context.serviceDb.from("admin_reviews").insert({
    entity_type: "document",
    entity_id: input.documentId,
    status: "pending",
    risk_level: "low",
    summary: `Sample document uploaded: ${input.originalFileName}`,
    submitted_by_user_id: input.authorId,
    submitted_fields: {
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    },
  });

  if (result.error) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to create document review",
      result.error,
    );
  }
}
