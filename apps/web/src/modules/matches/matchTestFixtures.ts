import type {
  MatchCandidate,
  MatchCandidateDetail,
  MatchDetailSnapshot,
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

export function createMatchDetailSnapshot(
  input: Partial<MatchDetailSnapshot> = {},
): MatchDetailSnapshot {
  return {
    pair: {
      manuscriptId: "66666666-6666-4666-8666-666666666666",
      manuscriptTitle: "Bright Candidate",
      publisherProfileId: "55555555-5555-4555-8555-555555555555",
      publisherName: "Bridge Publishing",
      sourceSide: "manuscript",
    },
    publisherContext: {
      acceptedGenres: ["Literary fiction"],
      acceptedAudienceCategories: ["adult"],
      acceptedManuscriptForms: ["novel"],
      excludedTopics: ["graphic violence"],
      guidelinesSummary: "Looks for literary fiction with a clear voice.",
      wishlistSummary: "Istanbul stories with memory themes.",
      catalogSummary: "Recent literary mysteries.",
    },
    manuscriptContext: {
      genre: "Literary fiction",
      subgenres: ["mystery"],
      audienceCategories: ["adult"],
      manuscriptForm: "novel",
      language: "tr",
      wordCount: 72000,
      themes: ["memory"],
      declaredContentWarnings: ["grief"],
      logline: "A family follows a lost archive through Istanbul.",
      teaser: "A quiet literary mystery with archival stakes.",
    },
    comparison: [
      {
        key: "genre",
        status: "match",
        manuscriptValues: ["Literary fiction"],
        publisherValues: ["Literary fiction"],
        noteCode: "matches.comparisonNotes.genre.match",
        noteParams: {},
      },
      {
        key: "content_warnings",
        status: "unknown",
        manuscriptValues: ["grief"],
        publisherValues: [],
        noteCode: "matches.comparisonNotes.content_warnings.unknown",
        noteParams: {},
      },
    ],
    axisEvidence: {
      premise: {
        band: "strong",
        manuscriptSignal: "premise",
        publisherSignal: "guidelines",
        manuscriptSummary: "A family follows a lost archive.",
        publisherSummary: "Guidelines favor literary mystery.",
        reasons: ["Premise and market signals overlap."],
      },
      voice: {
        band: "moderate",
        manuscriptSignal: "voice",
        publisherSignal: "wishlist",
        manuscriptSummary: "Quiet archival voice.",
        publisherSummary: "Wishlist mentions Istanbul stories.",
        reasons: ["Voice and positioning signals are compatible."],
      },
      arc: {
        band: "weak",
        manuscriptSignal: "arc",
        publisherSignal: "catalog",
        manuscriptSummary: "Archive changes the family.",
        publisherSummary: "Catalog evidence is limited.",
        reasons: ["Story arc needs review."],
      },
    },
    evidence: {
      fitReasons: ["Clear editorial overlap", "Strong audience alignment"],
      watchOuts: ["Longer than stated preference"],
      safeSnippets: [
        {
          label: "Guidelines",
          text: "Looks for literary fiction with a clear authorial voice.",
          sourceType: "publisher_guidelines",
        },
      ],
    },
    limitations: [],
    ...input,
  };
}

export function createMatchCandidateDetail(
  input: Partial<MatchCandidateDetail> = {},
): MatchCandidateDetail {
  return {
    ...createMatchCandidate(input),
    detail: createMatchDetailSnapshot(input.detail),
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
