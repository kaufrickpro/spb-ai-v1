import { randomUUID } from "node:crypto";
import type { IntroRequest } from "@marketplace/contracts";
import { buildIntroState } from "./introState.js";
import {
  parseIntroRequest,
  pushIntroNotification,
  pushProductAuditEvent,
} from "./testState.js";
import type { IntroRequestTestState } from "./testState.js";
import type { IntroRequestDeps, PairContext } from "./types.js";

export function createTestIntroRequest(
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

export function recordTestLifecycle(
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
