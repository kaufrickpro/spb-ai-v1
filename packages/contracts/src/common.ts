import { z } from "zod";

export const IsoDateTimeSchema = z.string().datetime();
export const UuidSchema = z.string().uuid();
export const SlugSchema = z.string().trim().min(1).max(80);

export const ProfileRoleSchema = z.enum(["author", "publisher"]);
export const PublicProfileRoleSchema = ProfileRoleSchema;
export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export const EligibilityStatusSchema = z.enum([
  "eligible",
  "limited",
  "blocked",
  "quarantined",
]);
export const ReviewOutcomeSchema = z.enum([
  "auto_approved",
  "needs_review",
  "admin_approved",
  "admin_rejected",
  "quarantined",
]);
export const LocaleSchema = z.enum(["tr", "en"]);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type EligibilityStatus = z.infer<typeof EligibilityStatusSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
export type ProfileRole = z.infer<typeof ProfileRoleSchema>;
export type PublicProfileRole = z.infer<typeof PublicProfileRoleSchema>;
export type ReviewOutcome = z.infer<typeof ReviewOutcomeSchema>;
