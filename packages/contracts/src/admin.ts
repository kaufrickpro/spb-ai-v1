import { z } from "zod";
import {
  EligibilityStatusSchema,
  IsoDateTimeSchema,
  ReviewOutcomeSchema,
  UuidSchema,
} from "./common.js";
import { ProfileResponseSchema, ProfileSchema } from "./profiles.js";
import { DocumentProcessingFailureCodeSchema } from "./documents.js";

export const AdminEntityTypeSchema = z.enum([
  "profile",
  "manuscript",
  "document",
  "publisher_change_request",
]);

export const AdminReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const AdminExceptionQueueSchema = z.enum([
  "needs_review",
  "quarantine",
  "reports",
  "system_failures",
]);

export const AdminAccessStatusSchema = z.enum([
  "no_access",
  "mfa_required",
  "allowed",
  "revoked",
]);

export const AdminRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const AdminReviewQueueItemSchema = z.object({
  id: UuidSchema,
  entityType: AdminEntityTypeSchema,
  entityId: UuidSchema,
  status: AdminReviewStatusSchema,
  exceptionQueue: AdminExceptionQueueSchema.default("needs_review"),
  eligibilityStatus: EligibilityStatusSchema.default("limited"),
  reviewOutcome: ReviewOutcomeSchema.default("needs_review"),
  riskLevel: AdminRiskLevelSchema,
  summary: z.string().trim().min(1).max(500),
  source: z.string().trim().min(1).max(120).default("automated_checks"),
  assigneeUserId: UuidSchema.nullable().default(null),
  decidedByUserId: UuidSchema.nullable().default(null),
  decisionNote: z.string().trim().max(1000).nullable().default(null),
  lastSignalAt: IsoDateTimeSchema.nullable().default(null),
  submittedAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const AdminAuditLogSchema = z.object({
  id: UuidSchema,
  actorUserId: UuidSchema,
  action: z.string().trim().min(1).max(120),
  targetType: AdminEntityTypeSchema,
  targetId: UuidSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateTimeSchema,
});

export const AdminDashboardResponseSchema = z.object({
  summary: z.object({
    exceptionQueues: z.object({
      needsReview: z.number().int().nonnegative(),
      quarantine: z.number().int().nonnegative(),
      reports: z.number().int().nonnegative(),
      systemFailures: z.number().int().nonnegative(),
    }),
    automationHealth: z.object({
      autoApproved: z.number().int().nonnegative(),
      needsReview: z.number().int().nonnegative(),
      quarantined: z.number().int().nonnegative(),
      autoApprovalRate: z.number().min(0).max(1),
    }),
    riskHotlist: z.array(AdminReviewQueueItemSchema),
    systemHealth: z.object({
      failedJobs: z.number().int().nonnegative(),
      paymentFailures: z.number().int().nonnegative(),
      openTrustSignals: z.number().int().nonnegative(),
    }),
    reviewQueue: z.object({
      pendingCount: z.number().int().nonnegative(),
      highRiskCount: z.number().int().nonnegative(),
    }),
    jobHealth: z.object({
      queued: z.number().int().nonnegative(),
      running: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      lastRunAt: IsoDateTimeSchema.nullable(),
    }),
    paymentHealth: z.object({
      recentFailures: z.number().int().nonnegative(),
      lastEventAt: IsoDateTimeSchema.nullable(),
    }),
    trustSafety: z.object({
      pendingProfiles: z.number().int().nonnegative(),
      rejectedProfiles: z.number().int().nonnegative(),
      flaggedProfiles: z.number().int().nonnegative(),
    }),
    recentAuditLogs: z.array(AdminAuditLogSchema),
  }),
});

export const AdminAccessResponseSchema = z.object({
  access: z.boolean(),
  status: AdminAccessStatusSchema,
  mfaVerified: z.boolean(),
});

export const PendingProfileSchema = ProfileSchema.extend({
  approvalStatus: z.literal("pending"),
});

export const AdminPendingProfilesResponseSchema = z.object({
  profiles: z.array(PendingProfileSchema),
});

export const AdminProfileDecisionRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

export const AdminProfileDecisionResponseSchema = ProfileResponseSchema;

export const AdminReviewQueueResponseSchema = z.object({
  reviews: z.array(AdminReviewQueueItemSchema),
});

export const AdminReviewQueueQuerySchema = z.object({
  entityType: AdminEntityTypeSchema.optional(),
  status: AdminReviewStatusSchema.optional(),
  riskLevel: AdminRiskLevelSchema.optional(),
  exceptionQueue: AdminExceptionQueueSchema.optional(),
  eligibilityStatus: EligibilityStatusSchema.optional(),
  reviewOutcome: ReviewOutcomeSchema.optional(),
});

export const AdminReviewDetailResponseSchema = z.object({
  review: AdminReviewQueueItemSchema,
  submittedFields: z.record(z.string(), z.unknown()),
  riskWarnings: z.array(z.string().trim().min(1).max(280)),
  relatedEvents: z.array(
    z.object({
      label: z.string().trim().min(1).max(280),
      createdAt: IsoDateTimeSchema,
    }),
  ),
  auditHistory: z.array(AdminAuditLogSchema),
  decisionNotesRequired: z.boolean().default(true),
});

export const AdminReviewDecisionRequestSchema = z
  .object({
    decision: z.enum([
      "approved",
      "rejected",
      "quarantined",
      "restored",
      "suspended",
    ]),
    internalNote: z.string().trim().min(5).max(1000).optional(),
    rejectionNote: z.string().trim().min(5).max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      ["rejected", "quarantined", "restored", "suspended"].includes(
        value.decision,
      ) &&
      !value.internalNote &&
      !value.rejectionNote
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "internalNote is required for sensitive admin decisions",
        path: ["internalNote"],
      });
    }
  });

