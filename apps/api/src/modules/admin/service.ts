import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminReviewDecisionRequest,
  AdminReviewDecisionResponse,
  AdminReviewQueueItem,
  AdminReviewQueueQuery,
} from "@marketplace/contracts";
import { mapDbAdminAuditLog, mapDbAdminReview } from "./mappers.js";
import type { AdminTestState } from "./testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import {
  buildReviewDecisionAuditLog,
  updateTestReviewedEntityLifecycle,
} from "./reviewTestSupport.js";

export class AdminReviewDecisionError extends Error {
  constructor(
    readonly kind: "not_found" | "forbidden" | "invalid" | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}

export async function applyAdminReviewDecision(
  db: SupabaseClient,
  input: {
    actorUserId: string;
    decision: AdminReviewDecisionRequest;
    reviewId: string;
  },
): Promise<AdminReviewDecisionResponse> {
  const { data, error } = await db.rpc("apply_admin_review_decision", {
    p_actor_user_id: input.actorUserId,
    p_decision: input.decision.decision,
    p_rejection_note:
      input.decision.internalNote ?? input.decision.rejectionNote ?? null,
    p_review_id: input.reviewId,
  });

  if (error) {
    throw mapAdminReviewDecisionError(error);
  }

  const result = data as {
    auditLog?: Record<string, unknown>;
    review?: Record<string, unknown>;
  } | null;

  if (!result?.review || !result.auditLog) {
    throw new AdminReviewDecisionError(
      "storage",
      "Admin review decision did not return review and audit log rows",
    );
  }

  return {
    review: mapDbAdminReview(result.review),
    auditLog: mapDbAdminAuditLog(result.auditLog),
  };
}

export function applyTestAdminReviewDecision(
  state: AdminTestState,
  manuscriptState: ManuscriptTestState,
  input: {
    actorUserId: string;
    decision: AdminReviewDecisionRequest;
    now: string;
    reviewId: string;
    auditLogId: string;
  },
): AdminReviewDecisionResponse {
  const reviewIndex = state.reviews.findIndex(
    (item) => item.id === input.reviewId,
  );
  if (reviewIndex < 0) {
    throw new AdminReviewDecisionError("not_found", "Review not found");
  }

  const status: "approved" | "rejected" =
    input.decision.decision === "approved" ? "approved" : "rejected";
  const eligibilityStatus = decisionToEligibilityStatus(
    input.decision.decision,
  );
  const reviewOutcome = decisionToReviewOutcome(input.decision.decision);
  const review = {
    ...state.reviews[reviewIndex],
    status,
    decidedByUserId: input.actorUserId,
    decisionNote:
      input.decision.internalNote ?? input.decision.rejectionNote ?? null,
    eligibilityStatus,
    exceptionQueue:
      input.decision.decision === "quarantined"
        ? "quarantine"
        : state.reviews[reviewIndex].exceptionQueue,
    reviewOutcome,
    updatedAt: input.now,
  };
  state.reviews[reviewIndex] = review;

  const auditLog = buildReviewDecisionAuditLog({
    actorUserId: input.actorUserId,
    auditLogId: input.auditLogId,
    decision: input.decision,
    now: input.now,
    review,
    reviewId: input.reviewId,
  });
  state.auditLogs.unshift(auditLog);

  updateTestProfileLifecycle(state, review, {
    decision: input.decision.decision,
    now: input.now,
  });
  updateTestReviewedEntityLifecycle(manuscriptState, review, {
    decision: input.decision.decision,
    now: input.now,
  });

  return { review, auditLog };
}

function updateTestProfileLifecycle(
  state: AdminTestState,
  review: AdminReviewDecisionResponse["review"],
  input: { decision: AdminReviewDecisionRequest["decision"]; now: string },
): void {
  if (review.entityType !== "profile") {
    return;
  }

  const profileIndex = state.profiles.findIndex(
    (profile) => profile.id === review.entityId,
  );
  if (profileIndex < 0) {
    return;
  }

  state.profiles[profileIndex] = {
    ...state.profiles[profileIndex],
    approvalStatus: input.decision === "approved" ? "approved" : "rejected",
    eligibilityStatus:
      input.decision === "approved" || input.decision === "restored"
        ? "eligible"
        : input.decision === "quarantined"
          ? "quarantined"
          : "blocked",
    reviewOutcome:
      input.decision === "approved" || input.decision === "restored"
        ? "admin_approved"
        : input.decision === "quarantined"
          ? "quarantined"
          : "admin_rejected",
    updatedAt: input.now,
  };
}

export function filterTestAdminReviews(
  state: AdminTestState,
  query: AdminReviewQueueQuery,
) {
  return state.reviews
    .filter((review) => {
      if (query.entityType && review.entityType !== query.entityType) {
        return false;
      }
      if (query.status && review.status !== query.status) {
        return false;
      }
      if (query.riskLevel && review.riskLevel !== query.riskLevel) {
        return false;
      }
      if (
        query.exceptionQueue &&
        review.exceptionQueue !== query.exceptionQueue
      ) {
        return false;
      }
      if (
        query.eligibilityStatus &&
        review.eligibilityStatus !== query.eligibilityStatus
      ) {
        return false;
      }
      if (query.reviewOutcome && review.reviewOutcome !== query.reviewOutcome) {
        return false;
      }
      return true;
    })
    .sort(compareAdminReviews)
    .slice(0, query.limit);
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function getAdminAuditLogs(db: SupabaseClient) {
  const { data, error } = await db
    .from("admin_audit_logs")
    .select()
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDbAdminAuditLog);
}

export async function getAdminReviewAuditHistory(
  db: SupabaseClient,
  entityType: string,
  entityId: string,
) {
  const { data, error } = await db
    .from("admin_audit_logs")
    .select()
    .eq("target_type", entityType)
    .eq("target_id", entityId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapDbAdminAuditLog);
}

export async function getAdminReviewQueue(
  db: SupabaseClient,
  query: AdminReviewQueueQuery,
) {
  const reviews: AdminReviewQueueItem[] = [];
  const riskLevels = query.riskLevel
    ? [query.riskLevel]
    : (["high", "medium", "low"] as const);
  const exceptionQueues = query.exceptionQueue
    ? [query.exceptionQueue]
    : (["quarantine", "needs_review", "reports", "system_failures"] as const);

  for (const riskLevel of riskLevels) {
    for (const exceptionQueue of exceptionQueues) {
      const remaining = query.limit - reviews.length;
      if (remaining <= 0) {
        return reviews;
      }

      let reviewQuery = db
        .from("admin_reviews")
        .select()
        .eq("risk_level", riskLevel)
        .eq("exception_queue", exceptionQueue)
        .order("submitted_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(remaining);

      if (query.entityType) {
        reviewQuery = reviewQuery.eq("entity_type", query.entityType);
      }
      if (query.status) {
        reviewQuery = reviewQuery.eq("status", query.status);
      }
      if (query.eligibilityStatus) {
        reviewQuery = reviewQuery.eq(
          "eligibility_status",
          query.eligibilityStatus,
        );
      }
      if (query.reviewOutcome) {
        reviewQuery = reviewQuery.eq("review_outcome", query.reviewOutcome);
      }

      const { data, error } = await reviewQuery;
      if (error) {
        throw error;
      }

      reviews.push(...(data ?? []).map(mapDbAdminReview));
    }
  }

  return reviews;
}

function compareAdminReviews(
  left: {
    id: string;
    riskLevel: string;
    exceptionQueue: string;
    submittedAt: string;
  },
  right: {
    id: string;
    riskLevel: string;
    exceptionQueue: string;
    submittedAt: string;
  },
) {
  const riskDelta = riskRank(right.riskLevel) - riskRank(left.riskLevel);
  if (riskDelta !== 0) return riskDelta;

  const queueDelta =
    queueRank(left.exceptionQueue) - queueRank(right.exceptionQueue);
  if (queueDelta !== 0) return queueDelta;

  const submittedAtDelta = left.submittedAt.localeCompare(right.submittedAt);
  if (submittedAtDelta !== 0) return submittedAtDelta;

  return left.id.localeCompare(right.id);
}

function riskRank(value: string) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function queueRank(value: string) {
  if (value === "quarantine") return 0;
  if (value === "needs_review") return 1;
  if (value === "reports") return 2;
  return 3;
}

function decisionToEligibilityStatus(
  decision: string,
): "eligible" | "limited" | "blocked" | "quarantined" {
  if (decision === "approved" || decision === "restored") return "eligible";
  if (decision === "quarantined") return "quarantined";
  return "blocked";
}

function decisionToReviewOutcome(
  decision: string,
):
  | "auto_approved"
  | "needs_review"
  | "admin_approved"
  | "admin_rejected"
  | "quarantined" {
  if (decision === "approved" || decision === "restored") {
    return "admin_approved";
  }
  if (decision === "quarantined") return "quarantined";
  return "admin_rejected";
}

function mapAdminReviewDecisionError(error: {
  code?: string;
  message?: string;
}): AdminReviewDecisionError {
  if (error.code === "P0002") {
    return new AdminReviewDecisionError("not_found", "Review not found", error);
  }
  if (error.code === "42501") {
    return new AdminReviewDecisionError("forbidden", "Forbidden", error);
  }
  if (error.code === "22023") {
    return new AdminReviewDecisionError(
      "invalid",
      error.message ?? "Invalid admin review decision",
      error,
    );
  }

  return new AdminReviewDecisionError(
    "storage",
    error.message ?? "Failed to apply admin review decision",
    error,
  );
}
