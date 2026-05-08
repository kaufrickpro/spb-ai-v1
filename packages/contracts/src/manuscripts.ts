import { z } from "zod";
import {
  EligibilityStatusSchema,
  IsoDateTimeSchema,
  ReviewOutcomeSchema,
  UuidSchema,
} from "./common.js";
import {
  AcceptedIntroContactSchema,
  IntroStateSchema,
} from "./introRequests.js";

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
  logline: z.string().trim().max(500).nullable().optional(),
  subgenres: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  audienceCategories: z
    .array(z.string().trim().min(1).max(80))
    .max(8)
    .optional(),
  manuscriptForm: z.string().trim().max(80).nullable().optional(),
  compTitles: z.array(z.string().trim().min(1).max(160)).max(8).optional(),
  declaredThemes: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  declaredContentWarnings: z
    .array(z.string().trim().min(1).max(120))
    .max(12)
    .optional(),
  arcSummary: z.string().trim().max(2000).nullable().optional(),
  chapterSummaries: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        summary: z.string().trim().min(1).max(1000),
      }),
    )
    .max(30)
    .optional(),
  shortTeaser: z.string().trim().max(500).nullable().optional(),
  requestable: z.boolean().optional(),
  status: ManuscriptStatusSchema,
  adminReviewStatus: ManuscriptAdminReviewStatusSchema,
  eligibilityStatus: EligibilityStatusSchema.default("limited"),
  reviewOutcome: ReviewOutcomeSchema.default("needs_review"),
  sampleDocumentId: UuidSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

// ─── Request schemas ──────────────────────────────────────────────────────────

const BaseManuscriptWriteRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  genre: z.string().trim().min(1).max(80),
  language: z.string().trim().min(2).max(10).default("tr"),
  wordCount: z.number().int().nonnegative().optional().nullable(),
  synopsis: z.string().trim().max(2000).optional().nullable(),
  targetAgeMin: z.number().int().nonnegative().optional().nullable(),
  targetAgeMax: z.number().int().nonnegative().optional().nullable(),
  logline: z.string().trim().max(500).optional().nullable(),
  subgenres: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  audienceCategories: z
    .array(z.string().trim().min(1).max(80))
    .max(8)
    .optional(),
  manuscriptForm: z.string().trim().max(80).optional().nullable(),
  compTitles: z.array(z.string().trim().min(1).max(160)).max(8).optional(),
  declaredThemes: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  declaredContentWarnings: z
    .array(z.string().trim().min(1).max(120))
    .max(12)
    .optional(),
  arcSummary: z.string().trim().max(2000).optional().nullable(),
  chapterSummaries: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        summary: z.string().trim().min(1).max(1000),
      }),
    )
    .max(30)
    .optional(),
  shortTeaser: z.string().trim().max(500).optional().nullable(),
  requestable: z.boolean().optional(),
});

export const CreateManuscriptRequestSchema =
  BaseManuscriptWriteRequestSchema.refine(
    (input) => !input.requestable || Boolean(input.shortTeaser?.trim().length),
    {
      message: "Short teaser is required when manuscript access is requestable",
      path: ["shortTeaser"],
    },
  ).refine(
    (input) =>
      !input.logline ||
      Boolean(input.arcSummary?.trim().length) ||
      Boolean(input.chapterSummaries?.length),
    {
      message: "Arc summary or chapter summaries are required for matching",
      path: ["arcSummary"],
    },
  );

export const UpdateManuscriptRequestSchema =
  BaseManuscriptWriteRequestSchema.partial();

// ─── Response schemas ─────────────────────────────────────────────────────────

export const ManuscriptResponseSchema = z.object({
  manuscript: ManuscriptSchema,
});

export const ManuscriptListResponseSchema = z.object({
  manuscripts: z.array(ManuscriptSchema),
});

export const ManuscriptProfileAuthorSchema = z.object({
  id: UuidSchema,
  displayName: z.string().trim().min(1).max(120),
  photoUrl: z.string().trim().url().max(2048).nullable(),
  biography: z.string().trim().max(1000).nullable(),
});

export const ManuscriptProfileSchema = z.object({
  id: UuidSchema,
  author: ManuscriptProfileAuthorSchema,
  title: z.string().trim().min(1).max(200),
  logline: z.string().trim().max(500).nullable(),
  synopsis: z.string().trim().max(2000).nullable(),
  primaryGenre: z.string().trim().min(1).max(80),
  subgenres: z.array(z.string().trim().min(1).max(80)),
  audienceCategories: z.array(z.string().trim().min(1).max(80)),
  manuscriptForm: z.string().trim().max(80).nullable(),
  compTitles: z.array(z.string().trim().min(1).max(160)),
  declaredThemes: z.array(z.string().trim().min(1).max(80)),
  declaredContentWarnings: z.array(z.string().trim().min(1).max(120)),
  arcSummary: z.string().trim().max(2000).nullable(),
  chapterSummaries: z.array(
    z.object({
      title: z.string().trim().min(1).max(120),
      summary: z.string().trim().min(1).max(1000),
    }),
  ),
  shortTeaser: z.string().trim().max(500).nullable(),
  wordCount: z.number().int().nonnegative().nullable(),
  language: z.string().trim().min(2).max(10),
  introState: IntroStateSchema.nullable().default(null),
  acceptedIntroContact: AcceptedIntroContactSchema.nullable().default(null),
  acceptedIntroSampleDocumentId: UuidSchema.nullable().default(null),
});

export const ManuscriptProfileResponseSchema = z.object({
  manuscript: ManuscriptProfileSchema,
});

export const ManuscriptAccessRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const ManuscriptAccessRequestSchema = z.object({
  id: UuidSchema,
  manuscriptId: UuidSchema,
  manuscriptTitle: z.string().trim().min(1).max(200),
  authorProfileId: UuidSchema,
  authorName: z.string().trim().min(1).max(120),
  publisherProfileId: UuidSchema,
  publisherName: z.string().trim().min(1).max(120),
  status: ManuscriptAccessRequestStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ManuscriptAccessRequestResponseSchema = z.object({
  request: ManuscriptAccessRequestSchema,
});

export const ManuscriptAccessRequestListResponseSchema = z.object({
  requests: z.array(ManuscriptAccessRequestSchema),
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
export type ManuscriptAccessRequest = z.infer<
  typeof ManuscriptAccessRequestSchema
>;
export type ManuscriptProfile = z.infer<typeof ManuscriptProfileSchema>;
