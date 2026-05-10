import { z } from "zod";
import {
  IsoDateTimeSchema,
  ProfileRoleSchema,
  SlugSchema,
  UuidSchema,
} from "./common.js";

export const BillingPlanSlugSchema = z.enum([
  "author-trial",
  "publisher-trial",
  "author-pro-monthly",
  "author-pro-annual",
  "publisher-pro-monthly",
  "publisher-pro-annual",
]);

export const BillingSubscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const BillingPeriodSchema = z.enum(["trial", "monthly", "annual"]);
export const BillingPlanKindSchema = z.enum(["trial", "paid"]);
export const BillingSupportLevelSchema = z.enum(["standard", "priority"]);

export const EntitlementDenialReasonSchema = z.enum([
  "profile_not_found",
  "profile_not_eligible",
  "role_details_incomplete",
  "trial_not_started",
  "trial_already_used",
  "trial_expired",
  "subscription_inactive",
  "quota_exhausted",
  "storage_limit_exceeded",
  "role_not_allowed",
  "admin_not_allowed",
]);

export const EntitlementRecoveryActionSchema = z.enum([
  "complete_profile",
  "start_trial",
  "subscribe",
]);

export const EntitlementDenialSchema = z.object({
  reason: EntitlementDenialReasonSchema,
  recoveryAction: EntitlementRecoveryActionSchema.nullable(),
  message: z.string().trim().min(1).max(240),
});

export const EntitlementCapabilitySchema = z.object({
  allowed: z.boolean(),
  denial: EntitlementDenialSchema.nullable().default(null),
});

export const BillingPlanLimitsSchema = z.object({
  introRequestsPerPeriod: z.number().int().nonnegative(),
  storageBytes: z.number().int().nonnegative(),
  directoryVisibility: z.boolean(),
  supportLevel: BillingSupportLevelSchema,
});

export const BillingPlanSchema = z.object({
  id: UuidSchema.optional(),
  slug: BillingPlanSlugSchema,
  role: ProfileRoleSchema,
  kind: BillingPlanKindSchema,
  billingPeriod: BillingPeriodSchema,
  displayName: z.string().trim().min(1).max(120),
  limits: BillingPlanLimitsSchema,
  checkoutEnabled: z.boolean().default(false),
});

export const PaytrCheckoutRequestSchema = z.object({
  planSlug: BillingPlanSlugSchema,
});

export const PaytrCheckoutTokenSchema = z.object({
  provider: z.literal("paytr"),
  token: z.string().trim().min(1),
  iframeUrl: z.string().url(),
  orderId: z.string().trim().min(1).max(64),
  plan: BillingPlanSchema,
  expiresAt: IsoDateTimeSchema.nullable().default(null),
});

export const PaytrCheckoutResponseSchema = z.object({
  checkout: PaytrCheckoutTokenSchema,
});

export const BillingSubscriptionSchema = z.object({
  id: UuidSchema,
  profileId: UuidSchema,
  userId: UuidSchema,
  plan: BillingPlanSchema,
  status: BillingSubscriptionStatusSchema,
  currentPeriodStart: IsoDateTimeSchema,
  currentPeriodEnd: IsoDateTimeSchema,
  trialStartedAt: IsoDateTimeSchema.nullable().default(null),
  trialEndsAt: IsoDateTimeSchema.nullable().default(null),
});

export const BillingTrialSummarySchema = z.object({
  available: z.boolean(),
  used: z.boolean(),
  startedAt: IsoDateTimeSchema.nullable().default(null),
  endsAt: IsoDateTimeSchema.nullable().default(null),
});

export const BillingEntitlementStatusSchema = z.enum([
  "profile_required",
  "profile_incomplete",
  "trial_available",
  "trialing",
  "active",
  "expired",
  "inactive",
]);

export const BillingCapabilitiesSchema = z.object({
  startTrial: EntitlementCapabilitySchema,
  uploadSample: EntitlementCapabilitySchema,
  runMatch: EntitlementCapabilitySchema,
  sendIntroRequest: EntitlementCapabilitySchema,
  publicDirectoryVisibility: EntitlementCapabilitySchema,
});

export const BillingSubscriptionSummarySchema = z.object({
  profileId: UuidSchema.nullable(),
  role: ProfileRoleSchema.nullable(),
  entitlementStatus: BillingEntitlementStatusSchema,
  active: z.boolean(),
  trial: BillingTrialSummarySchema,
  currentSubscription: BillingSubscriptionSchema.nullable(),
  activePlan: BillingPlanSchema.nullable(),
  capabilities: BillingCapabilitiesSchema,
  plans: z.array(BillingPlanSchema),
});