export const AdminReviewDecisionResponseSchema = z.object({
  review: AdminReviewQueueItemSchema,
  auditLog: AdminAuditLogSchema,
});

export const AdminAuditLogsResponseSchema = z.object({
  logs: z.array(AdminAuditLogSchema),
});

export const AdminJobTypeSchema = z.enum([
  "document_ingestion",
  "matching",
  "billing_sync",
  "email_delivery",
]);

export const AdminJobRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const AdminJobRunSchema = z.object({
  id: UuidSchema,
  jobType: AdminJobTypeSchema,
  status: AdminJobRunStatusSchema,
  source: z.string().trim().min(1).max(260),
  errorMessage: z.string().trim().max(1000).nullable(),
  failureCode: DocumentProcessingFailureCodeSchema.nullable().default(null),
  attemptCount: z.number().int().nonnegative().nullable().default(null),
  maxAttempts: z.number().int().positive().nullable().default(null),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const AdminJobHealthResponseSchema = z.object({
  summary: AdminDashboardResponseSchema.shape.summary.shape.jobHealth,
  runs: z.array(AdminJobRunSchema),
});

export const AdminPaymentProviderSchema = z.enum(["paytr", "manual"]);
export const AdminPaymentEventStatusSchema = z.enum([
  "processed",
  "failed",
  "pending",
]);

export const AdminPaymentEventSchema = z.object({
  id: UuidSchema,
  provider: AdminPaymentProviderSchema,
  eventType: z.string().trim().min(1).max(120),
  status: AdminPaymentEventStatusSchema,
  failureReason: z.string().trim().max(1000).nullable(),
  occurredAt: IsoDateTimeSchema,
});

export const AdminPaymentHealthResponseSchema = z.object({
  summary: AdminDashboardResponseSchema.shape.summary.shape.paymentHealth,
  events: z.array(AdminPaymentEventSchema),
});

export const AdminTrustSignalTypeSchema = z.enum([
  "fraud_report",
  "policy_violation",
  "identity_mismatch",
  "spam",
]);

export const AdminTrustSignalSeveritySchema = z.enum(["low", "medium", "high"]);
export const AdminTrustSignalStatusSchema = z.enum(["open", "resolved"]);

export const AdminTrustSignalSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema.nullable(),
  signalType: AdminTrustSignalTypeSchema,
  severity: AdminTrustSignalSeveritySchema,
  status: AdminTrustSignalStatusSchema,
  note: z.string().trim().min(1).max(1000),
  createdAt: IsoDateTimeSchema,
});

export const AdminTrustSafetyResponseSchema = z.object({
  summary: AdminDashboardResponseSchema.shape.summary.shape.trustSafety,
  signals: z.array(AdminTrustSignalSchema),
});

export type AdminAuditLog = z.infer<typeof AdminAuditLogSchema>;
export type AdminAccessResponse = z.infer<typeof AdminAccessResponseSchema>;
export type AdminAccessStatus = z.infer<typeof AdminAccessStatusSchema>;
export type AdminExceptionQueue = z.infer<typeof AdminExceptionQueueSchema>;
export type PendingProfile = z.infer<typeof PendingProfileSchema>;
export type AdminPendingProfilesResponse = z.infer<
  typeof AdminPendingProfilesResponseSchema
>;
export type AdminProfileDecisionRequest = z.infer<
  typeof AdminProfileDecisionRequestSchema
>;
export type AdminProfileDecisionResponse = z.infer<
  typeof AdminProfileDecisionResponseSchema
>;
export type AdminDashboardResponse = z.infer<
  typeof AdminDashboardResponseSchema
>;
export type AdminEntityType = z.infer<typeof AdminEntityTypeSchema>;
export type AdminReviewDecisionRequest = z.infer<
  typeof AdminReviewDecisionRequestSchema
>;
export type AdminReviewDecisionResponse = z.infer<
  typeof AdminReviewDecisionResponseSchema
>;
export type AdminReviewDetailResponse = z.infer<
  typeof AdminReviewDetailResponseSchema
>;
export type AdminReviewQueueItem = z.infer<typeof AdminReviewQueueItemSchema>;
export type AdminReviewQueueQuery = z.infer<typeof AdminReviewQueueQuerySchema>;
export type AdminReviewQueueResponse = z.infer<
  typeof AdminReviewQueueResponseSchema
>;
export type AdminReviewStatus = z.infer<typeof AdminReviewStatusSchema>;
export type AdminJobRun = z.infer<typeof AdminJobRunSchema>;
export type AdminJobHealthResponse = z.infer<
  typeof AdminJobHealthResponseSchema
>;
export type AdminPaymentEvent = z.infer<typeof AdminPaymentEventSchema>;
export type AdminPaymentHealthResponse = z.infer<
  typeof AdminPaymentHealthResponseSchema
>;
export type AdminTrustSignal = z.infer<typeof AdminTrustSignalSchema>;
export type AdminTrustSafetyResponse = z.infer<
  typeof AdminTrustSafetyResponseSchema
>;
