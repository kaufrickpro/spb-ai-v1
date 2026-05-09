import type {
  MatchCandidate,
  MatchCandidateDetail,
  MatchRun,
} from "@marketplace/contracts";
import {
  MatchCandidateDetailSchema,
  MatchCandidateSchema,
  MatchDetailSnapshotSchema,
  MatchRunSchema,
} from "@marketplace/contracts";

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
    explanationStatus:
      row.explanation_status ??
      (row.explanation ? "generated" : "not_requested"),
    fitReasons: safeTextArray(row.fit_reasons),
    riskReasons: safeTextArray(row.risk_reasons),
    penalties: details["penalties"] ?? [],
    safeSnippets: safeSnippetArray(row.safe_snippets),
    profilePath:
      details["profilePath"] ?? `/app/profiles/${row.candidate_profile_id}`,
    manuscriptProfilePath: details["manuscriptProfilePath"] ?? null,
  });
}

export function mapDbCandidateDetail(
  row: Record<string, unknown>,
  run: MatchRun,
): MatchCandidateDetail {
  const candidate = mapDbCandidate(row);
  return toMatchCandidateDetail(candidate, row.detail_snapshot, run);
}

export function toMatchCandidateDetail(
  candidate: MatchCandidate,
  storedDetail: unknown,
  run: MatchRun,
): MatchCandidateDetail {
  const parsed =
    isPlainObject(storedDetail) && Object.keys(storedDetail).length > 0
      ? MatchDetailSnapshotSchema.safeParse(storedDetail)
      : null;
  const detail =
    parsed?.success && !containsForbiddenDetailMarker(parsed.data)
      ? parsed.data
      : fallbackDetailSnapshot(candidate, run);

  return MatchCandidateDetailSchema.parse({
    ...candidate,
    detail,
  });
}

function fallbackDetailSnapshot(candidate: MatchCandidate, run: MatchRun) {
  const safeSnippets = candidate.safeSnippets.map((snippet) => ({
    label: snippet.label,
    text: snippet.text,
    sourceType: snippet.sourceType ?? "unknown",
  }));
  const manuscriptId =
    candidate.candidateType === "manuscript"
      ? candidate.candidateManuscriptId
      : run.sourceManuscriptId;
  const publisherProfileId =
    candidate.candidateType === "publisher"
      ? candidate.candidateProfileId
      : run.sourcePublisherProfileId;

  return MatchDetailSnapshotSchema.parse({
    pair: {
      manuscriptId,
      manuscriptTitle: candidate.candidateType === "manuscript" ? candidate.title : null,
      publisherProfileId,
      publisherName: candidate.candidateType === "publisher" ? candidate.title : null,
      sourceSide:
        run.direction === "publisher_to_manuscript" ? "publisher" : "manuscript",
    },
    publisherContext: null,
    manuscriptContext: null,
    comparison: [],
    axisEvidence: {
      premise: fallbackAxisEvidence(candidate, "premise"),
      voice: fallbackAxisEvidence(candidate, "voice"),
      arc: fallbackAxisEvidence(candidate, "arc"),
    },
    evidence: {
      fitReasons: safeTextArray(candidate.fitReasons),
      watchOuts: safeTextArray(candidate.riskReasons),
      safeSnippets,
    },
    limitations: ["detail_snapshot_unavailable"],
  });
}

function safeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .filter((item) => !containsForbiddenDetailMarker(item));
}

function safeSnippetArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => {
    if (!isPlainObject(item)) return false;
    return (
      typeof item["label"] === "string" &&
      typeof item["text"] === "string" &&
      !containsForbiddenDetailMarker(item["label"]) &&
      !containsForbiddenDetailMarker(item["text"])
    );
  });
}

function fallbackAxisEvidence(
  candidate: MatchCandidate,
  axis: "premise" | "voice" | "arc",
) {
  return {
    band: candidate.axisBands[axis],
    manuscriptSignal: axis,
    publisherSignal: "unknown",
    manuscriptSummary: null,
    publisherSummary: null,
    reasons: candidate.fitReasons.slice(0, 3),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const FORBIDDEN_DETAIL_MARKERS = [
  "scoreDebug",
  "rawScore",
  "finalScore",
  "vector",
  "embedding",
  "providerPayload",
  "prompt",
  "signedUrl",
  "downloadUrl",
  "privateContact",
  "email",
  "phone",
  "adminNotes",
  "billingState",
  "documentChunks",
  "fullManuscriptText",
  "fullSynopsis",
  "chapterSummaries",
];

function containsForbiddenDetailMarker(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenDetailMarker);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) =>
        FORBIDDEN_DETAIL_MARKERS.includes(key) ||
        containsForbiddenDetailMarker(nested),
    );
  }
  if (typeof value === "string") {
    return /https?:\/\/\S*(signed|download|token)\S*|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(
      value,
    );
  }
  return false;
}
