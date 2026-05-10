import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";
import { IntroStateSchema } from "./introRequests.js";

export const MatchDirectionSchema = z.enum([
  "author_to_publisher",
  "publisher_to_manuscript",
]);

export const MatchRunStatusSchema = z.enum(["running", "succeeded", "failed"]);
export const MatchScoreBandSchema = z.enum(["strong", "moderate", "weak"]);
export const MatchAxisSchema = z.enum(["premise", "voice", "arc"]);
export const MatchExplanationStatusSchema = z.enum([
  "generated",
  "not_requested",
]);

export const MatchSafeSnippetSchema = z.object({
  label: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(360),
  sourceType: z
    .enum([
      "manuscript_metadata",
      "manuscript_sample",
      "publisher_guidelines",
      "publisher_wishlist",
      "publisher_catalog",
      "unknown",
    ])
    .optional(),
});

export const MatchPenaltySchema = z.object({
  code: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  severity: z.enum(["low", "medium", "high"]),
});

export const IntroTargetSchema = z.object({
  manuscriptId: UuidSchema,
  publisherProfileId: UuidSchema,
});

export const MatchRunRequestSchema = z.discriminatedUnion("direction", [
  z.object({
    direction: z.literal("author_to_publisher"),
    manuscriptId: UuidSchema,
  }),
  z.object({
    direction: z.literal("publisher_to_manuscript"),
  }),
]);

export const MatchCandidateSchema = z.object({
  id: UuidSchema,
  runId: UuidSchema,
  rank: z.number().int().positive(),
  candidateProfileId: UuidSchema,
  candidateManuscriptId: UuidSchema.nullable(),
  candidateType: z.enum(["publisher", "manuscript"]),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).nullable(),
  scoreBand: MatchScoreBandSchema,
  axisBands: z.record(MatchAxisSchema, MatchScoreBandSchema),
  explanation: z.string().trim().max(1200).nullable(),
  explanationStatus: MatchExplanationStatusSchema,
  fitReasons: z.array(z.string().trim().min(1).max(240)).max(8),
  riskReasons: z.array(z.string().trim().min(1).max(240)).max(8),
  penalties: z.array(MatchPenaltySchema).max(8),
  safeSnippets: z.array(MatchSafeSnippetSchema).max(6),
  profilePath: z.string().trim().min(1).max(240),
  manuscriptProfilePath: z.string().trim().min(1).max(240).nullable(),
  introTarget: IntroTargetSchema.nullable().default(null),
  introState: IntroStateSchema.default({
    status: "not_eligible",
    requestId: null,
    viewerCanAccept: false,
    viewerCanReject: false,
    viewerCanCancel: false,
    cooldownUntil: null,
    quotaRemaining: null,
  }),
});

export const MatchComparisonStatusSchema = z.enum([
  "match",
  "partial",
  "mismatch",
  "unknown",
]);

export const MatchDetailSnippetSchema = MatchSafeSnippetSchema.extend({
  sourceType: z.enum([
    "manuscript_metadata",
    "manuscript_sample",
    "publisher_guidelines",
    "publisher_wishlist",
    "publisher_catalog",
    "unknown",
  ]),
});

export const MatchComparisonRowSchema = z.object({
  key: z.enum([
    "genre",
    "audience",
    "manuscript_form",
    "language",
    "word_count",
    "themes",
    "content_warnings",
  ]),
  status: MatchComparisonStatusSchema,
  manuscriptValues: z.array(z.string().trim().min(1).max(120)).max(12),
  publisherValues: z.array(z.string().trim().min(1).max(120)).max(12),
  noteCode: z.string().trim().min(1).max(100),
  noteParams: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
});

export const MatchAxisEvidenceSchema = z.object({
  band: MatchScoreBandSchema,
  manuscriptSignal: z.enum(["premise", "voice", "arc"]),
  publisherSignal: z.enum(["guidelines", "wishlist", "catalog", "unknown"]),
  manuscriptSummary: z.string().trim().max(420).nullable(),
  publisherSummary: z.string().trim().max(420).nullable(),
  reasons: z.array(z.string().trim().min(1).max(220)).max(6),
});

