import type { CreateIntroRequestRequest } from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import {
  findTestProfileById,
  findTestProfileByUserId,
} from "../profiles/testState.js";
import { IntroRequestServiceError } from "./errors.js";
import { getTestIntroState } from "./introState.js";
import {
  getDbDocumentById,
  getDbProfileById,
  getDbProfileByUserId,
  getDbViewerProfile,
} from "./repository.js";
import type {
  IntroRequestDeps,
  PairContext,
  ProfileRecord,
  ManuscriptRecord,
} from "./types.js";

export function requireTestViewer(
  input: IntroRequestDeps & { user: AuthenticatedUser },
) {
  const viewer = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (!viewer)
    throw new IntroRequestServiceError("not_found", "No profile found");
  return viewer;
}

export function resolveTestPairContext(
  input: IntroRequestDeps & { user: AuthenticatedUser },
  body: CreateIntroRequestRequest,
): PairContext {
  const requester = requireTestViewer(input);
  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === body.manuscriptId,
  );
  const publisher = findTestProfileById(
    input.profileTestState,
    body.publisherProfileId,
  );
  if (!manuscript || !publisher || publisher.profile.role !== "publisher") {
    throw new IntroRequestServiceError(
      "not_found",
      "Intro request pair not found",
    );
  }
  const author = findTestProfileByUserId(
    input.profileTestState,
    manuscript.authorId,
  );
  if (!author || author.profile.role !== "author") {
    throw new IntroRequestServiceError("not_found", "Author profile not found");
  }
  if (
    requester.profile.id !== author.profile.id &&
    requester.profile.id !== publisher.profile.id
  ) {
    throw new IntroRequestServiceError(
      "forbidden",
      "Only pair participants can send intro requests",
    );
  }
  const recipient =
    requester.profile.id === author.profile.id ? publisher : author;
  const sampleDocument =
    input.manuscriptTestState.documents.find(
      (item) => item.id === manuscript.sampleDocumentId,
    ) ?? null;
  return {
    authorProfile: toDbLikeProfile(author.profile),
    manuscript: {
      id: manuscript.id,
      author_id: manuscript.authorId,
      title: manuscript.title,
      eligibility_status: manuscript.eligibilityStatus,
      sample_document_id: manuscript.sampleDocumentId,
    },
    publisherProfile: toDbLikeProfile(publisher.profile),
    requesterProfile: toDbLikeProfile(requester.profile),
    recipientProfile: toDbLikeProfile(recipient.profile),
    sampleDocument: sampleDocument
      ? {
          id: sampleDocument.id,
          manuscript_id: sampleDocument.manuscriptId,
          author_id: sampleDocument.authorId,
          original_file_name: sampleDocument.originalFileName,
          mime_type: sampleDocument.mimeType,
          upload_id: sampleDocument.uploadId,
          storage_status: sampleDocument.storageStatus,
          processing_status: sampleDocument.processingStatus,
          eligibility_status: sampleDocument.eligibilityStatus,
        }
      : null,
  };
}

export function toDbLikeProfile(profile: {
  id: string;
  userId: string;
  role: "author" | "publisher" | "admin";
  displayName: string;
  eligibilityStatus: string;
}): ProfileRecord {
  return {
    id: profile.id,
    user_id: profile.userId,
    role: profile.role === "publisher" ? "publisher" : "author",
    display_name: profile.displayName,
    eligibility_status: profile.eligibilityStatus,
  };
}

export function assertTestPairCanCreate(
  input: IntroRequestDeps,
  context: PairContext,
) {
  assertPairEligibility(context);
  if (!hasTestPairEvidence(input, context)) {
    throw new IntroRequestServiceError(
      "forbidden",
      "Intro request requires stored match or approved manuscript access evidence",
    );
  }
  const state = getTestIntroState(input, {
    manuscriptId: context.manuscript.id,
    publisherProfileId: context.publisherProfile.id,
    viewerProfileId: context.requesterProfile.id,
  });
  if (state.status === "quota_exhausted") {
    throw new IntroRequestServiceError(
      "quota",
      "Intro request quota exhausted",
    );
  }
  if (state.status !== "can_request") {
    throw new IntroRequestServiceError(
      "conflict",
      "Intro request cannot be created for this pair",
    );
  }
}

