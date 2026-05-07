import {
  ManuscriptProfileResponseSchema,
  type ManuscriptProfile,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import { authorizeAdminUser } from "../auth/requestAuth.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import type { ManuscriptTestState } from "./testState.js";
import { ManuscriptProfileAccessError } from "./profileAccessErrors.js";
import { canViewDbManuscript } from "./profileAccessDb.js";

export async function getManuscriptProfilePage(input: {
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
    const { data: manuscript, error: manuscriptError } = await db
      .from("manuscripts")
      .select()
      .eq("id", input.manuscriptId)
      .maybeSingle();
    if (manuscriptError) {
      throw new ManuscriptProfileAccessError(
        "storage",
        "Failed to fetch manuscript profile",
        manuscriptError,
      );
    }
    if (!manuscript) {
      throw new ManuscriptProfileAccessError(
        "not_found",
        "Manuscript profile not found",
      );
    }
    if (
      !(await canViewDbManuscript({
        config: input.config,
        db,
        manuscript,
        user: input.user,
      }))
    ) {
      throw new ManuscriptProfileAccessError(
        "not_found",
        "Manuscript profile not found",
      );
    }
    const { data: author, error: authorError } = await db
      .from("profiles")
      .select()
      .eq("user_id", manuscript.author_id)
      .eq("role", "author")
      .maybeSingle();
    if (authorError || !author) {
      throw new ManuscriptProfileAccessError(
        "not_found",
        "Manuscript profile not found",
        authorError,
      );
    }
    const { data: authorDetails } = await db
      .from("author_profiles")
      .select("biography")
      .eq("profile_id", author.id)
      .maybeSingle();

    return ManuscriptProfileResponseSchema.parse({
      manuscript: {
        id: manuscript.id,
        author: {
          id: author.id,
          displayName: author.display_name,
          photoUrl: author.profile_photo_url,
          biography: authorDetails?.biography ?? null,
        },
        title: manuscript.title,
        logline: manuscript.logline ?? null,
        synopsis: manuscript.synopsis,
        primaryGenre: manuscript.genre,
        subgenres: manuscript.subgenres ?? [],
        audienceCategories: manuscript.audience_categories ?? [],
        manuscriptForm: manuscript.manuscript_form ?? null,
        compTitles: manuscript.comp_titles ?? [],
        declaredThemes: manuscript.declared_themes ?? [],
        declaredContentWarnings: manuscript.declared_content_warnings ?? [],
        arcSummary: manuscript.arc_summary ?? null,
        chapterSummaries: Array.isArray(manuscript.chapter_summaries)
          ? manuscript.chapter_summaries
          : [],
        shortTeaser: manuscript.profile_teaser ?? null,
        wordCount: manuscript.word_count,
        language: manuscript.language,
      },
    });
  }

  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === input.manuscriptId,
  );
  if (!manuscript) {
    throw new ManuscriptProfileAccessError(
      "not_found",
      "Manuscript profile not found",
    );
  }

  const author = findTestProfileByUserId(
    input.profileTestState,
    manuscript.authorId,
  );
  if (!author) {
    throw new ManuscriptProfileAccessError(
      "not_found",
      "Manuscript profile not found",
    );
  }

  if (!(await canViewManuscript(input))) {
    throw new ManuscriptProfileAccessError(
      "not_found",
      "Manuscript profile not found",
    );
  }

  const page: ManuscriptProfile = {
    id: manuscript.id,
    author: {
      id: author.profile.id,
      displayName: author.profile.displayName,
      photoUrl: author.profile.profilePhotoUrl,
      biography:
        author.details?.role === "author" ? author.details.biography : null,
    },
    title: manuscript.title,
    logline: manuscript.logline ?? null,
    synopsis: manuscript.synopsis,
    primaryGenre: manuscript.genre,
    subgenres: manuscript.subgenres ?? [],
    audienceCategories: manuscript.audienceCategories ?? [],
    manuscriptForm: manuscript.manuscriptForm ?? null,
    compTitles: manuscript.compTitles ?? [],
    declaredThemes: manuscript.declaredThemes ?? [],
    declaredContentWarnings: manuscript.declaredContentWarnings ?? [],
    arcSummary: manuscript.arcSummary ?? null,
    chapterSummaries: manuscript.chapterSummaries ?? [],
    shortTeaser: manuscript.shortTeaser ?? null,
    wordCount: manuscript.wordCount,
    language: manuscript.language,
  };

  return ManuscriptProfileResponseSchema.parse({ manuscript: page });
}

async function canViewManuscript(input: {
  config: ApiConfig;
  manuscriptId: string;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === input.manuscriptId,
  );
  if (!manuscript) return false;
  if (manuscript.authorId === input.user.userId) return true;
  if (await authorizeAdminUser(input.user, input.config)) return true;
  if (
    input.profileTestState.profileAccessGrants.some(
      (grant) =>
        grant.viewerUserId === input.user.userId &&
        grant.manuscriptId === input.manuscriptId,
    )
  ) {
    return true;
  }

  const viewerProfile = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (!viewerProfile || viewerProfile.profile.role !== "publisher") {
    return false;
  }

  return input.manuscriptTestState.accessRequests.some(
    (request) =>
      request.manuscriptId === input.manuscriptId &&
      request.publisherProfileId === viewerProfile.profile.id &&
      request.status === "approved",
  );
}
