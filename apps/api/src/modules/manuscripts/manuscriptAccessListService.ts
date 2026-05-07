import { ManuscriptAccessRequestListResponseSchema } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import type { ManuscriptTestState } from "./testState.js";
import { ManuscriptProfileAccessError } from "./profileAccessErrors.js";
import {
  getDbProfileById,
  getDbViewerProfile,
  mapDbAccessRequest,
} from "./profileAccessDb.js";

export async function listManuscriptAccessRequests(input: {
  config: ApiConfig;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  if (input.config.authMode !== "test") {
    const db = createServiceRoleSupabaseClient(
      input.config.supabaseUrl!,
      input.config.supabaseServiceRoleKey!,
    );
    const profile = await getDbViewerProfile(db, input.user.userId);
    if (!profile) {
      throw new ManuscriptProfileAccessError(
        "not_found",
        "No profile found for this account",
      );
    }
    const column =
      profile.role === "author" ? "author_profile_id" : "publisher_profile_id";
    const { data, error } = await db
      .from("manuscript_access_requests")
      .select()
      .eq(column, profile.id)
      .order("created_at", { ascending: false });
    if (error) {
      throw new ManuscriptProfileAccessError(
        "storage",
        "Failed to list manuscript access requests",
        error,
      );
    }
    const requests = [];
    for (const request of data ?? []) {
      const { data: manuscript } = await db
        .from("manuscripts")
        .select("id,title")
        .eq("id", request.manuscript_id)
        .single();
      const author = await getDbProfileById(db, request.author_profile_id);
      const publisher = await getDbProfileById(
        db,
        request.publisher_profile_id,
      );
      if (manuscript && author && publisher) {
        requests.push(
          mapDbAccessRequest(request, manuscript, author, publisher),
        );
      }
    }
    return ManuscriptAccessRequestListResponseSchema.parse({ requests });
  }

  const profile = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (!profile) {
    throw new ManuscriptProfileAccessError(
      "not_found",
      "No profile found for this account",
    );
  }

  const requests = input.manuscriptTestState.accessRequests.filter((request) =>
    profile.profile.role === "author"
      ? request.authorProfileId === profile.profile.id
      : request.publisherProfileId === profile.profile.id,
  );

  return ManuscriptAccessRequestListResponseSchema.parse({ requests });
}