export const BillingUsageMeterSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  periodStart: IsoDateTimeSchema.nullable().default(null),
  periodEnd: IsoDateTimeSchema.nullable().default(null),
});

export const BillingStorageMeterSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  limitBytes: z.number().int().nonnegative(),
  remainingBytes: z.number().int().nonnegative(),
});

export const BillingUsageSummarySchema = z.object({
  profileId: UuidSchema.nullable(),
  introRequests: BillingUsageMeterSchema,
  storage: BillingStorageMeterSchema,
  directoryVisibility: EntitlementCapabilitySchema,
});

export const BillingSubscriptionResponseSchema = z.object({
  subscription: BillingSubscriptionSummarySchema,
});

export const BillingUsageResponseSchema = z.object({
  usage: BillingUsageSummarySchema,
});

export const StartTrialResponseSchema = z.object({
  subscription: BillingSubscriptionSummarySchema,
  usage: BillingUsageSummarySchema,
});

export type BillingPlanSlug = z.infer<typeof BillingPlanSlugSchema>;
export type BillingPlan = z.infer<typeof BillingPlanSchema>;
export type BillingPlanLimits = z.infer<typeof BillingPlanLimitsSchema>;
export type BillingSubscriptionStatus = z.infer<
  typeof BillingSubscriptionStatusSchema
>;
export type EntitlementDenialReason = z.infer<
  typeof EntitlementDenialReasonSchema
>;
export type EntitlementDenial = z.infer<typeof EntitlementDenialSchema>;
export type EntitlementCapability = z.infer<typeof EntitlementCapabilitySchema>;
export type BillingSubscriptionSummary = z.infer<
  typeof BillingSubscriptionSummarySchema
>;
export type BillingUsageSummary = z.infer<typeof BillingUsageSummarySchema>;
export type BillingSubscriptionResponse = z.infer<
  typeof BillingSubscriptionResponseSchema
>;
export type BillingUsageResponse = z.infer<typeof BillingUsageResponseSchema>;
export type StartTrialResponse = z.infer<typeof StartTrialResponseSchema>;
export type PaytrCheckoutRequest = z.infer<typeof PaytrCheckoutRequestSchema>;
export type PaytrCheckoutResponse = z.infer<typeof PaytrCheckoutResponseSchema>;

export const billingPlanCatalog: BillingPlan[] = [
  {
    slug: "author-trial",
    role: "author",
    kind: "trial",
    billingPeriod: "trial",
    displayName: "Author trial",
    limits: {
      introRequestsPerPeriod: 5,
      storageBytes: 50 * 1024 * 1024,
      directoryVisibility: false,
      supportLevel: "standard",
    },
    checkoutEnabled: false,
  },
  {
    slug: "publisher-trial",
    role: "publisher",
    kind: "trial",
    billingPeriod: "trial",
    displayName: "Publisher trial",
    limits: {
      introRequestsPerPeriod: 5,
      storageBytes: 0,
      directoryVisibility: true,
      supportLevel: "standard",
    },
    checkoutEnabled: false,
  },
  {
    slug: "author-pro-monthly",
    role: "author",
    kind: "paid",
    billingPeriod: "monthly",
    displayName: "Author Pro monthly",
    limits: {
      introRequestsPerPeriod: 25,
      storageBytes: 250 * 1024 * 1024,
      directoryVisibility: false,
      supportLevel: "priority",
    },
    checkoutEnabled: true,
  },
  {
    slug: "author-pro-annual",
    role: "author",
    kind: "paid",
    billingPeriod: "annual",
    displayName: "Author Pro annual",
    limits: {
      introRequestsPerPeriod: 25,
      storageBytes: 250 * 1024 * 1024,
      directoryVisibility: false,
      supportLevel: "priority",
    },
    checkoutEnabled: true,
  },
  {
    slug: "publisher-pro-monthly",
    role: "publisher",
    kind: "paid",
    billingPeriod: "monthly",
    displayName: "Publisher Pro monthly",
    limits: {
      introRequestsPerPeriod: 50,
      storageBytes: 0,
      directoryVisibility: true,
      supportLevel: "priority",
    },
    checkoutEnabled: true,
  },
  {
    slug: "publisher-pro-annual",
    role: "publisher",
    kind: "paid",
    billingPeriod: "annual",
    displayName: "Publisher Pro annual",
    limits: {
      introRequestsPerPeriod: 50,
      storageBytes: 0,
      directoryVisibility: true,
      supportLevel: "priority",
    },
    checkoutEnabled: true,
  },
].map((plan) => BillingPlanSchema.parse(plan));

export const BillingPlanSlugFromStringSchema = SlugSchema.pipe(
  BillingPlanSlugSchema,
);
