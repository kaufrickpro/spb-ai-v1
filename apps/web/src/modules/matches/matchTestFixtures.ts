import type {
  MatchCandidate,
  MatchRun,
  MatchRunResponse,
} from "@marketplace/contracts";

export const runId = "11111111-1111-4111-8111-111111111111";
export const candidateId = "22222222-2222-4222-8222-222222222222";

export function createMatchRun(input: Partial<MatchRun> = {}): MatchRun {
  return {
    id: runId,
    direction: "author_to_publisher",
    requesterProfileId: "33333333-3333-4333-8333-333333333333",
    sourceManuscriptId: "44444444-4444-4444-8444-444444444444",
    sourcePublisherProfileId: null,
    status: "succeeded",
    stale: false,
    candidateCount: 1,
    failureCode: null,
    inputFingerprint: "fingerprint",
    sourceTitle: "Signal Novel",
    createdAt: "2026-05-07T10:00:00.000Z",
    updatedAt: "2026-05-07T10:00:00.000Z",
    ...input,
  };
}

export function createMatchCandidate(
  input: Partial<MatchCandidate> = {},
): MatchCandidate {
  return {
    id: candidateId,
    runId,
    rank: 1,
    candidateProfileId: "55555555-5555-4555-8555-555555555555",
    candidateManuscriptId: "66666666-6666-4666-8666-666666666666",
    candidateType: "manuscript",
    title: "Bright Candidate",
    subtitle: "Literary fiction",
    scoreBand: "strong",
    axisBands: {
      premise: "strong",
      voice: "moderate",
      arc: "weak",
    },
    explanation:
      "This is the stored top-ten explanation paragraph for the match.",
    explanationStatus: "generated",
    fitReasons: ["Clear editorial overlap", "Strong audience alignment"],
    riskReasons: ["Longer than stated preference"],
    penalties: [
      {
        code: "word_count_soft_conflict",
        label: "Word count is above the soft preference",
        severity: "medium",
      },
    ],
    safeSnippets: [
      {
        label: "Guidelines",
        text: "Looks for literary fiction with a clear authorial voice.",
      },
    ],
    profilePath: "/app/profiles/authors/55555555-5555-4555-8555-555555555555",
    manuscriptProfilePath:
      "/app/profiles/manuscripts/66666666-6666-4666-8666-666666666666",
    introTarget: null,
    introState: {
      status: "can_request",
      requestId: null,
      viewerCanAccept: false,
      viewerCanReject: false,
      viewerCanCancel: false,
      cooldownUntil: null,
      quotaRemaining: 10,
    },
    ...input,
  };
}

export function createMatchRunResponse(
  input: Partial<MatchRunResponse> = {},
): MatchRunResponse {
  return {
    run: createMatchRun(),
    candidates: [createMatchCandidate()],
    ...input,
  };
}
