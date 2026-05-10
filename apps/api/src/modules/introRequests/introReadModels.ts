import { IntroRequestSchema, type IntroRequest } from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIntroRequest } from "./testState.js";
import { IntroRequestServiceError } from "./errors.js";
import {
  buildTestAcceptedContact,
  getDbAcceptedContact,
} from "./acceptedIntroAccess.js";
import { getDbManuscriptById, getDbProfileById } from "./repository.js";
import { getDbIntroState, getTestIntroState } from "./introState.js";
import type { IntroRequestDeps } from "./types.js";

export function requestIncludesViewer(
  request: IntroRequest,
  viewerProfileId: string,
) {
  return (
    request.authorProfileId === viewerProfileId ||
    request.publisherProfileId === viewerProfileId
  );
}

export function filterByBox(
  request: IntroRequest,
  viewerProfileId: string,
  box: "sent" | "received" | "all",
) {
  if (box === "sent") return request.requesterProfileId === viewerProfileId;
  if (box === "received") return request.recipientProfileId === viewerProfileId;
  return true;
}

export async function mapDbIntroRequest(
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

export function enrichTestRequest(
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
