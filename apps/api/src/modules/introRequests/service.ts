import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AcceptedIntroContactSchema,
  AdminIntroRequestDetailResponseSchema,
  AdminIntroRequestListResponseSchema,
  INTRO_REQUEST_COOLDOWN_DAYS,
  INTRO_REQUEST_DAILY_LIMIT,
  IntroRequestListResponseSchema,
  IntroRequestSchema,
  IntroRequestResponseSchema,
  IntroStateSchema,
  ProductAuditEventSchema,
  type AcceptedIntroContact,
  type AdminIntroRequestListQuery,
  type CreateIntroRequestRequest,
  type IntroRequest,
  type IntroRequestListQuery,
  type IntroState,
  type IntroStateStatus,
  type RejectIntroRequestRequest,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  findTestProfileById,
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { MatchingTestState } from "../matching/testState.js";
import {
  buildVisibleContact,
  fromDbContactSettings,
} from "../profiles/matchContactSettings.js";
import type { IntroRequestTestState } from "./testState.js";
import {
  parseIntroRequest,
  pushIntroNotification,
  pushProductAuditEvent,
} from "./testState.js";
import { IntroRequestServiceError } from "./errors.js";

type ProfileRecord = {
  id: string;
  user_id: string;
  role: "author" | "publisher";
  display_name: string;
  eligibility_status: string;
  public_contact_email?: string | null;
  public_phone?: string | null;
  website_url?: string | null;
  social_links?: unknown[];
  contact_visibility?: Record<string, unknown> | null;
};

type ManuscriptRecord = {
  id: string;
  author_id: string;
  title: string;
  eligibility_status: string;
  sample_document_id: string | null;
};

type DocumentRecord = {
  id: string;
  manuscript_id: string;
  author_id: string;
  original_file_name: string;
  mime_type: string;
  upload_id: string;
  storage_status: string;
  processing_status: string;
  eligibility_status: string;
};

type PairContext = {
  authorProfile: ProfileRecord;
  manuscript: ManuscriptRecord;
  publisherProfile: ProfileRecord;
  requesterProfile: ProfileRecord;
  recipientProfile: ProfileRecord;
  sampleDocument: DocumentRecord | null;
};

const profileSelectColumns =
  "id,user_id,role,display_name,eligibility_status,public_contact_email,public_phone,website_url,social_links,contact_visibility";

type IntroRequestDeps = {
  config: ApiConfig;
  introTestState: IntroRequestTestState;
  manuscriptTestState: ManuscriptTestState;
  matchingTestState: MatchingTestState;
  profileTestState: ProfileTestState;
};

export async function createIntroRequest(
  input: IntroRequestDeps & {
    body: CreateIntroRequestRequest;
    user: AuthenticatedUser;
  },
) {
  if (input.config.authMode === "test") {
    const context = resolveTestPairContext(input, input.body);
    assertTestPairCanCreate(input, context);
    const request = createTestIntroRequest(input, context, input.body.message);
    return IntroRequestResponseSchema.parse({ request });
  }

  const db = createIntroDb(input.config);
  const context = await resolveDbPairContext(db, input.user, input.body);
  await assertDbPairCanCreate(db, context);

  const { data, error } = await db.rpc("create_intro_request", {
    p_author_profile_id: context.authorProfile.id,
    p_manuscript_id: context.manuscript.id,
    p_message: input.body.message ?? null,
    p_publisher_profile_id: context.publisherProfile.id,
    p_recipient_profile_id: context.recipientProfile.id,
    p_requester_profile_id: context.requesterProfile.id,
  });
  if (error) {
    throw mapDbIntroError(error);
  }

  return IntroRequestResponseSchema.parse({
    request: await mapDbIntroRequest(db, data, context.requesterProfile.id),
  });
}

