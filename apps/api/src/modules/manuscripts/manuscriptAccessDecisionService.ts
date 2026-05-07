import { ManuscriptAccessRequestResponseSchema } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  addTestProfileAccessGrant,
  findTestProfileById,
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import {
  updateTestManuscriptAccessRequestStatus,
  type ManuscriptTestState,
} from "./testState.js";
import { ManuscriptProfileAccessError } from "./profileAccessErrors.js";
import {
  getDbProfileById,
  getDbViewerProfile,
  mapDbAccessRequest,
} from "./profileAccessDb.js";

export async function decideManuscriptAccessRequest(input: {
  config: ApiConfig;
  decision: "approved" | "rejected";
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  requestId: string;
  user: AuthenticatedUser;
}) {
  if (input.config.authMode !== "test") {
    const db = createServiceRoleSupabaseClient(
      input.config.supabaseUrl!,
      input.config.supabaseServiceRoleKey!,
    );
    const author = await getDbViewerProfile(db, input.user.userId);
    if (!author || author.role !== "author") {
      throw new ManuscriptProfileAccessError(
        "forbidden",
        "Only authors can decide manuscript access requests",
      );
    }
    const { data: existing, error: existingError } = await db
      .from("manuscript_access_requests")
      .select()
      .eq("id", input.requestId)
      .eq("author_profile_id", author.id)
      .maybeSingle();
    if (existingError || !existing) {
      throw new ManuscriptProfileAccessError(
        "not_found",
        "Manuscript access request not found",
        existingError,
      );
    }
    if (existing.status !== "pending") {
      throw new ManuscriptProfileAccessError(
        "conflict",
        "Only pending manuscript access requests can be decided",
      );
    }
    const { data: request, error } = await db
      .from("manuscript_access_requests")
      .update({
        status: input.decision,
        responded_at: new Date().toISOString(),
      })
      .eq("id", input.requestId)
      .select()
      .single();
    if (error) {
      throw new ManuscriptProfileAccessError(
        "storage",
        "Failed to decide manuscript access request",
        error,
      );
    }
    if (input.decision === "approved") {
      const { error: grantError } = await db
        .from("profile_access_grants")
        .insert({
          viewer_profile_id: request.publisher_profile_id,
          target_profile_id: request.author_profile_id,
          manuscript_id: request.manuscript_id,
          source: "manuscript_access",
        });
      if (grantError && grantError.code !== "23505") {
        throw new ManuscriptProfileAccessError(
          "storage",
          "Failed to grant manuscript profile access",
          grantError,
        );
      }
    }
    const { data: manuscript } = await db
      .from("manuscripts")
      .select("id,title")
      .eq("id", request.manuscript_id)
      .single();
    const publisher = await getDbProfileById(db, request.publisher_profile_id);
    return ManuscriptAccessRequestResponseSchema.parse({
      request: mapDbAccessRequest(request, manuscript, author, publisher),
    });
  }

  const author = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (!author || author.profile.role !== "author") {
    throw new ManuscriptProfileAccessError(
      "forbidden",
      "Only authors can decide manuscript access requests",
    );
  }

  const existing = input.manuscriptTestState.accessRequests.find(
    (request) => request.id === input.requestId,
  );
  if (!existing || existing.authorProfileId !== author.profile.id) {
    throw new ManuscriptProfileAccessError(
      "not_found",
      "Manuscript access request not found",
    );
  }
  if (existing.status !== "pending") {
    throw new ManuscriptProfileAccessError(
      "conflict",
      "Only pending manuscript access requests can be decided",
    );
  }

  const request = updateTestManuscriptAccessRequestStatus(
    input.manuscriptTestState,
    input.requestId,
    input.decision,
  );
  if (!request) {
    throw new ManuscriptProfileAccessError(
      "not_found",
      "Manuscript access request not found",
    );
  }

  if (request.status === "approved") {
    const publisher = findTestProfileById(
      input.profileTestState,
      request.publisherProfileId,
    );
    if (publisher) {
      addTestProfileAccessGrant(input.profileTestState, {
        viewerUserId: publisher.profile.userId,
        targetProfileId: request.authorProfileId,
        source: "manuscript_access",
        manuscriptId: request.manuscriptId,
      });
    }
  }

  return ManuscriptAccessRequestResponseSchema.parse({ request });
}
