import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const IntroRequestStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);

export const IntroStateStatusSchema = z.enum([
  "can_request",
  "pending_sent",
  "pending_received",
  "accepted",
  "rejected_cooldown",
  "cancelled_cooldown",
  "not_eligible",
  "trial_required",
  "entitlement_expired",
  "subscription_required",
  "quota_exhausted",
]);

export const INTRO_REQUEST_DAILY_LIMIT = 10;
export const INTRO_REQUEST_COOLDOWN_DAYS = 14;
export const INTRO_REQUEST_LIST_MAX_LIMIT = 100;

export const IntroStateSchema = z.object({
  status: IntroStateStatusSchema,
  requestId: UuidSchema.nullable(),
  viewerCanAccept: z.boolean().default(false),
  viewerCanReject: z.boolean().default(false),
  viewerCanCancel: z.boolean().default(false),
  cooldownUntil: IsoDateTimeSchema.nullable().default(null),
  quotaRemaining: z.number().int().nonnegative().nullable().default(null),
});

export const CreateIntroRequestRequestSchema = z
  .object({
    manuscriptId: UuidSchema,
    publisherProfileId: UuidSchema,
    message: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export const RejectIntroRequestRequestSchema = z
  .object({
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const AcceptedIntroContactSchema = z.object({
  profileId: UuidSchema,
  displayName: z.string().trim().min(1).max(120),
  role: z.enum(["author", "publisher"]),
  email: z.string().trim().email().max(254).nullable(),
  phone: z.string().trim().min(3).max(40).nullable(),
  websiteUrl: z.string().trim().url().max(2048).nullable(),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z.string().trim().url().max(2048),
      }),
    )
    .max(8),
});

export const IntroRequestSchema = z.object({
  id: UuidSchema,
  manuscriptId: UuidSchema,
  manuscriptTitle: z.string().trim().min(1).max(200),
  authorProfileId: UuidSchema,
  authorName: z.string().trim().min(1).max(120),
  publisherProfileId: UuidSchema,
  publisherName: z.string().trim().min(1).max(120),
  requesterProfileId: UuidSchema,
  requesterName: z.string().trim().min(1).max(120),
  recipientProfileId: UuidSchema,
  recipientName: z.string().trim().min(1).max(120),
  status: IntroRequestStatusSchema,
  viewerRelation: z.enum(["requester", "recipient"]),
  message: z.string().trim().max(1000).nullable(),
  note: z.string().trim().max(500).nullable(),
  introState: IntroStateSchema,
  acceptedIntroContact: AcceptedIntroContactSchema.nullable().default(null),
  publisherSampleUnlocked: z.boolean().default(false),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  respondedAt: IsoDateTimeSchema.nullable().default(null),
});

export const IntroRequestResponseSchema = z.object({
  request: IntroRequestSchema,
});

export const IntroRequestListQuerySchema = z.object({
  box: z.enum(["sent", "received", "all"]).optional().default("all"),
  status: z
    .union([IntroRequestStatusSchema, z.literal("all")])
    .optional()
    .default("all"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(INTRO_REQUEST_LIST_MAX_LIMIT)
    .optional()
    .default(50),
});

export const IntroRequestListResponseSchema = z.object({
  requests: z.array(IntroRequestSchema),
});

export const AdminIntroRequestListQuerySchema =
  IntroRequestListQuerySchema.extend({
    requesterRole: z.enum(["author", "publisher"]).optional(),
    manuscriptId: UuidSchema.optional(),
    authorProfileId: UuidSchema.optional(),
    publisherProfileId: UuidSchema.optional(),
    createdFrom: IsoDateTimeSchema.optional(),
    createdTo: IsoDateTimeSchema.optional(),
  });

export const AdminIntroRequestSummarySchema = z.object({
  id: UuidSchema,
  manuscriptId: UuidSchema,
  manuscriptTitle: z.string().trim().min(1).max(200),
  authorProfileId: UuidSchema,
  authorName: z.string().trim().min(1).max(120),
  publisherProfileId: UuidSchema,
  publisherName: z.string().trim().min(1).max(120),
  requesterProfileId: UuidSchema,
  requesterRole: z.enum(["author", "publisher"]),
  recipientProfileId: UuidSchema,
  status: IntroRequestStatusSchema,
  currentUnlockStatus: z.object({
    contact: z.boolean(),
    publisherSample: z.boolean(),
  }),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  respondedAt: IsoDateTimeSchema.nullable().default(null),
});

export const ProductAuditEventSchema = z.object({
  id: UuidSchema,
  actorProfileId: UuidSchema.nullable(),
  action: z.string().trim().min(1).max(120),
  targetType: z.string().trim().min(1).max(120),
  targetId: UuidSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: IsoDateTimeSchema,
});

export const AdminIntroRequestListResponseSchema = z.object({
  requests: z.array(AdminIntroRequestSummarySchema),
});

export const AdminIntroRequestDetailResponseSchema = z.object({
  request: AdminIntroRequestSummarySchema,
  timeline: z.array(ProductAuditEventSchema),
});

export type IntroRequestStatus = z.infer<typeof IntroRequestStatusSchema>;
export type IntroStateStatus = z.infer<typeof IntroStateStatusSchema>;
export type IntroState = z.infer<typeof IntroStateSchema>;
export type CreateIntroRequestRequest = z.infer<
  typeof CreateIntroRequestRequestSchema
>;
export type RejectIntroRequestRequest = z.infer<
  typeof RejectIntroRequestRequestSchema
>;
export type AcceptedIntroContact = z.infer<typeof AcceptedIntroContactSchema>;
export type IntroRequest = z.infer<typeof IntroRequestSchema>;
export type IntroRequestListQuery = z.infer<typeof IntroRequestListQuerySchema>;
export type AdminIntroRequestListQuery = z.infer<
  typeof AdminIntroRequestListQuerySchema
>;
export type AdminIntroRequestSummary = z.infer<
  typeof AdminIntroRequestSummarySchema
>;
export type ProductAuditEvent = z.infer<typeof ProductAuditEventSchema>;
