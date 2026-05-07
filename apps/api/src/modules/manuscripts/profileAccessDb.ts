import type { ManuscriptAccessRequest } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import { authorizeAdminUser } from "../auth/requestAuth.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { ManuscriptProfileAccessError } from "./profileAccessErrors.js";

type DbClient = ReturnType<typeof createServiceRoleSupabaseClient>;

export async function getDbViewerProfile(db: DbClient, userId: string) {
  const { data, error } = await db
    .from("profiles")
    .select()
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new ManuscriptProfileAccessError(
      "storage",
      "Failed to resolve viewer profile",
      error,
    );
  }
  return data;
}

export async function getDbProfileByUserId(db: DbClient, userId: string) {
  const { data } = await db
    .from("profiles")
    .select()
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getDbProfileById(db: DbClient, profileId: string) {
  const { data } = await db
    .from("profiles")
    .select()
    .eq("id", profileId)
    .maybeSingle();
  return data;
}

export async function canViewDbManuscript(input: {
  config: ApiConfig;
  db: DbClient;
  manuscript: Record<string, unknown>;
  user: AuthenticatedUser;
}) {
  if (input.manuscript.author_id === input.user.userId) return true;
  if (await authorizeAdminUser(input.user, input.config)) return true;
  const viewer = await getDbViewerProfile(input.db, input.user.userId);
  if (!viewer) return false;
  const { data: grant } = await input.db
    .from("profile_access_grants")
    .select("id")
    .eq("viewer_profile_id", viewer.id)
    .eq("manuscript_id", input.manuscript.id)
    .maybeSingle();
  if (grant) return true;
  const { data: request } = await input.db
    .from("manuscript_access_requests")
    .select("id")
    .eq("publisher_profile_id", viewer.id)
    .eq("manuscript_id", input.manuscript.id)
    .eq("status", "approved")
    .maybeSingle();
  return Boolean(request);
}

export async function hasDbDiscoveredAuthor(
  db: DbClient,
  publisherProfileId: string,
  authorProfileId: string,
) {
  const { data } = await db
    .from("profile_access_grants")
    .select("id")
    .eq("viewer_profile_id", publisherProfileId)
    .eq("target_profile_id", authorProfileId)
    .eq("source", "match_candidate")
    .maybeSingle();
  return Boolean(data);
}

export function mapDbAccessRequest(
  request: Record<string, unknown>,
  manuscript: Record<string, unknown> | null,
  author: Record<string, unknown> | null,
  publisher: Record<string, unknown> | null,
): ManuscriptAccessRequest {
  return {
    id: String(request.id),
    manuscriptId: String(request.manuscript_id),
    manuscriptTitle: String(manuscript?.title ?? "Untitled"),
    authorProfileId: String(request.author_profile_id),
    authorName: String(author?.display_name ?? "Author"),
    publisherProfileId: String(request.publisher_profile_id),
    publisherName: String(publisher?.display_name ?? "Publisher"),
    status: request.status as ManuscriptAccessRequest["status"],
    createdAt: String(request.created_at),
    updatedAt: String(request.updated_at),
  };
}
