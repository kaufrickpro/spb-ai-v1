import type { FastifyReply } from "fastify";
import { AdminReviewDetailResponseSchema } from "@marketplace/contracts";
import {
  sendForbidden,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { AuthDependencies } from "../auth/requestAuth.js";
import { requireAdminUser } from "../auth/requestAuth.js";
import {
  createServiceRoleSupabaseClient,
  createUserSupabaseClient,
} from "../supabase/client.js";
import { AdminReviewDecisionError } from "./service.js";

type AdminUser = NonNullable<Awaited<ReturnType<typeof requireAdminUser>>>;

export function createAdminUserDb(auth: AuthDependencies, user: AdminUser) {
  return createUserSupabaseClient(
    auth.config.supabaseUrl!,
    auth.config.supabaseAnonKey!,
    user.jwt,
  );
}

export function createAdminServiceDb(auth: AuthDependencies) {
  return createServiceRoleSupabaseClient(
    auth.config.supabaseUrl!,
    auth.config.supabaseServiceRoleKey!,
  );
}

export function sendAdminReviewDecisionError(
  reply: FastifyReply,
  error: AdminReviewDecisionError,
) {
  if (error.kind === "not_found") {
    return sendNotFound(reply, "Review not found");
  }
  if (error.kind === "forbidden") {
    return sendForbidden(reply);
  }
  if (error.kind === "invalid") {
    return sendValidationError(reply, error.message, []);
  }

  return null;
}

export function parseReviewId(
  params: unknown,
  reply: FastifyReply,
): string | null {
  const parsed =
    AdminReviewDetailResponseSchema.shape.review.shape.id.safeParse(
      (params as { reviewId?: string }).reviewId,
    );

  if (!parsed.success) {
    sendValidationError(reply, "Invalid review id", parsed.error.issues);
    return null;
  }

  return parsed.data;
}

export function parseProfileId(
  params: unknown,
  reply: FastifyReply,
): string | null {
  const parsed =
    AdminReviewDetailResponseSchema.shape.review.shape.entityId.safeParse(
      (params as { profileId?: string }).profileId,
    );

  if (!parsed.success) {
    sendValidationError(reply, "Invalid profile id", parsed.error.issues);
    return null;
  }

  return parsed.data;
}

export function buildReviewRelatedEvents(row: Record<string, unknown>) {
  const submittedAt =
    typeof row.submitted_at === "string"
      ? row.submitted_at
      : typeof row.created_at === "string"
        ? row.created_at
        : null;
  const decidedAt = typeof row.decided_at === "string" ? row.decided_at : null;
  const entityType = typeof row.entity_type === "string" ? row.entity_type : "";
  const status = typeof row.status === "string" ? row.status : "";
  const events: Array<{ label: string; createdAt: string }> = [];

  if (submittedAt) {
    events.push({
      label:
        entityType === "document"
          ? "Upload completed"
          : entityType === "manuscript"
            ? "Metadata submitted"
            : "Review submitted",
      createdAt: submittedAt,
    });
  }

  if (entityType === "document" && submittedAt) {
    events.push({
      label: "Processing pending",
      createdAt: submittedAt,
    });
  }

  if (decidedAt && (status === "approved" || status === "rejected")) {
    events.push({
      label: `Prior decision: ${status}`,
      createdAt: decidedAt,
    });
  }

  return events;
}
