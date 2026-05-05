import {
  AdminJobRunSchema,
  AdminPaymentEventSchema,
  AdminReviewQueueItemSchema,
  AdminTrustSignalSchema,
  ProfileSchema,
  type AdminAuditLog,
  type AdminJobRun,
  type AdminPaymentEvent,
  type Profile,
  type AdminReviewQueueItem,
  type AdminTrustSignal,
} from "@marketplace/contracts";

export const TEST_ADMIN_PROFILE_REVIEW_ID =
  "00000000-0000-4000-8000-000000000111";
export const TEST_ADMIN_PROFILE_TARGET_ID =
  "00000000-0000-4000-8000-000000000211";

export type AdminTestState = {
  profiles: Profile[];
  reviews: AdminReviewQueueItem[];
  jobRuns: AdminJobRun[];
  paymentEvents: AdminPaymentEvent[];
  trustSignals: AdminTrustSignal[];
  auditLogs: AdminAuditLog[];
};

export function createAdminTestState(): AdminTestState {
  return {
    profiles: [
      ProfileSchema.parse({
        id: TEST_ADMIN_PROFILE_TARGET_ID,
        userId: "00000000-0000-4000-8000-000000000310",
        role: "author",
        displayName: "Ayşe Yılmaz",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        approvalStatus: "pending",
        locale: "tr",
        createdAt: new Date("2026-05-01T08:00:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:00:00.000Z").toISOString(),
      }),
      ProfileSchema.parse({
        id: "00000000-0000-4000-8000-000000000212",
        userId: "00000000-0000-4000-8000-000000000311",
        role: "publisher",
        displayName: "İstanbul Kitapları",
        profilePhotoUrl: null,
        signupIntent: "discover_manuscripts",
        approvalStatus: "pending",
        locale: "en",
        createdAt: new Date("2026-05-01T08:05:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:05:00.000Z").toISOString(),
      }),
    ],
    reviews: [
      AdminReviewQueueItemSchema.parse({
        id: TEST_ADMIN_PROFILE_REVIEW_ID,
        entityType: "profile",
        entityId: TEST_ADMIN_PROFILE_TARGET_ID,
        status: "pending",
        exceptionQueue: "needs_review",
        eligibilityStatus: "limited",
        reviewOutcome: "needs_review",
        riskLevel: "high",
        source: "automated_checks",
        summary: "Author profile is waiting for first moderation pass",
        assigneeUserId: null,
        decidedByUserId: null,
        decisionNote: null,
        lastSignalAt: new Date("2026-05-01T08:00:00.000Z").toISOString(),
        submittedAt: new Date("2026-05-01T08:00:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:00:00.000Z").toISOString(),
      }),
      AdminReviewQueueItemSchema.parse({
        id: "00000000-0000-4000-8000-000000000112",
        entityType: "manuscript",
        entityId: "00000000-0000-4000-8000-000000000212",
        status: "pending",
        exceptionQueue: "needs_review",
        eligibilityStatus: "limited",
        reviewOutcome: "needs_review",
        riskLevel: "medium",
        source: "automated_checks",
        summary: "Manuscript sample requires rights metadata confirmation",
        assigneeUserId: null,
        decidedByUserId: null,
        decisionNote: null,
        lastSignalAt: new Date("2026-05-01T08:10:00.000Z").toISOString(),
        submittedAt: new Date("2026-05-01T08:10:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:10:00.000Z").toISOString(),
      }),
      AdminReviewQueueItemSchema.parse({
        id: "00000000-0000-4000-8000-000000000113",
        entityType: "document",
        entityId: "00000000-0000-4000-8000-000000000213",
        status: "pending",
        exceptionQueue: "quarantine",
        eligibilityStatus: "quarantined",
        reviewOutcome: "quarantined",
        riskLevel: "low",
        source: "document_ingestion",
        summary: "Document text extraction quality check is pending",
        assigneeUserId: null,
        decidedByUserId: null,
        decisionNote: null,
        lastSignalAt: new Date("2026-05-01T08:20:00.000Z").toISOString(),
        submittedAt: new Date("2026-05-01T08:20:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:20:00.000Z").toISOString(),
      }),
      AdminReviewQueueItemSchema.parse({
        id: "00000000-0000-4000-8000-000000000114",
        entityType: "publisher_change_request",
        entityId: "00000000-0000-4000-8000-000000000214",
        status: "pending",
        exceptionQueue: "needs_review",
        eligibilityStatus: "limited",
        reviewOutcome: "needs_review",
        riskLevel: "high",
        source: "automated_checks",
        summary:
          "Publisher preference change request flagged for manual review",
        assigneeUserId: null,
        decidedByUserId: null,
        decisionNote: null,
        lastSignalAt: new Date("2026-05-01T08:30:00.000Z").toISOString(),
        submittedAt: new Date("2026-05-01T08:30:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:30:00.000Z").toISOString(),
      }),
    ],
    jobRuns: [
      AdminJobRunSchema.parse({
        id: "00000000-0000-4000-8000-000000000311",
        jobType: "document_ingestion",
        status: "failed",
        source: "cloud-tasks",
        errorMessage: "Chunk count exceeded retry threshold",
        createdAt: new Date("2026-05-01T07:40:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T07:45:00.000Z").toISOString(),
      }),
      AdminJobRunSchema.parse({
        id: "00000000-0000-4000-8000-000000000312",
        jobType: "matching",
        status: "running",
        source: "queue-worker",
        errorMessage: null,
        createdAt: new Date("2026-05-01T08:35:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:40:00.000Z").toISOString(),
      }),
      AdminJobRunSchema.parse({
        id: "00000000-0000-4000-8000-000000000313",
        jobType: "email_delivery",
        status: "queued",
        source: "resend-dispatch",
        errorMessage: null,
        createdAt: new Date("2026-05-01T08:41:00.000Z").toISOString(),
        updatedAt: new Date("2026-05-01T08:41:00.000Z").toISOString(),
      }),
    ],
    paymentEvents: [
      AdminPaymentEventSchema.parse({
        id: "00000000-0000-4000-8000-000000000411",
        provider: "paytr",
        eventType: "subscription.renewed",
        status: "processed",
        failureReason: null,
        occurredAt: new Date("2026-05-01T07:10:00.000Z").toISOString(),
      }),
      AdminPaymentEventSchema.parse({
        id: "00000000-0000-4000-8000-000000000412",
        provider: "paytr",
        eventType: "subscription.failed",
        status: "failed",
        failureReason: "3d_secure_timeout",
        occurredAt: new Date("2026-05-01T07:55:00.000Z").toISOString(),
      }),
    ],
    trustSignals: [
      AdminTrustSignalSchema.parse({
        id: "00000000-0000-4000-8000-000000000511",
        profileId: TEST_ADMIN_PROFILE_TARGET_ID,
        signalType: "identity_mismatch",
        severity: "high",
        status: "open",
        note: "Profile legal name does not match verification document",
        createdAt: new Date("2026-05-01T07:50:00.000Z").toISOString(),
      }),
    ],
    auditLogs: [],
  };
}
