import type { ApiConfig } from "../config/config.js";
import { authorizeAdminUser } from "../auth/requestAuth.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import {
  findTestProfileById,
  findTestProfileByUserId,
  type ProfileTestState,
} from "./testState.js";
import { MatchProfileServiceError } from "./matchProfileErrors.js";

export async function canViewProfile(input: {
  config: ApiConfig;
  publisherProfileId: string;
  testState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  const target = findTestProfileById(input.testState, input.publisherProfileId);
  if (!target) return false;
  if (target.profile.userId === input.user.userId) return true;
  if (await authorizeAdminUser(input.user, input.config)) return true;
  return input.testState.profileAccessGrants.some(
    (grant) =>
      grant.viewerUserId === input.user.userId &&
      grant.targetProfileId === input.publisherProfileId &&
      grant.source === "match_candidate",
  );
}

export function hasManuscriptAccess(
  input: {
    manuscriptTestState: ManuscriptTestState;
    testState: ProfileTestState;
    user: AuthenticatedUser;
  },
  manuscriptId: string,
) {
  if (
    input.testState.profileAccessGrants.some(
      (grant) =>
        grant.viewerUserId === input.user.userId &&
        grant.manuscriptId === manuscriptId,
    )
  ) {
    return true;
  }

  return input.manuscriptTestState.accessRequests.some(
    (request) =>
      request.manuscriptId === manuscriptId &&
      request.status === "approved" &&
      findTestProfileById(input.testState, request.publisherProfileId)?.profile
        .userId === input.user.userId,
  );
}

export function requestStatusFor(
  input: {
    manuscriptTestState: ManuscriptTestState;
    testState: ProfileTestState;
    user: AuthenticatedUser;
  },
  manuscriptId: string,
) {
  const viewerProfile = findTestProfileByUserId(
    input.testState,
    input.user.userId,
  );
  if (!viewerProfile || viewerProfile.profile.role !== "publisher") {
    return "none" as const;
  }

  return (
    input.manuscriptTestState.accessRequests.find(
      (request) =>
        request.manuscriptId === manuscriptId &&
        request.publisherProfileId === viewerProfile.profile.id,
    )?.status ?? ("none" as const)
  );
}

export async function canViewDbProfile(input: {
  config: ApiConfig;
  db: ReturnType<typeof createServiceRoleSupabaseClient>;
  targetProfileId: string;
  user: AuthenticatedUser;
}) {
  const { data: viewer, error: viewerError } = await input.db
    .from("profiles")
    .select("id,user_id")
    .eq("user_id", input.user.userId)
    .maybeSingle();
  if (viewerError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to resolve viewer profile",
      viewerError,
    );
  }
  if (viewer?.id === input.targetProfileId) return true;
  if (await authorizeAdminUser(input.user, input.config)) return true;
  if (!viewer) return false;

  const { data: grant, error: grantError } = await input.db
    .from("profile_access_grants")
    .select("id")
    .eq("viewer_profile_id", viewer.id)
    .eq("target_profile_id", input.targetProfileId)
    .eq("source", "match_candidate")
    .limit(1)
    .maybeSingle();
  if (grantError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to resolve profile access",
      grantError,
    );
  }
  return Boolean(grant);
}

export async function canViewDbManuscript(input: {
  config: ApiConfig;
  db: ReturnType<typeof createServiceRoleSupabaseClient>;
  manuscript: Record<string, unknown>;
  user: AuthenticatedUser;
}) {
  if (input.manuscript.author_id === input.user.userId) return true;
  if (await authorizeAdminUser(input.user, input.config)) return true;
  const { data: viewer } = await input.db
    .from("profiles")
    .select("id")
    .eq("user_id", input.user.userId)
    .maybeSingle();
  if (!viewer) return false;
  const { data: grant, error: grantError } = await input.db
    .from("profile_access_grants")
    .select("id")
    .eq("viewer_profile_id", viewer.id)
    .eq("manuscript_id", input.manuscript.id)
    .limit(1)
    .maybeSingle();
  if (grantError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to resolve manuscript access",
      grantError,
    );
  }
  if (grant) return true;
  const { data: request, error: requestError } = await input.db
    .from("manuscript_access_requests")
    .select("id")
    .eq("publisher_profile_id", viewer.id)
    .eq("manuscript_id", input.manuscript.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (requestError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to resolve manuscript access request",
      requestError,
    );
  }
  return Boolean(request);
}

export async function dbRequestStatus(input: {
  db: ReturnType<typeof createServiceRoleSupabaseClient>;
  manuscriptId: string;
  user: AuthenticatedUser;
}) {
  const { data: viewer } = await input.db
    .from("profiles")
    .select("id,role")
    .eq("user_id", input.user.userId)
    .maybeSingle();
  if (!viewer || viewer.role !== "publisher") return "none" as const;
  const { data: request } = await input.db
    .from("manuscript_access_requests")
    .select("status")
    .eq("publisher_profile_id", viewer.id)
    .eq("manuscript_id", input.manuscriptId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return request?.status ?? ("none" as const);
}