export async function resolveDbPairContext(
  db: SupabaseClient,
  user: AuthenticatedUser,
  body: CreateIntroRequestRequest,
): Promise<PairContext> {
  const requester = await getDbViewerProfile(db, user.userId);
  if (!requester)
    throw new IntroRequestServiceError("not_found", "No profile found");
  const { data: manuscript, error: manuscriptError } = await db
    .from("manuscripts")
    .select("id,author_id,title,eligibility_status,sample_document_id")
    .eq("id", body.manuscriptId)
    .maybeSingle();
  if (manuscriptError || !manuscript) {
    throw new IntroRequestServiceError(
      "not_found",
      "Manuscript not found",
      manuscriptError,
    );
  }
  const author = await getDbProfileByUserId(db, manuscript.author_id);
  const publisher = await getDbProfileById(db, body.publisherProfileId);
  if (!author || !publisher || publisher.role !== "publisher") {
    throw new IntroRequestServiceError(
      "not_found",
      "Intro request pair not found",
    );
  }
  if (requester.id !== author.id && requester.id !== publisher.id) {
    throw new IntroRequestServiceError(
      "forbidden",
      "Only pair participants can send intro requests",
    );
  }
  const recipient = requester.id === author.id ? publisher : author;
  const sampleDocument = manuscript.sample_document_id
    ? await getDbDocumentById(db, manuscript.sample_document_id)
    : null;
  return {
    authorProfile: author,
    manuscript: manuscript as ManuscriptRecord,
    publisherProfile: publisher,
    requesterProfile: requester,
    recipientProfile: recipient,
    sampleDocument,
  };
}

export function assertPairEligibility(context: PairContext) {
  if (
    context.authorProfile.eligibility_status !== "eligible" ||
    context.publisherProfile.eligibility_status !== "eligible" ||
    context.manuscript.eligibility_status !== "eligible" ||
    context.sampleDocument?.storage_status !== "uploaded" ||
    context.sampleDocument.processing_status !== "succeeded" ||
    context.sampleDocument.eligibility_status !== "eligible"
  ) {
    throw new IntroRequestServiceError(
      "not_eligible",
      "Intro request pair is not currently eligible",
    );
  }
}

export async function assertDbPairCanCreate(
  db: SupabaseClient,
  context: PairContext,
) {
  assertPairEligibility(context);
  if (!(await hasDbPairEvidence(db, context))) {
    throw new IntroRequestServiceError(
      "forbidden",
      "Intro request requires stored match or approved manuscript access evidence",
    );
  }
}

export function hasTestPairEvidence(
  input: IntroRequestDeps,
  context: PairContext,
) {
  const matchEvidence = input.matchingTestState.candidates.some((candidate) => {
    const run = input.matchingTestState.runs.find(
      (item) => item.id === candidate.runId && item.status === "succeeded",
    );
    if (!run) return false;
    return (
      (run.sourceManuscriptId === context.manuscript.id &&
        candidate.candidateProfileId === context.publisherProfile.id) ||
      (run.sourcePublisherProfileId === context.publisherProfile.id &&
        candidate.candidateManuscriptId === context.manuscript.id)
    );
  });
  const accessEvidence = input.manuscriptTestState.accessRequests.some(
    (request) =>
      request.manuscriptId === context.manuscript.id &&
      request.publisherProfileId === context.publisherProfile.id &&
      request.status === "approved",
  );
  return matchEvidence || accessEvidence;
}

export async function hasDbPairEvidence(
  db: SupabaseClient,
  context: PairContext,
) {
  const { data: manuscriptRuns } = await db
    .from("match_runs")
    .select("id")
    .eq("source_manuscript_id", context.manuscript.id)
    .eq("status", "succeeded");
  const runIds = (manuscriptRuns ?? []).map((run: { id: string }) => run.id);
  if (runIds.length > 0) {
    const { data: candidate } = await db
      .from("match_candidates")
      .select("id")
      .in("match_run_id", runIds)
      .eq("candidate_profile_id", context.publisherProfile.id)
      .limit(1)
      .maybeSingle();
    if (candidate) return true;
  }

  const { data: publisherRuns } = await db
    .from("match_runs")
    .select("id")
    .eq("source_publisher_profile_id", context.publisherProfile.id)
    .eq("status", "succeeded");
  const publisherRunIds = (publisherRuns ?? []).map(
    (run: { id: string }) => run.id,
  );
  if (publisherRunIds.length > 0) {
    const { data: candidate } = await db
      .from("match_candidates")
      .select("id")
      .in("match_run_id", publisherRunIds)
      .eq("candidate_manuscript_id", context.manuscript.id)
      .limit(1)
      .maybeSingle();
    if (candidate) return true;
  }

  const { data: accessRequest } = await db
    .from("manuscript_access_requests")
    .select("id")
    .eq("publisher_profile_id", context.publisherProfile.id)
    .eq("manuscript_id", context.manuscript.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  return Boolean(accessRequest);
}
