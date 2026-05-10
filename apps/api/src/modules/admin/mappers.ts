import {
  AdminAuditLogSchema,
  AdminJobRunSchema,
  AdminPaymentEventSchema,
  AdminReviewQueueItemSchema,
  AdminTrustSignalSchema,
  type AdminAuditLog,
  type AdminJobRun,
  type AdminPaymentEvent,
  type AdminReviewQueueItem,
  type AdminTrustSignal,
} from "@marketplace/contracts";

export function mapDbAdminReview(
  row: Record<string, unknown>,
): AdminReviewQueueItem {
  return AdminReviewQueueItemSchema.parse({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    exceptionQueue: row.exception_queue ?? "needs_review",
    eligibilityStatus: row.eligibility_status ?? "limited",
    reviewOutcome: row.review_outcome ?? "needs_review",
    riskLevel: row.risk_level,
    summary: row.summary,
    source: row.source ?? "automated_checks",
    assigneeUserId:
      typeof row.assignee_user_id === "string" ? row.assignee_user_id : null,
    decidedByUserId:
      typeof row.decided_by_user_id === "string"
        ? row.decided_by_user_id
        : null,
    decisionNote:
      typeof row.rejection_note === "string" ? row.rejection_note : null,
    lastSignalAt:
      typeof row.last_signal_at === "string"
        ? toContractDateTime(row.last_signal_at)
        : null,
    submittedAt: toContractDateTime(row.submitted_at),
    updatedAt: toContractDateTime(row.updated_at),
  });
}

export function mapDbAdminAuditLog(
  row: Record<string, unknown>,
): AdminAuditLog {
  return AdminAuditLogSchema.parse({
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata,
    createdAt: toContractDateTime(row.created_at),
  });
}

export function mapDbAdminJobRun(row: Record<string, unknown>): AdminJobRun {
  return AdminJobRunSchema.parse({
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    source: row.source,
    errorMessage: row.error_message,
    failureCode:
      typeof row.failure_code === "string"
        ? row.failure_code
        : extractFailureCode(row.metadata),
    attemptCount:
      typeof row.attempt_count === "number" ? row.attempt_count : null,
    maxAttempts: typeof row.max_attempts === "number" ? row.max_attempts : null,
    createdAt: toContractDateTime(row.created_at),
    updatedAt: toContractDateTime(row.updated_at),
  });
}

function extractFailureCode(metadata: unknown): string | null {
  if (
    metadata &&
    typeof metadata === "object" &&
    "failure_code" in metadata &&
    typeof metadata.failure_code === "string"
  ) {
    return metadata.failure_code;
  }

  return null;
}

export function mapDbAdminPaymentEvent(
  row: Record<string, unknown>,
): AdminPaymentEvent {
  return AdminPaymentEventSchema.parse({
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    profileId: row.profile_id ?? null,
    subscriptionId: row.subscription_id ?? null,
    eventType: row.event_type,
    status: mapPaymentEventStatus(row),
    failureReason:
      row.processing_status === "failed" ? "Payment event failed" : null,
    safePayload: row.safe_payload ?? {},
    occurredAt: toContractDateTime(row.created_at ?? row.occurred_at),
  });
}

function mapPaymentEventStatus(row: Record<string, unknown>) {
  const status = row.processing_status ?? row.status;
  if (status === "stored") return "pending";
  return status;
}

export function mapDbAdminTrustSignal(
  row: Record<string, unknown>,
): AdminTrustSignal {
  return AdminTrustSignalSchema.parse({
    id: row.id,
    profileId: row.profile_id,
    signalType: row.signal_type,
    severity: row.severity,
    status: row.status,
    note: row.note,
    createdAt: toContractDateTime(row.created_at),
  });
}

function toContractDateTime(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}