export const MatchDetailSnapshotSchema = z.object({
  pair: z.object({
    manuscriptId: UuidSchema.nullable(),
    manuscriptTitle: z.string().trim().max(200).nullable(),
    publisherProfileId: UuidSchema.nullable(),
    publisherName: z.string().trim().max(200).nullable(),
    sourceSide: z.enum(["manuscript", "publisher"]),
  }),
  publisherContext: z
    .object({
      acceptedGenres: z.array(z.string().trim().min(1).max(120)).max(20),
      acceptedAudienceCategories: z
        .array(z.string().trim().min(1).max(120))
        .max(20),
      acceptedManuscriptForms: z
        .array(z.string().trim().min(1).max(120))
        .max(20),
      excludedTopics: z.array(z.string().trim().min(1).max(120)).max(20),
      guidelinesSummary: z.string().trim().max(420).nullable(),
      wishlistSummary: z.string().trim().max(420).nullable(),
      catalogSummary: z.string().trim().max(420).nullable(),
    })
    .nullable(),
  manuscriptContext: z
    .object({
      genre: z.string().trim().max(120).nullable(),
      subgenres: z.array(z.string().trim().min(1).max(120)).max(20),
      audienceCategories: z.array(z.string().trim().min(1).max(120)).max(20),
      manuscriptForm: z.string().trim().max(120).nullable(),
      language: z.string().trim().max(40).nullable(),
      wordCount: z.number().int().nonnegative().nullable(),
      themes: z.array(z.string().trim().min(1).max(120)).max(20),
      declaredContentWarnings: z
        .array(z.string().trim().min(1).max(120))
        .max(20),
      logline: z.string().trim().max(360).nullable(),
      teaser: z.string().trim().max(360).nullable(),
    })
    .nullable(),
  comparison: z.array(MatchComparisonRowSchema).max(12),
  axisEvidence: z.object({
    premise: MatchAxisEvidenceSchema,
    voice: MatchAxisEvidenceSchema,
    arc: MatchAxisEvidenceSchema,
  }),
  evidence: z.object({
    fitReasons: z.array(z.string().trim().min(1).max(240)).max(8),
    watchOuts: z.array(z.string().trim().min(1).max(240)).max(8),
    safeSnippets: z.array(MatchDetailSnippetSchema).max(6),
  }),
  limitations: z.array(z.string().trim().min(1).max(120)).max(8),
});

export const MatchCandidateDetailSchema = MatchCandidateSchema.extend({
  detail: MatchDetailSnapshotSchema,
});

export const MatchRunSchema = z.object({
  id: UuidSchema,
  direction: MatchDirectionSchema,
  requesterProfileId: UuidSchema,
  sourceManuscriptId: UuidSchema.nullable(),
  sourcePublisherProfileId: UuidSchema.nullable(),
  status: MatchRunStatusSchema,
  stale: z.boolean(),
  candidateCount: z.number().int().nonnegative(),
  failureCode: z.string().trim().max(80).nullable(),
  inputFingerprint: z.string().trim().min(1).max(128),
  sourceTitle: z.string().trim().min(1).max(200),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const MatchRunResponseSchema = z.object({
  run: MatchRunSchema,
  candidates: z.array(MatchCandidateSchema),
});

export const MatchRunListResponseSchema = z.object({
  runs: z.array(MatchRunSchema),
});

export const MatchCandidateResponseSchema = z.object({
  run: MatchRunSchema,
  candidate: MatchCandidateDetailSchema,
});

export type MatchRunRequest = z.infer<typeof MatchRunRequestSchema>;
export type MatchDirection = z.infer<typeof MatchDirectionSchema>;
export type MatchScoreBand = z.infer<typeof MatchScoreBandSchema>;
export type MatchRun = z.infer<typeof MatchRunSchema>;
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;
export type MatchCandidateDetail = z.infer<typeof MatchCandidateDetailSchema>;
export type MatchDetailSnapshot = z.infer<typeof MatchDetailSnapshotSchema>;
export type MatchRunResponse = z.infer<typeof MatchRunResponseSchema>;
