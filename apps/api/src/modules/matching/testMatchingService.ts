import { randomUUID } from "node:crypto";
import type {
  MatchCandidate,
  MatchRun,
  MatchRunRequest,
} from "@marketplace/contracts";
import {
  MatchCandidateSchema,
  MatchRunResponseSchema,
  MatchRunSchema,
} from "@marketplace/contracts";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import {
  addTestProfileAccessGrant,
  findTestProfileById,
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import { MatchingServiceError } from "./errors.js";
import {
  createTestMatchRun,
  fingerprint,
  type MatchingTestState,
} from "./testState.js";
import {
  compareScoredCandidates,
  isVisibleMatch,
  scoreMatchCandidate,
} from "./scoring.js";

export function runTestMatch(input: {
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  request: MatchRunRequest;
  testState: MatchingTestState;
  user: AuthenticatedUser;
}) {
  const requester = requireTestProfile(
    input.profileTestState,
    input.user.userId,
  );
  enforceTestRateLimit(input.testState, requester.profile.id);

  if (input.request.direction === "author_to_publisher") {
    return runTestAuthorMatch({ ...input, request: input.request }, requester);
  }

  return runTestPublisherMatch({ ...input, request: input.request }, requester);
}

export function listTestMatchRuns(input: {
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  testState: MatchingTestState;
  user: AuthenticatedUser;
}) {
  const viewer = requireTestProfile(input.profileTestState, input.user.userId);
  const runs = input.testState.runs
    .filter((run) => run.requesterProfileId === viewer.profile.id)
    .map((run) => ({ ...run, stale: isTestRunStale(input, run) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { runs: runs.map((run) => MatchRunSchema.parse(run)) };
}

export function getTestMatchRun(input: {
  matchRunId: string;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  testState: MatchingTestState;
  user: AuthenticatedUser;
}) {
  const viewer = requireTestProfile(input.profileTestState, input.user.userId);
  const run = input.testState.runs.find(
    (item) =>
      item.id === input.matchRunId &&
      item.requesterProfileId === viewer.profile.id,
  );
  if (!run) {
    throw new MatchingServiceError("not_found", "Match run not found");
  }
  return MatchRunResponseSchema.parse({
    run: { ...run, stale: isTestRunStale(input, run) },
    candidates: input.testState.candidates.filter(
      (candidate) => candidate.runId === run.id,
    ),
  });
}

function runTestAuthorMatch(
  input: {
    manuscriptTestState: ManuscriptTestState;
    profileTestState: ProfileTestState;
    request: Extract<MatchRunRequest, { direction: "author_to_publisher" }>;
    testState: MatchingTestState;
    user: AuthenticatedUser;
  },
  requester: NonNullable<ReturnType<typeof findTestProfileByUserId>>,
) {
  if (requester.profile.role !== "author") {
    throw new MatchingServiceError(
      "forbidden",
      "Only authors can run this match",
    );
  }

  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) =>
      item.id === input.request.manuscriptId &&
      item.authorId === input.user.userId,
  );
  if (!manuscript) {
    throw new MatchingServiceError("not_found", "Manuscript not found");
  }
  assertTestManuscriptReady(input.manuscriptTestState, manuscript.id);

  const publisherRecords = [
    ...input.profileTestState.profilesByUserId.values(),
  ].filter(
    (record) =>
      record.profile.role === "publisher" &&
      record.profile.eligibilityStatus === "eligible" &&
      record.details?.role === "publisher",
  );
  const run = createTestMatchRun({
    candidateCount: 0,
    direction: "author_to_publisher",
    requesterProfileId: requester.profile.id,
    sourceManuscriptId: manuscript.id,
    sourcePublisherProfileId: null,
    sourceTitle: manuscript.title,
    stale: false,
  });
  const candidates = publisherRecords
    .map((record) => {
      if (record.details?.role !== "publisher") {
        throw new MatchingServiceError(
          "not_ready",
          "Publisher profile is incomplete",
        );
      }
      const candidate = {
        ...record.details,
        acceptedPrimaryGenres: record.details.focusGenres,
        acceptedAudienceCategories: record.details.acceptedAudienceCategories,
        acceptedManuscriptForms: record.details.acceptedManuscriptForms,
        editorWishlist: record.details.editorWishlist,
        excludedTopics: record.details.excludedTopics,
        submissionGuidelines: record.details.submissionGuidelines,
      };
      return {
        record,
        result: scoreMatchCandidate({
          candidate,
          candidateKind: "publisher",
          rankSeed: `${run.id}:${record.profile.id}`,
          source: manuscript as unknown as Record<string, unknown>,
        }),
        stableId: record.profile.id,
      };
    })
    .filter((item) => isVisibleMatch(item.result))
    .sort(compareScoredCandidates)
    .slice(0, 25)
    .map((item, index) =>
      buildTestPublisherCandidate({
        candidateProfileId: item.record.profile.id,
        explanation: index < 10,
        rank: index + 1,
        result: item.result,
        runId: run.id,
        title:
          item.record.details?.role === "publisher"
            ? (item.record.details.publisherName ??
              item.record.profile.displayName)
            : item.record.profile.displayName,
      }),
    );
  run.candidateCount = candidates.length;

  input.testState.runs.push({
    ...run,
    inputFingerprint: fingerprint(manuscript),
  });
  input.testState.candidates.push(...candidates);
  for (const candidate of candidates) {
    addTestProfileAccessGrant(input.profileTestState, {
      viewerUserId: input.user.userId,
      targetProfileId: candidate.candidateProfileId,
      source: "match_candidate",
    });
  }
  return MatchRunResponseSchema.parse({ run, candidates });
}

function runTestPublisherMatch(
  input: {
    manuscriptTestState: ManuscriptTestState;
    profileTestState: ProfileTestState;
    request: MatchRunRequest;
    testState: MatchingTestState;
    user: AuthenticatedUser;
  },
  requester: NonNullable<ReturnType<typeof findTestProfileByUserId>>,
) {
  if (requester.profile.role !== "publisher") {
    throw new MatchingServiceError(
      "forbidden",
      "Only publishers can run this match",
    );
  }
  if (requester.profile.eligibilityStatus !== "eligible") {
    throw new MatchingServiceError(
      "not_ready",
      "Publisher profile is not eligible",
    );
  }

  const manuscripts = input.manuscriptTestState.manuscripts
    .filter((manuscript) => manuscript.eligibilityStatus === "eligible")
    .filter((manuscript) =>
      hasTestProcessedSample(input.manuscriptTestState, manuscript.id),
    );
  const run = createTestMatchRun({
    candidateCount: 0,
    direction: "publisher_to_manuscript",
    requesterProfileId: requester.profile.id,
    sourceManuscriptId: null,
    sourcePublisherProfileId: requester.profile.id,
    sourceTitle:
      requester.details?.role === "publisher"
        ? (requester.details.publisherName ?? requester.profile.displayName)
        : requester.profile.displayName,
    stale: false,
  });
  const source = (requester.details ?? {}) as unknown as Record<
    string,
    unknown
  >;
  const candidates = manuscripts
    .map((manuscript) => {
      const author = findTestProfileByUserId(
        input.profileTestState,
        manuscript.authorId,
      );
      const result = scoreMatchCandidate({
        candidate: manuscript as unknown as Record<string, unknown>,
        candidateKind: "manuscript",
        rankSeed: `${run.id}:${manuscript.id}`,
        source,
      });
      return { author, manuscript, result, stableId: manuscript.id };
    })
    .filter((item) => isVisibleMatch(item.result))
    .sort(compareScoredCandidates)
    .slice(0, 25)
    .map((item, index) =>
      buildTestManuscriptCandidate({
        authorProfileId: item.author?.profile.id ?? requester.profile.id,
        explanation: index < 10,
        manuscriptId: item.manuscript.id,
        rank: index + 1,
        result: item.result,
        runId: run.id,
        title: item.manuscript.title,
      }),
    );
  run.candidateCount = candidates.length;

  input.testState.runs.push({
    ...run,
    inputFingerprint: fingerprint(requester.details),
  });
  input.testState.candidates.push(...candidates);
  for (const candidate of candidates) {
    addTestProfileAccessGrant(input.profileTestState, {
      viewerUserId: input.user.userId,
      targetProfileId: candidate.candidateProfileId,
      manuscriptId: candidate.candidateManuscriptId ?? undefined,
      source: "match_candidate",
    });
  }
  return MatchRunResponseSchema.parse({ run, candidates });
}

function requireTestProfile(state: ProfileTestState, userId: string) {
  const profile = findTestProfileByUserId(state, userId);
  if (!profile) {
    throw new MatchingServiceError("forbidden", "Marketplace profile required");
  }
  return profile;
}

function enforceTestRateLimit(
  state: MatchingTestState,
  requesterProfileId: string,
) {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = state.runs.filter(
    (run) =>
      run.requesterProfileId === requesterProfileId &&
      new Date(run.createdAt).getTime() >= oneHourAgo,
  );
  if (recent.length >= 10) {
    throw new MatchingServiceError("rate_limited", "Too many match runs");
  }
}

function assertTestManuscriptReady(
  state: ManuscriptTestState,
  manuscriptId: string,
) {
  const manuscript = state.manuscripts.find((item) => item.id === manuscriptId);
  if (!manuscript || manuscript.eligibilityStatus !== "eligible") {
    throw new MatchingServiceError("not_ready", "Manuscript is not eligible");
  }
  if (!hasTestProcessedSample(state, manuscriptId)) {
    throw new MatchingServiceError(
      "not_ready",
      "A processed sample is required",
    );
  }
}

function hasTestProcessedSample(
  state: ManuscriptTestState,
  manuscriptId: string,
) {
  const manuscript = state.manuscripts.find((item) => item.id === manuscriptId);
  if (!manuscript?.sampleDocumentId) return false;
  return state.documents.some(
    (document) =>
      document.id === manuscript.sampleDocumentId &&
      document.processingStatus === "succeeded" &&
      document.eligibilityStatus === "eligible",
  );
}

function buildTestPublisherCandidate(input: {
  candidateProfileId: string;
  explanation: boolean;
  rank: number;
  result: ReturnType<typeof scoreMatchCandidate>;
  runId: string;
  title: string;
}): MatchCandidate {
  return MatchCandidateSchema.parse({
    id: randomUUID(),
    runId: input.runId,
    rank: input.rank,
    candidateProfileId: input.candidateProfileId,
    candidateManuscriptId: null,
    candidateType: "publisher",
    title: input.title,
    subtitle: "Publisher profile",
    scoreBand: input.result.scoreBand,
    axisBands: input.result.axisBands,
    explanation: input.explanation
      ? `${input.title} is a visible match because its declared editorial signals overlap with the manuscript profile after soft-constraint checks.`
      : null,
    explanationStatus: input.explanation ? "generated" : "not_requested",
    fitReasons: input.result.fitReasons,
    riskReasons: input.result.riskReasons,
    penalties: input.result.penalties,
    safeSnippets: input.result.safeSnippets,
    profilePath: `/app/profiles/publishers/${input.candidateProfileId}`,
    manuscriptProfilePath: null,
  });
}

function buildTestManuscriptCandidate(input: {
  authorProfileId: string;
  explanation: boolean;
  manuscriptId: string;
  rank: number;
  result: ReturnType<typeof scoreMatchCandidate>;
  runId: string;
  title: string;
}): MatchCandidate {
  return MatchCandidateSchema.parse({
    id: randomUUID(),
    runId: input.runId,
    rank: input.rank,
    candidateProfileId: input.authorProfileId,
    candidateManuscriptId: input.manuscriptId,
    candidateType: "manuscript",
    title: input.title,
    subtitle: "Manuscript candidate",
    scoreBand: input.result.scoreBand,
    axisBands: input.result.axisBands,
    explanation: input.explanation
      ? `${input.title} is a visible match because its manuscript signals overlap with the publisher profile after soft-constraint checks.`
      : null,
    explanationStatus: input.explanation ? "generated" : "not_requested",
    fitReasons: input.result.fitReasons,
    riskReasons: input.result.riskReasons,
    penalties: input.result.penalties,
    safeSnippets: input.result.safeSnippets,
    profilePath: `/app/profiles/authors/${input.authorProfileId}`,
    manuscriptProfilePath: `/app/profiles/manuscripts/${input.manuscriptId}`,
  });
}

function isTestRunStale(
  input: {
    manuscriptTestState: ManuscriptTestState;
    profileTestState: ProfileTestState;
  },
  run: MatchRun,
) {
  if (run.direction === "author_to_publisher" && run.sourceManuscriptId) {
    const manuscript = input.manuscriptTestState.manuscripts.find(
      (item) => item.id === run.sourceManuscriptId,
    );
    return manuscript ? fingerprint(manuscript) !== run.inputFingerprint : true;
  }
  if (run.sourcePublisherProfileId) {
    const publisher = findTestProfileById(
      input.profileTestState,
      run.sourcePublisherProfileId,
    );
    return publisher
      ? fingerprint(publisher.details) !== run.inputFingerprint
      : true;
  }
  return run.stale;
}
