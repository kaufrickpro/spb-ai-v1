import { ManuscriptAccessRequestResponseSchema } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import {
  createTestManuscriptAccessRequest,
  type ManuscriptTestState,
} from "./testState.js";
import { ManuscriptProfileAccessError } from "./profileAccessErrors.js";
import {
  getDbProfileByUserId,
  getDbViewerProfile,
  hasDbDiscoveredAuthor,
  mapDbAccessRequest,
} from "./profileAccessDb.js";

export async function createManuscriptAccessRequest(input: {
  config: ApiConfig;
  manuscriptId: string;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  if (input.config.authMode !== "test") {
    const db = createServiceRoleSupabaseClient(
      input.config.supabaseUrl!,
      input.config.supabaseServiceRoleKey!,
    );
    const publisher = await getDbViewerProfile(db, input.user.userId);
    if (!publisher || publisher.role !== "publisher") {
      throw new ManuscriptProfileAccessError(
        "forbidden",
        "Only publishers can request manuscript access",
      );
    }
    if (publisher.eligibility_status !== "eligible") {
      throw new ManuscriptProfileAccessError(
        "forbidden",
        "Only eligible publishers can request manuscript access",
      );
    }
    const { data: manuscript, error: manuscriptError } = await db
      .from("manuscripts")
      .select()
      .eq("id", input.manuscriptId)
      .maybeSingle();
    if (manuscriptError || !manuscript) {
      throw new ManuscriptProfileAccessError(
        "not_found",
        "Manuscript not found",
        manuscriptError,
      );
    }
    if (
      manuscript.eligibility_status !== "eligible" ||
      manuscript.author_profile_visibility !== "requestable_from_author_profile"
    ) {
      throw new ManuscriptProfileAccessError(
        "not_requestable",
        "This manuscript is not requestable",
      );
    }
    const author = await getDbProfileByUserId(db, manuscript.author_id);
    if (!author) {
      throw new ManuscriptProfileAccessError("not_found", "Author not found");
    }
    if (!(await hasDbDiscoveredAuthor(db, publisher.id, author.id))) {
      throw new ManuscriptProfileAccessError(
        "forbidden",
        "Publisher has not discovered this author through matching",
      );
    }
    const { data: duplicate } = await db
      .from("manuscript_access_requests")
      .select("id")
      .eq("publisher_profile_id", publisher.id)
      .eq("manuscript_id", manuscript.id)
      .eq("status", "pending")
      .maybeSingle();
    if (duplicate) {
      throw new ManuscriptProfileAccessError(
        "conflict",
        "A manuscript access request is already pending",
      );
    }
    const { data: request, error } = await db
      .from("manuscript_access_requests")
      .insert({
        manuscript_id: manuscript.id,
        author_profile_id: author.id,
        publisher_profile_id: publisher.id,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      throw new ManuscriptProfileAccessError(
        "storage",
        "Failed to create manuscript access request",
        error,
      );
    }
    return ManuscriptAccessRequestResponseSchema.parse({
      request: mapDbAccessRequest(request, manuscript, author, publisher),
    });
  }

  const publisher = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (!publisher || publisher.profile.role !== "publisher") {
    throw new ManuscriptProfileAccessError(
      "forbidden",
      "Only publishers can request manuscript access",
    );
  }
  if (publisher.profile.eligibilityStatus !== "eligible") {
    throw new ManuscriptProfileAccessError(
      "forbidden",
      "Only eligible publishers can request manuscript access",
    );
  }

  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === input.manuscriptId,
  );
  if (!manuscript) {
    throw new ManuscriptProfileAccessError("not_found", "Manuscript not found");
  }
  if (manuscript.eligibilityStatus !== "eligible" || !manuscript.requestable) {
    throw new ManuscriptProfileAccessError(
      "not_requestable",
      "This manuscript is not requestable",
    );
  }

  const author = findTestProfileByUserId(
    input.profileTestState,
    manuscript.authorId,
  );
  if (!author) {
    throw new ManuscriptProfileAccessError("not_found", "Author not found");
  }
  if (!hasDiscoveredAuthor(input, author.profile.id)) {
    throw new ManuscriptProfileAccessError(
      "forbidden",
      "Publisher has not discovered this author through matching",
    );
  }

  const duplicate = input.manuscriptTestState.accessRequests.find(
    (request) =>
      request.manuscriptId === manuscript.id &&
      request.publisherProfileId === publisher.profile.id &&
      request.status === "pending",
  );
  if (duplicate) {
    throw new ManuscriptProfileAccessError(
      "conflict",
      "A manuscript access request is already pending",
    );
  }

  const request = createTestManuscriptAccessRequest(input.manuscriptTestState, {
    manuscriptId: manuscript.id,
    manuscriptTitle: manuscript.title,
    authorProfileId: author.profile.id,
    authorName: author.profile.displayName,
    publisherProfileId: publisher.profile.id,
    publisherName: publisher.profile.displayName,
    status: "pending",
  });

  return ManuscriptAccessRequestResponseSchema.parse({ request });
}

function hasDiscoveredAuthor(
  input: {
    profileTestState: ProfileTestState;
    user: AuthenticatedUser;
  },
  authorProfileId: string,
) {
  return input.profileTestState.profileAccessGrants.some(
    (grant) =>
      grant.viewerUserId === input.user.userId &&
      grant.targetProfileId === authorProfileId &&
      grant.source === "match_candidate",
  );
}
