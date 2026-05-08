import {
  ManuscriptProfileResponseSchema,
  type ManuscriptProfile,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import { authorizeAdminUser } from "../auth/requestAuth.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  getAcceptedIntroContactForProfile,
  getIntroStateForPair,
} from "../introRequests/service.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import type { MatchingTestState } from "../matching/testState.js";
import {
  findTestProfileByUserId,
  type ProfileTestState,
} from "../profiles/testState.js";
import type { ManuscriptTestState } from "./testState.js";
import { ManuscriptProfileAccessError } from "./profileAccessErrors.js";
import { canViewDbManuscript } from "./profileAccessDb.js";

export async function getManuscriptProfilePage(input: {
  config: ApiConfig;
  introTestState?: IntroRequestTestState;
  manuscriptId: string;
  manuscriptTestState: ManuscriptTestState;
  matchingTestState?: MatchingTestState;
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
    const viewer = await getDbViewerProfile(db, input.user.userId);
    const introState =
      viewer?.role === "publisher"
        ? await getIntroStateForPair({
            config: input.config,
            introTestState: input.introTestState!,
            manuscriptId: manuscript.id,
            manuscriptTestState: input.manuscriptTestState,
            matchingTestState: input.matchingTestState!,
            profileTestState: input.profileTestState,
            publisherProfileId: viewer.id,
            user: input.user,
          })
        : null;

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
        introState,
        acceptedIntroContact:
          introState?.status === "accepted"
            ? await getAcceptedIntroContactForProfile({
                config: input.config,
                introTestState: input.introTestState!,
                manuscriptTestState: input.manuscriptTestState,
                matchingTestState: input.matchingTestState!,
                profileTestState: input.profileTestState,
                targetProfileId: author.id,
                user: input.user,
              })
            : null,
        acceptedIntroSampleDocumentId:
          introState?.status === "accepted"
            ? manuscript.sample_document_id
            : null,
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
    introState:
      input.introTestState && input.matchingTestState
        ? await getManuscriptIntroState(input, manuscript.id)
        : null,
    acceptedIntroContact: null,
    acceptedIntroSampleDocumentId: null,
  };

  if (
    page.introState?.status === "accepted" &&
    input.introTestState &&
    input.matchingTestState
  ) {
    page.acceptedIntroContact = await getAcceptedIntroContactForProfile({
      config: input.config,
      introTestState: input.introTestState,
      manuscriptTestState: input.manuscriptTestState,
      matchingTestState: input.matchingTestState,
      profileTestState: input.profileTestState,
      targetProfileId: author.profile.id,
      user: input.user,
    });
    page.acceptedIntroSampleDocumentId = manuscript.sampleDocumentId;
  }

  return ManuscriptProfileResponseSchema.parse({ manuscript: page });
}

async function canViewManuscript(input: {
  config: ApiConfig;
  manuscriptId: string;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  introTestState?: IntroRequestTestState;
  matchingTestState?: MatchingTestState;
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

  if (
    input.introTestState &&
    input.matchingTestState &&
    viewerProfile.profile.role === "publisher"
  ) {
    const state = await getIntroStateForPair({
      config: input.config,
      introTestState: input.introTestState,
      manuscriptId: input.manuscriptId,
      manuscriptTestState: input.manuscriptTestState,
      matchingTestState: input.matchingTestState,
      profileTestState: input.profileTestState,
      publisherProfileId: viewerProfile.profile.id,
      user: input.user,
    });
    if (state.status === "accepted") return true;
  }

  return input.manuscriptTestState.accessRequests.some(
    (request) =>
      request.manuscriptId === input.manuscriptId &&
      request.publisherProfileId === viewerProfile.profile.id &&
      request.status === "approved",
  );
}

async function getManuscriptIntroState(
  input: {
    config: ApiConfig;
    introTestState?: IntroRequestTestState;
    manuscriptTestState: ManuscriptTestState;
    matchingTestState?: MatchingTestState;
    profileTestState: ProfileTestState;
    user: AuthenticatedUser;
  },
  manuscriptId: string,
) {
  const viewer = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  if (
    !viewer ||
    viewer.profile.role !== "publisher" ||
    !input.introTestState ||
    !input.matchingTestState
  ) {
    return null;
  }
  return getIntroStateForPair({
    config: input.config,
    introTestState: input.introTestState,
    manuscriptId,
    manuscriptTestState: input.manuscriptTestState,
    matchingTestState: input.matchingTestState,
    profileTestState: input.profileTestState,
    publisherProfileId: viewer.profile.id,
    user: input.user,
  });
}

async function getDbViewerProfile(
  db: ReturnType<typeof createServiceRoleSupabaseClient>,
  userId: string,
) {
  const { data } = await db
    .from("profiles")
    .select("id,role")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { id: string; role: string } | null;
}
