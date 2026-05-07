import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const MatchDirectionSchema = z.enum([
  "author_to_publisher",
  "publisher_to_manuscript",
]);

export const MatchRunStatusSchema = z.enum(["running", "succeeded", "failed"]);
export const MatchScoreBandSchema = z.enum(["strong", "moderate", "weak"]);
export const MatchAxisSchema = z.enum(["premise", "voice", "arc"]);

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
  fitReasons: z.array(z.string().trim().min(1).max(240)).max(8),
  riskReasons: z.array(z.string().trim().min(1).max(240)).max(8),
  profilePath: z.string().trim().min(1).max(240),
  manuscriptProfilePath: z.string().trim().min(1).max(240).nullable(),
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
  candidate: MatchCandidateSchema,
});

export type MatchRunRequest = z.infer<typeof MatchRunRequestSchema>;
export type MatchDirection = z.infer<typeof MatchDirectionSchema>;
export type MatchRun = z.infer<typeof MatchRunSchema>;
export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;
export type MatchRunResponse = z.infer<typeof MatchRunResponseSchema>;
