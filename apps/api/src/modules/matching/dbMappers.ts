import type { MatchCandidate, MatchRun } from "@marketplace/contracts";
import { MatchCandidateSchema, MatchRunSchema } from "@marketplace/contracts";

export function mapDbRun(row: Record<string, unknown>): MatchRun {
  const snapshot = (row.input_snapshot ?? {}) as Record<string, unknown>;
  return MatchRunSchema.parse({
    id: row.id,
    direction: row.direction,
    requesterProfileId: row.requester_profile_id,
    sourceManuscriptId: row.source_manuscript_id ?? null,
    sourcePublisherProfileId: row.source_publisher_profile_id ?? null,
    status: row.status,
    stale: row.stale ?? false,
    candidateCount: row.candidate_count ?? 0,
    failureCode: row.failure_code ?? null,
    inputFingerprint: row.input_fingerprint,
    sourceTitle: snapshot["title"] ?? "Match run",
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  });
}

export function mapDbCandidate(row: Record<string, unknown>): MatchCandidate {
  const details = (row.score_details ?? {}) as Record<string, unknown>;
  return MatchCandidateSchema.parse({
    id: row.id,
    runId: row.match_run_id,
    rank: row.rank,
    candidateProfileId: row.candidate_profile_id,
    candidateManuscriptId: row.candidate_manuscript_id ?? null,
    candidateType: row.candidate_type,
    title: details["title"] ?? "Candidate",
    subtitle: details["subtitle"] ?? null,
    scoreBand: row.score_band,
    axisBands: row.axis_bands,
    explanation: row.explanation ?? null,
    fitReasons: row.fit_reasons ?? [],
    riskReasons: row.risk_reasons ?? [],
    profilePath:
      details["profilePath"] ?? `/app/profiles/${row.candidate_profile_id}`,
    manuscriptProfilePath: details["manuscriptProfilePath"] ?? null,
  });
}
