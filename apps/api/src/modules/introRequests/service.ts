import {
  IntroRequestListResponseSchema,
  IntroRequestResponseSchema,
  type CreateIntroRequestRequest,
  type IntroRequestListQuery,
  type IntroState,
  type RejectIntroRequestRequest,
} from "@marketplace/contracts";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { consumeIntroRequestUsage } from "../billing/service.js";
import { findTestProfileByUserId } from "../profiles/testState.js";
import { parseIntroRequest } from "./testState.js";
import { isTestPairCurrentlyEligible } from "./acceptedIntroAccess.js";
import { IntroRequestServiceError } from "./errors.js";
import {
  getDbIntroState,
  getTestIntroState,
  notEligibleState,
} from "./introState.js";
import {
  createTestIntroRequest,
  recordTestLifecycle,
} from "./introTestLifecycle.js";
import {
  enrichTestRequest,
  filterByBox,
  mapDbIntroRequest,
  requestIncludesViewer,
} from "./introReadModels.js";
import {
  assertDbPairCanCreate,
  assertTestPairCanCreate,
  requireTestViewer,
  resolveDbPairContext,
  resolveTestPairContext,
} from "./pairContext.js";
import {
  createIntroDb,
  getDbViewerProfile,
  mapDbIntroError,
} from "./repository.js";
import type { IntroRequestDeps } from "./types.js";

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
    if (input.billingTestState) {
      await consumeIntroRequestUsage({
        billingTestState: input.billingTestState,
        config: input.config,
        introRequestId: request.id,
        manuscriptTestState: input.manuscriptTestState,
        profileTestState: input.profileTestState,
        user: input.user,
      });
    }
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

export {
  canPublisherDownloadAcceptedIntroSample,
  getAcceptedIntroContactForProfile,
} from "./acceptedIntroService.js";
export {
  getAdminIntroRequestDetail,
  listAdminIntroRequests,
} from "./adminIntroService.js";