export async function listIntroRequests(
  input: IntroRequestDeps & {
    query: IntroRequestListQuery;
    user: AuthenticatedUser;
  },
) {
  if (input.config.authMode === "test") {
    const viewer = requireTestViewer(input);
    const requests = input.introTestState.requests
      .filter((request) => requestIncludesViewer(request, viewer.profile.id))
      .filter((request) =>
        filterByBox(request, viewer.profile.id, input.query.box),
      )
      .filter((request) =>
        input.query.status === "all"
          ? true
          : request.status === input.query.status,
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.query.limit)
      .map((request) => enrichTestRequest(input, request, viewer.profile.id));
    return IntroRequestListResponseSchema.parse({ requests });
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer) {
    throw new IntroRequestServiceError("not_found", "No profile found");
  }

  let query = db
    .from("intro_requests")
    .select()
    .or(
      `author_profile_id.eq.${viewer.id},publisher_profile_id.eq.${viewer.id}`,
    )
    .order("created_at", { ascending: false })
    .limit(input.query.limit);
  if (input.query.box === "sent") {
    query = query.eq("requester_profile_id", viewer.id);
  } else if (input.query.box === "received") {
    query = query.eq("recipient_profile_id", viewer.id);
  }
  if (input.query.status !== "all") {
    query = query.eq("status", input.query.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new IntroRequestServiceError(
      "storage",
      "Failed to list intro requests",
      error,
    );
  }

  const requests = [];
  for (const row of data ?? []) {
    requests.push(await mapDbIntroRequest(db, row, viewer.id));
  }
  return IntroRequestListResponseSchema.parse({ requests });
}

export async function transitionIntroRequest(
  input: IntroRequestDeps & {
    action: "accept" | "reject" | "cancel";
    body?: RejectIntroRequestRequest;
    requestId: string;
    user: AuthenticatedUser;
  },
) {
  if (input.config.authMode === "test") {
    const viewer = requireTestViewer(input);
    const index = input.introTestState.requests.findIndex(
      (request) => request.id === input.requestId,
    );
    if (index < 0) {
      throw new IntroRequestServiceError(
        "not_found",
        "Intro request not found",
      );
    }
    const existing = input.introTestState.requests[index];
    if (existing.status !== "pending") {
      throw new IntroRequestServiceError(
        "conflict",
        "Only pending intro requests can transition",
      );
    }
    if (
      ["accept", "reject"].includes(input.action) &&
      existing.recipientProfileId !== viewer.profile.id
    ) {
      throw new IntroRequestServiceError(
        "forbidden",
        "Only the recipient can accept or reject intro requests",
      );
    }
    if (
      input.action === "cancel" &&
      existing.requesterProfileId !== viewer.profile.id
    ) {
      throw new IntroRequestServiceError(
        "forbidden",
        "Only the requester can cancel intro requests",
      );
    }
    if (
      input.action === "accept" &&
      !isTestPairCurrentlyEligible(input, existing)
    ) {
      throw new IntroRequestServiceError(
        "not_eligible",
        "Intro request pair is not currently eligible",
      );
    }

    const status =
      input.action === "accept"
        ? "accepted"
        : input.action === "reject"
          ? "rejected"
          : "cancelled";
    const updated = parseIntroRequest({
      ...existing,
      status,
      note: input.action === "reject" ? (input.body?.note ?? null) : null,
      respondedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    input.introTestState.requests[index] = updated;
    recordTestLifecycle(input.introTestState, updated, viewer.profile.id);
    return IntroRequestResponseSchema.parse({
      request: enrichTestRequest(input, updated, viewer.profile.id),
    });
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer) {
    throw new IntroRequestServiceError("not_found", "No profile found");
  }

  const { data, error } = await db.rpc("transition_intro_request", {
    p_action: input.action,
    p_actor_profile_id: viewer.id,
    p_note: input.body?.note ?? null,
    p_request_id: input.requestId,
  });
  if (error) {
    throw mapDbIntroError(error);
  }

  return IntroRequestResponseSchema.parse({
    request: await mapDbIntroRequest(db, data, viewer.id),
  });
}

export async function getIntroStateForPair(
  input: IntroRequestDeps & {
    manuscriptId: string;
    publisherProfileId: string;
    user: AuthenticatedUser;
  },
): Promise<IntroState> {
  if (input.config.authMode === "test") {
    const viewer = findTestProfileByUserId(
      input.profileTestState,
      input.user.userId,
    );
    if (!viewer) return notEligibleState();
    return getTestIntroState(input, {
      manuscriptId: input.manuscriptId,
      publisherProfileId: input.publisherProfileId,
      viewerProfileId: viewer.profile.id,
    });
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer) return notEligibleState();
  return getDbIntroState(db, {
    manuscriptId: input.manuscriptId,
    publisherProfileId: input.publisherProfileId,
    viewerProfileId: viewer.id,
  });
}

export async function getAcceptedIntroContactForProfile(
  input: IntroRequestDeps & {
    targetProfileId: string;
    user: AuthenticatedUser;
  },
): Promise<AcceptedIntroContact | null> {
  if (input.config.authMode === "test") {
    const viewer = findTestProfileByUserId(
      input.profileTestState,
      input.user.userId,
    );
    const target = findTestProfileById(
      input.profileTestState,
      input.targetProfileId,
    );
    if (!viewer || !target) return null;
    const request = input.introTestState.requests.find(
      (item) =>
        item.status === "accepted" &&
        requestIncludesViewer(item, viewer.profile.id) &&
        requestIncludesViewer(item, target.profile.id),
    );
    if (!request || !isTestPairCurrentlyEligible(input, request)) return null;
    return buildTestAcceptedContact(input, target.profile.id);
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer) return null;
  const { data, error } = await db
    .from("intro_requests")
    .select()
    .eq("status", "accepted")
    .or(
      `and(author_profile_id.eq.${viewer.id},publisher_profile_id.eq.${input.targetProfileId}),and(publisher_profile_id.eq.${viewer.id},author_profile_id.eq.${input.targetProfileId})`,
    )
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (!(await isDbPairCurrentlyEligible(db, row))) return null;
  return getDbAcceptedContact(db, input.targetProfileId);
}

export async function canPublisherDownloadAcceptedIntroSample(
  input: IntroRequestDeps & {
    documentId: string;
    user: AuthenticatedUser;
  },
) {
  if (input.config.authMode === "test") {
    const viewer = findTestProfileByUserId(
      input.profileTestState,
      input.user.userId,
    );
    if (!viewer || viewer.profile.role !== "publisher") return null;
    const document = input.manuscriptTestState.documents.find(
      (item) => item.id === input.documentId,
    );
    if (!document) return null;
    const manuscript = input.manuscriptTestState.manuscripts.find(
      (item) =>
        item.id === document.manuscriptId &&
        item.sampleDocumentId === document.id,
    );
    if (
      !manuscript ||
      manuscript.eligibilityStatus !== "eligible" ||
      document.storageStatus !== "uploaded" ||
      document.processingStatus !== "succeeded" ||
      document.eligibilityStatus !== "eligible"
    ) {
      return null;
    }
    const request = input.introTestState.requests.find(
      (item) =>
        item.status === "accepted" &&
        item.manuscriptId === manuscript.id &&
        item.publisherProfileId === viewer.profile.id,
    );
    return request ? document : null;
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer || viewer.role !== "publisher") return null;
  const { data, error } = await db
    .from("documents")
    .select()
    .eq("id", input.documentId)
    .maybeSingle();
  if (error || !data) return null;
  const document = data as DocumentRecord;
  if (
    document.storage_status !== "uploaded" ||
    document.processing_status !== "succeeded" ||
    document.eligibility_status !== "eligible"
  ) {
    return null;
  }
  const { data: manuscript } = await db
    .from("manuscripts")
    .select("id, sample_document_id, eligibility_status")
    .eq("id", document.manuscript_id)
    .maybeSingle();
  if (
    !manuscript ||
    manuscript.sample_document_id !== document.id ||
    manuscript.eligibility_status !== "eligible"
  ) {
    return null;
  }
  const state = await getDbIntroState(db, {
    manuscriptId: document.manuscript_id,
    publisherProfileId: viewer.id,
    viewerProfileId: viewer.id,
  });
  return state.status === "accepted" ? document : null;
}

export async function listAdminIntroRequests(
  input: IntroRequestDeps & {
    query: AdminIntroRequestListQuery;
  },
) {
  if (input.config.authMode === "test") {
    const requests = input.introTestState.requests
      .filter((request) => filterAdminTestRequest(request, input.query))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.query.limit)
      .map((request) => toAdminSummary(input, request));
    return AdminIntroRequestListResponseSchema.parse({ requests });
  }

  const db = createIntroDb(input.config);
  let query = db
    .from("intro_requests")
    .select()
    .order("created_at", { ascending: false })
    .limit(input.query.limit);
  if (input.query.status !== "all")
    query = query.eq("status", input.query.status);
  if (input.query.manuscriptId)
    query = query.eq("manuscript_id", input.query.manuscriptId);
  if (input.query.authorProfileId)
    query = query.eq("author_profile_id", input.query.authorProfileId);
  if (input.query.publisherProfileId)
    query = query.eq("publisher_profile_id", input.query.publisherProfileId);
  if (input.query.createdFrom)
    query = query.gte("created_at", input.query.createdFrom);
  if (input.query.createdTo)
    query = query.lte("created_at", input.query.createdTo);
  const { data, error } = await query;
  if (error)
    throw new IntroRequestServiceError(
      "storage",
      "Failed to list admin intro requests",
      error,
    );
  const requests = [];
  for (const row of data ?? []) {
    const summary = await toDbAdminSummary(db, row as Record<string, unknown>);
    if (
      !input.query.requesterRole ||
      summary.requesterRole === input.query.requesterRole
    ) {
      requests.push(summary);
    }
  }
  return AdminIntroRequestListResponseSchema.parse({ requests });
}

export async function getAdminIntroRequestDetail(
  input: IntroRequestDeps & {
    requestId: string;
  },
) {
  if (input.config.authMode === "test") {
    const request = input.introTestState.requests.find(
      (item) => item.id === input.requestId,
    );
    if (!request) {
      throw new IntroRequestServiceError(
        "not_found",
        "Intro request not found",
      );
    }
    const timeline = input.introTestState.productAuditEvents.filter(
      (event) =>
        event.targetType === "intro_request" && event.targetId === request.id,
    );
    return AdminIntroRequestDetailResponseSchema.parse({
      request: toAdminSummary(input, request),
      timeline,
    });
  }

  const db = createIntroDb(input.config);
  const { data, error } = await db
    .from("intro_requests")
    .select()
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !data) {
    throw new IntroRequestServiceError(
      "not_found",
      "Intro request not found",
      error,
    );
  }
  const { data: events, error: eventsError } = await db
    .from("product_audit_events")
    .select()
    .eq("target_type", "intro_request")
    .eq("target_id", input.requestId)
    .order("created_at", { ascending: false });
  if (eventsError) {
    throw new IntroRequestServiceError(
      "storage",
      "Failed to load intro timeline",
      eventsError,
    );
  }
  return AdminIntroRequestDetailResponseSchema.parse({
    request: await toDbAdminSummary(db, data as Record<string, unknown>),
    timeline: (events ?? []).map(mapDbProductAuditEvent),
  });
}

function createIntroDb(config: ApiConfig) {
  return createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
}

function notEligibleState(): IntroState {
  return IntroStateSchema.parse({ status: "not_eligible", requestId: null });
}

function requestIncludesViewer(request: IntroRequest, viewerProfileId: string) {
  return (
    request.authorProfileId === viewerProfileId ||
    request.publisherProfileId === viewerProfileId
  );
}

function filterByBox(
  request: IntroRequest,
  viewerProfileId: string,
  box: "sent" | "received" | "all",
) {
  if (box === "sent") return request.requesterProfileId === viewerProfileId;
  if (box === "received") return request.recipientProfileId === viewerProfileId;
  return true;
}

function requireTestViewer(
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

function resolveTestPairContext(
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

function toDbLikeProfile(profile: {
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

function assertTestPairCanCreate(
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

async function resolveDbPairContext(
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

function assertPairEligibility(context: PairContext) {
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

async function assertDbPairCanCreate(db: SupabaseClient, context: PairContext) {
  assertPairEligibility(context);
  if (!(await hasDbPairEvidence(db, context))) {
    throw new IntroRequestServiceError(
      "forbidden",
      "Intro request requires stored match or approved manuscript access evidence",
    );
  }
}

function hasTestPairEvidence(input: IntroRequestDeps, context: PairContext) {
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

async function hasDbPairEvidence(db: SupabaseClient, context: PairContext) {
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

function createTestIntroRequest(
  input: IntroRequestDeps,
  context: PairContext,
  message: string | null | undefined,
) {
  const now = new Date().toISOString();
  const request = parseIntroRequest({
    id: randomUUID(),
    manuscriptId: context.manuscript.id,
    manuscriptTitle: context.manuscript.title,
    authorProfileId: context.authorProfile.id,
    authorName: context.authorProfile.display_name,
    publisherProfileId: context.publisherProfile.id,
    publisherName: context.publisherProfile.display_name,
    requesterProfileId: context.requesterProfile.id,
    requesterName: context.requesterProfile.display_name,
    recipientProfileId: context.recipientProfile.id,
    recipientName: context.recipientProfile.display_name,
    status: "pending",
    viewerRelation: "requester",
    message: message?.trim() || null,
    note: null,
    introState: {
      status: "pending_sent",
      requestId: "00000000-0000-4000-8000-000000000000",
    },
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
  });
  const saved = parseIntroRequest({
    ...request,
    introState: buildIntroState("pending_sent", request.id),
  });
  input.introTestState.requests.unshift(saved);
  recordTestLifecycle(input.introTestState, saved, context.requesterProfile.id);
  return saved;
}

function recordTestLifecycle(
  state: IntroRequestTestState,
  request: IntroRequest,
  actorProfileId: string,
) {
  const recipientProfileId =
    actorProfileId === request.requesterProfileId
      ? request.recipientProfileId
      : request.requesterProfileId;
  pushIntroNotification(state, {
    actorProfileId,
    metadata: {
      manuscript_id: request.manuscriptId,
      publisher_profile_id: request.publisherProfileId,
      status: request.status,
    },
    notificationType:
      request.status === "pending"
        ? "intro_request_created"
        : `intro_request_${request.status}`,
    recipientProfileId,
    targetId: request.id,
    targetType: "intro_request",
  });
  pushProductAuditEvent(state, {
    action:
      request.status === "pending"
        ? "intro_request_created"
        : `intro_request_${request.status}`,
    actorProfileId,
    metadata: {
      manuscript_id: request.manuscriptId,
      author_profile_id: request.authorProfileId,
      publisher_profile_id: request.publisherProfileId,
      status: request.status,
    },
    targetId: request.id,
    targetType: "intro_request",
  });
}

function enrichTestRequest(
  input: IntroRequestDeps,
  request: IntroRequest,
  viewerProfileId: string,
) {
  const state = getTestIntroState(input, {
    manuscriptId: request.manuscriptId,
    publisherProfileId: request.publisherProfileId,
    viewerProfileId,
  });
  return parseIntroRequest({
    ...request,
    viewerRelation:
      request.requesterProfileId === viewerProfileId
        ? "requester"
        : "recipient",
    introState: state,
    acceptedIntroContact:
      state.status === "accepted"
        ? buildTestAcceptedContact(
            input,
            request.authorProfileId === viewerProfileId
              ? request.publisherProfileId
              : request.authorProfileId,
          )
        : null,
    publisherSampleUnlocked:
      state.status === "accepted" &&
      request.publisherProfileId === viewerProfileId,
  });
}

function getTestIntroState(
  input: IntroRequestDeps,
  pair: {
    manuscriptId: string;
    publisherProfileId: string;
    viewerProfileId: string;
  },
): IntroState {
  const requests = input.introTestState.requests
    .filter(
      (request) =>
        request.manuscriptId === pair.manuscriptId &&
        request.publisherProfileId === pair.publisherProfileId,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const accepted = requests.find((request) => request.status === "accepted");
  if (accepted) return buildIntroState("accepted", accepted.id);
  const pending = requests.find((request) => request.status === "pending");
  if (pending) {
    return buildIntroState(
      pending.requesterProfileId === pair.viewerProfileId
        ? "pending_sent"
        : "pending_received",
      pending.id,
    );
  }
  const cooldown = requests.find(
    (request) =>
      request.status === "rejected" || request.status === "cancelled",
  );
  if (cooldown) {
    const cooldownUntil = addDays(
      cooldown.respondedAt ?? cooldown.updatedAt,
      INTRO_REQUEST_COOLDOWN_DAYS,
    );
    if (new Date(cooldownUntil).getTime() > Date.now()) {
      return buildIntroState(
        cooldown.status === "rejected"
          ? "rejected_cooldown"
          : "cancelled_cooldown",
        cooldown.id,
        { cooldownUntil },
      );
    }
  }
  const todayCount = input.introTestState.requests.filter(
    (request) =>
      request.requesterProfileId === pair.viewerProfileId &&
      isToday(request.createdAt),
  ).length;
  if (todayCount >= INTRO_REQUEST_DAILY_LIMIT) {
    return buildIntroState("quota_exhausted", null, { quotaRemaining: 0 });
  }
  return buildIntroState("can_request", null, {
    quotaRemaining: INTRO_REQUEST_DAILY_LIMIT - todayCount,
  });
}

async function getDbIntroState(
  db: SupabaseClient,
  pair: {
    manuscriptId: string;
    publisherProfileId: string;
    viewerProfileId: string;
  },
): Promise<IntroState> {
  const { data } = await db
    .from("intro_requests")
    .select()
    .eq("manuscript_id", pair.manuscriptId)
    .eq("publisher_profile_id", pair.publisherProfileId)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const accepted = rows.find((row) => row.status === "accepted");
  if (accepted) return buildIntroState("accepted", String(accepted.id));
  const pending = rows.find((row) => row.status === "pending");
  if (pending) {
    return buildIntroState(
      pending.requester_profile_id === pair.viewerProfileId
        ? "pending_sent"
        : "pending_received",
      String(pending.id),
    );
  }
  const cooldown = rows.find(
    (row) => row.status === "rejected" || row.status === "cancelled",
  );
  if (cooldown) {
    const cooldownUntil = addDays(
      String(cooldown.responded_at ?? cooldown.updated_at),
      INTRO_REQUEST_COOLDOWN_DAYS,
    );
    if (new Date(cooldownUntil).getTime() > Date.now()) {
      return buildIntroState(
        cooldown.status === "rejected"
          ? "rejected_cooldown"
          : "cancelled_cooldown",
        String(cooldown.id),
        { cooldownUntil },
      );
    }
  }
  const { count } = await db
    .from("intro_request_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", pair.viewerProfileId)
    .eq("usage_date", new Date().toISOString().slice(0, 10));
  const remaining = Math.max(0, INTRO_REQUEST_DAILY_LIMIT - (count ?? 0));
  return buildIntroState(
    remaining === 0 ? "quota_exhausted" : "can_request",
    null,
    {
      quotaRemaining: remaining,
    },
  );
}

function buildIntroState(
  status: IntroStateStatus,
  requestId: string | null,
  overrides: Partial<IntroState> = {},
): IntroState {
  return IntroStateSchema.parse({
    status,
    requestId,
    viewerCanAccept: status === "pending_received",
    viewerCanReject: status === "pending_received",
    viewerCanCancel: status === "pending_sent",
    ...overrides,
  });
}

async function mapDbIntroRequest(
  db: SupabaseClient,
  row: unknown,
  viewerProfileId: string,
): Promise<IntroRequest> {
  const request = row as Record<string, unknown>;
  const [author, publisher, manuscript] = await Promise.all([
    getDbProfileById(db, String(request.author_profile_id)),
    getDbProfileById(db, String(request.publisher_profile_id)),
    getDbManuscriptById(db, String(request.manuscript_id)),
  ]);
  if (!author || !publisher || !manuscript) {
    throw new IntroRequestServiceError(
      "storage",
      "Intro request references missing rows",
    );
  }
  const state = await getDbIntroState(db, {
    manuscriptId: manuscript.id,
    publisherProfileId: publisher.id,
    viewerProfileId,
  });
  return IntroRequestSchema.parse({
    id: request.id,
    manuscriptId: manuscript.id,
    manuscriptTitle: manuscript.title,
    authorProfileId: author.id,
    authorName: author.display_name,
    publisherProfileId: publisher.id,
    publisherName: publisher.display_name,
    requesterProfileId: request.requester_profile_id,
    requesterName:
      request.requester_profile_id === author.id
        ? author.display_name
        : publisher.display_name,
    recipientProfileId: request.recipient_profile_id,
    recipientName:
      request.recipient_profile_id === author.id
        ? author.display_name
        : publisher.display_name,
    status: request.status,
    viewerRelation:
      request.requester_profile_id === viewerProfileId
        ? "requester"
        : "recipient",
    message: request.message ?? null,
    note: request.rejection_note ?? null,
    introState: state,
    acceptedIntroContact:
      state.status === "accepted"
        ? await getDbAcceptedContact(
            db,
            author.id === viewerProfileId ? publisher.id : author.id,
          )
        : null,
    publisherSampleUnlocked:
      state.status === "accepted" && publisher.id === viewerProfileId,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    respondedAt: request.responded_at ?? null,
  });
}

async function getDbViewerProfile(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("profiles")
    .select(profileSelectColumns)
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new IntroRequestServiceError(
      "storage",
      "Failed to load profile",
      error,
    );
  return (data as ProfileRecord | null) ?? null;
}

async function getDbProfileByUserId(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("profiles")
    .select(profileSelectColumns)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProfileRecord | null) ?? null;
}

async function getDbProfileById(db: SupabaseClient, profileId: string) {
  const { data } = await db
    .from("profiles")
    .select(profileSelectColumns)
    .eq("id", profileId)
    .maybeSingle();
  return (data as ProfileRecord | null) ?? null;
}

async function getDbManuscriptById(db: SupabaseClient, manuscriptId: string) {
  const { data } = await db
    .from("manuscripts")
    .select("id,author_id,title,eligibility_status,sample_document_id")
    .eq("id", manuscriptId)
    .maybeSingle();
  return (data as ManuscriptRecord | null) ?? null;
}

async function getDbDocumentById(db: SupabaseClient, documentId: string) {
  const { data } = await db
    .from("documents")
    .select(
      "id,manuscript_id,author_id,original_file_name,mime_type,upload_id,storage_status,processing_status,eligibility_status",
    )
    .eq("id", documentId)
    .maybeSingle();
  return (data as DocumentRecord | null) ?? null;
}

function buildTestAcceptedContact(
  input: IntroRequestDeps,
  targetProfileId: string,
): AcceptedIntroContact | null {
  const target = findTestProfileById(input.profileTestState, targetProfileId);
  if (!target || target.profile.eligibilityStatus !== "eligible") return null;
  const contact =
    input.profileTestState.matchVisibleContactsByProfileId.get(targetProfileId);
  return AcceptedIntroContactSchema.parse({
    profileId: target.profile.id,
    displayName: target.profile.displayName,
    role: target.profile.role,
    email: contact?.visibility.publicEmail
      ? (contact.publicEmail ?? null)
      : null,
    phone: contact?.visibility.publicPhone
      ? (contact.publicPhone ?? null)
      : null,
    websiteUrl: contact?.visibility.websiteUrl
      ? (contact.websiteUrl ?? null)
      : null,
    socialLinks: contact?.visibility.socialLinks
      ? (contact.socialLinks ?? [])
          .filter((item) => item.visible)
          .map((item) => ({ label: item.label, url: item.url }))
      : [],
  });
}

async function getDbAcceptedContact(
  db: SupabaseClient,
  targetProfileId: string,
): Promise<AcceptedIntroContact | null> {
  const profile = await getDbProfileById(db, targetProfileId);
  if (!profile || profile.eligibility_status !== "eligible") return null;
  const contact = buildVisibleContact(
    fromDbContactSettings(profile as Record<string, unknown>),
  );
  return AcceptedIntroContactSchema.parse({
    profileId: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    email: contact.email,
    phone: contact.phone,
    websiteUrl: contact.websiteUrl,
    socialLinks: contact.socialLinks,
  });
}

function isTestPairCurrentlyEligible(
  input: IntroRequestDeps,
  request: IntroRequest,
) {
  const author = findTestProfileById(
    input.profileTestState,
    request.authorProfileId,
  );
  const publisher = findTestProfileById(
    input.profileTestState,
    request.publisherProfileId,
  );
  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === request.manuscriptId,
  );
  const sample = input.manuscriptTestState.documents.find(
    (item) => item.id === manuscript?.sampleDocumentId,
  );
  return Boolean(
    author?.profile.eligibilityStatus === "eligible" &&
    publisher?.profile.eligibilityStatus === "eligible" &&
    manuscript?.eligibilityStatus === "eligible" &&
    sample?.storageStatus === "uploaded" &&
    sample.processingStatus === "succeeded" &&
    sample.eligibilityStatus === "eligible",
  );
}

async function isDbPairCurrentlyEligible(
  db: SupabaseClient,
  request: Record<string, unknown>,
) {
  const [author, publisher, manuscript] = await Promise.all([
    getDbProfileById(db, String(request.author_profile_id)),
    getDbProfileById(db, String(request.publisher_profile_id)),
    getDbManuscriptById(db, String(request.manuscript_id)),
  ]);
  const sample = manuscript?.sample_document_id
    ? await getDbDocumentById(db, manuscript.sample_document_id)
    : null;
  return Boolean(
    author?.eligibility_status === "eligible" &&
    publisher?.eligibility_status === "eligible" &&
    manuscript?.eligibility_status === "eligible" &&
    sample?.storage_status === "uploaded" &&
    sample.processing_status === "succeeded" &&
    sample.eligibility_status === "eligible",
  );
}

function toAdminSummary(input: IntroRequestDeps, request: IntroRequest) {
  return {
    id: request.id,
    manuscriptId: request.manuscriptId,
    manuscriptTitle: request.manuscriptTitle,
    authorProfileId: request.authorProfileId,
    authorName: request.authorName,
    publisherProfileId: request.publisherProfileId,
    publisherName: request.publisherName,
    requesterProfileId: request.requesterProfileId,
    requesterRole:
      request.requesterProfileId === request.authorProfileId
        ? ("author" as const)
        : ("publisher" as const),
    recipientProfileId: request.recipientProfileId,
    status: request.status,
    currentUnlockStatus: {
      contact:
        request.status === "accepted" &&
        isTestPairCurrentlyEligible(input, request),
      publisherSample:
        request.status === "accepted" &&
        isTestPairCurrentlyEligible(input, request),
    },
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    respondedAt: request.respondedAt,
  };
}

async function toDbAdminSummary(
  db: SupabaseClient,
  row: Record<string, unknown>,
) {
  const request = await mapDbIntroRequest(
    db,
    row,
    String(row.requester_profile_id),
  );
  const eligible = await isDbPairCurrentlyEligible(db, row);
  return {
    id: request.id,
    manuscriptId: request.manuscriptId,
    manuscriptTitle: request.manuscriptTitle,
    authorProfileId: request.authorProfileId,
    authorName: request.authorName,
    publisherProfileId: request.publisherProfileId,
    publisherName: request.publisherName,
    requesterProfileId: request.requesterProfileId,
    requesterRole:
      request.requesterProfileId === request.authorProfileId
        ? ("author" as const)
        : ("publisher" as const),
    recipientProfileId: request.recipientProfileId,
    status: request.status,
    currentUnlockStatus: {
      contact: request.status === "accepted" && eligible,
      publisherSample: request.status === "accepted" && eligible,
    },
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    respondedAt: request.respondedAt,
  };
}

function filterAdminTestRequest(
  request: IntroRequest,
  query: AdminIntroRequestListQuery,
) {
  if (query.status !== "all" && request.status !== query.status) return false;
  if (query.manuscriptId && request.manuscriptId !== query.manuscriptId)
    return false;
  if (
    query.authorProfileId &&
    request.authorProfileId !== query.authorProfileId
  )
    return false;
  if (
    query.publisherProfileId &&
    request.publisherProfileId !== query.publisherProfileId
  )
    return false;
  if (query.createdFrom && request.createdAt < query.createdFrom) return false;
  if (query.createdTo && request.createdAt > query.createdTo) return false;
  if (query.requesterRole) {
    const role =
      request.requesterProfileId === request.authorProfileId
        ? "author"
        : "publisher";
    if (role !== query.requesterRole) return false;
  }
  return true;
}

function mapDbProductAuditEvent(row: Record<string, unknown>) {
  return ProductAuditEventSchema.parse({
    id: row.id,
    actorProfileId: row.actor_profile_id ?? null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  });
}

function addDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function isToday(iso: string) {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function mapDbIntroError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return new IntroRequestServiceError(
      "conflict",
      error.message ?? "Intro request conflict",
      error,
    );
  }
  if (error.code === "22023") {
    const message = error.message ?? "Intro request is not allowed";
    if (message.toLowerCase().includes("not currently eligible")) {
      return new IntroRequestServiceError("not_eligible", message, error);
    }
    return new IntroRequestServiceError(
      message.toLowerCase().includes("quota") ? "quota" : "conflict",
      message,
      error,
    );
  }
  if (error.code === "42501") {
    return new IntroRequestServiceError(
      "forbidden",
      error.message ?? "Forbidden",
      error,
    );
  }
  if (error.code === "P0002") {
    return new IntroRequestServiceError(
      "not_found",
      "Intro request not found",
      error,
    );
  }
  return new IntroRequestServiceError(
    "storage",
    error.message ?? "Intro request failed",
    error,
  );
}
