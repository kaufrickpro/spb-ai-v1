import { z } from "zod";
import {
  EligibilityStatusSchema,
  IsoDateTimeSchema,
  ReviewOutcomeSchema,
  UuidSchema,
} from "./common.js";

// ─── Status / enum schemas ───────────────────────────────────────────────────

export const ManuscriptStatusSchema = z.enum([
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "archived",
]);

export const ManuscriptAdminReviewStatusSchema = z.enum([
  "not_submitted",
  "pending",
  "approved",
  "rejected",
]);

// ─── Core manuscript schema ───────────────────────────────────────────────────

export const ManuscriptSchema = z.object({
  id: UuidSchema,
  authorId: UuidSchema,
  title: z.string().trim().min(1).max(200),
  genre: z.string().trim().min(1).max(80),
  language: z.string().trim().min(2).max(10),
  wordCount: z.number().int().nonnegative().nullable(),
  synopsis: z.string().trim().max(2000).nullable(),
  targetAgeMin: z.number().int().nonnegative().nullable(),
  targetAgeMax: z.number().int().nonnegative().nullable(),
  status: ManuscriptStatusSchema,
  adminReviewStatus: ManuscriptAdminReviewStatusSchema,
  eligibilityStatus: EligibilityStatusSchema.default("limited"),
  reviewOutcome: ReviewOutcomeSchema.default("needs_review"),
  sampleDocumentId: UuidSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

// ─── Request schemas ──────────────────────────────────────────────────────────

export const CreateManuscriptRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  genre: z.string().trim().min(1).max(80),
  language: z.string().trim().min(2).max(10).default("tr"),
  wordCount: z.number().int().nonnegative().optional().nullable(),
  synopsis: z.string().trim().max(2000).optional().nullable(),
  targetAgeMin: z.number().int().nonnegative().optional().nullable(),
  targetAgeMax: z.number().int().nonnegative().optional().nullable(),
});

export const UpdateManuscriptRequestSchema =
  CreateManuscriptRequestSchema.partial();

// ─── Response schemas ─────────────────────────────────────────────────────────

export const ManuscriptResponseSchema = z.object({
  manuscript: ManuscriptSchema,
});

export const ManuscriptListResponseSchema = z.object({
  manuscripts: z.array(ManuscriptSchema),
});

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type Manuscript = z.infer<typeof ManuscriptSchema>;
export type ManuscriptStatus = z.infer<typeof ManuscriptStatusSchema>;
export type ManuscriptAdminReviewStatus = z.infer<
  typeof ManuscriptAdminReviewStatusSchema
>;
export type CreateManuscriptRequest = z.infer<
  typeof CreateManuscriptRequestSchema
>;
export type UpdateManuscriptRequest = z.infer<
  typeof UpdateManuscriptRequestSchema
>;
export type ManuscriptResponse = z.infer<typeof ManuscriptResponseSchema>;
export type ManuscriptListResponse = z.infer<
  typeof ManuscriptListResponseSchema
>;
