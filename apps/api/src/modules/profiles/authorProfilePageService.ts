import {
  type AuthorProfilePage,
  type AuthorVisibleManuscript,
  AuthorProfilePageResponseSchema,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import { findTestProfileById, type ProfileTestState } from "./testState.js";
import { MatchProfileServiceError } from "./matchProfileErrors.js";
import {
  buildVisibleContact,
  fromDbContactSettings,
} from "./matchContactSettings.js";
import {
  canViewDbManuscript,
  canViewDbProfile,
  canViewProfile,
  dbRequestStatus,
  hasManuscriptAccess,
  requestStatusFor,
} from "./profileAccessPolicy.js";

export async function getAuthorProfilePage(input: {
  config: ApiConfig;
  authorProfileId: string;
  manuscriptTestState: ManuscriptTestState;
  testState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  if (input.config.authMode === "test") {
    const author = findTestProfileById(input.testState, input.authorProfileId);
    if (!author || author.profile.role !== "author") {
      throw new MatchProfileServiceError(
        "not_found",
        "Author profile not found",
      );
    }
    if (
      !(await canViewProfile({
        ...input,
        publisherProfileId: input.authorProfileId,
      }))
    ) {
      throw new MatchProfileServiceError(
        "not_found",
        "Author profile not found",
      );
    }

    const visibleManuscripts: AuthorVisibleManuscript[] = [];
    for (const item of input.manuscriptTestState.manuscripts.filter(
      (manuscript) => manuscript.authorId === author.profile.userId,
    )) {
      const hasFullAccess = hasManuscriptAccess(input, item.id);
      if (hasFullAccess) {
        visibleManuscripts.push({
          id: item.id,
          title: item.title,
          genre: item.genre,
          manuscriptForm: item.manuscriptForm ?? null,
          shortTeaser: item.shortTeaser ?? null,
          logline: item.logline ?? null,
          synopsis: item.synopsis,
          access: "full",
          requestStatus: requestStatusFor(input, item.id),
        });
        continue;
      }
      if (item.eligibilityStatus === "eligible" && item.requestable) {
        visibleManuscripts.push({
          id: item.id,
          title: item.title,
          genre: item.genre,
          manuscriptForm: item.manuscriptForm ?? null,
          shortTeaser: item.shortTeaser ?? null,
          access: "requestable_teaser",
          requestStatus: requestStatusFor(input, item.id),
        });
      }
    }

    const page: AuthorProfilePage = {
      id: author.profile.id,
      displayName: author.profile.displayName,
      photoUrl: author.profile.profilePhotoUrl,
      biography:
        author.details?.role === "author" ? author.details.biography : null,
      styleStatement:
        author.details?.role === "author"
          ? (author.details.styleStatement ?? null)
          : null,
      influences:
        author.details?.role === "author"
          ? (author.details.influences ?? [])
          : [],
      contact: buildVisibleContact(
        input.testState.matchVisibleContactsByProfileId.get(author.profile.id),
      ),
      manuscripts: visibleManuscripts,
    };

    return AuthorProfilePageResponseSchema.parse({ author: page });
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select()
    .eq("id", input.authorProfileId)
    .eq("role", "author")
    .maybeSingle();
  if (profileError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to fetch author profile",
      profileError,
    );
  }
  if (!profile) {
    throw new MatchProfileServiceError("not_found", "Author profile not found");
  }
  if (
    !(await canViewDbProfile({ ...input, db, targetProfileId: profile.id }))
  ) {
    throw new MatchProfileServiceError("not_found", "Author profile not found");
  }

  const { data: details, error: detailsError } = await db
    .from("author_profiles")
    .select()
    .eq("profile_id", input.authorProfileId)
    .maybeSingle();
  if (detailsError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to fetch author details",
      detailsError,
    );
  }

  const { data: manuscripts, error: manuscriptsError } = await db
    .from("manuscripts")
    .select()
    .eq("author_id", profile.user_id)
    .eq("eligibility_status", "eligible");
  if (manuscriptsError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to fetch author manuscripts",
      manuscriptsError,
    );
  }

  const visibleManuscripts: AuthorVisibleManuscript[] = [];
  for (const manuscript of manuscripts ?? []) {
    const access = await canViewDbManuscript({
      db,
      manuscript,
      user: input.user,
      config: input.config,
    });
    if (access) {
      visibleManuscripts.push({
        id: manuscript.id,
        title: manuscript.title,
        genre: manuscript.genre,
        manuscriptForm: manuscript.manuscript_form ?? null,
        shortTeaser: manuscript.profile_teaser ?? null,
        logline: manuscript.logline ?? null,
        synopsis: manuscript.synopsis,
        access: "full",
        requestStatus: await dbRequestStatus({
          db,
          manuscriptId: manuscript.id,
          user: input.user,
        }),
      });
    } else if (
      manuscript.author_profile_visibility === "requestable_from_author_profile"
    ) {
      visibleManuscripts.push({
        id: manuscript.id,
        title: manuscript.title,
        genre: manuscript.genre,
        manuscriptForm: manuscript.manuscript_form ?? null,
        shortTeaser: manuscript.profile_teaser ?? null,
        access: "requestable_teaser",
        requestStatus: await dbRequestStatus({
          db,
          manuscriptId: manuscript.id,
          user: input.user,
        }),
      });
    }
  }

  return AuthorProfilePageResponseSchema.parse({
    author: {
      id: profile.id,
      displayName: profile.display_name,
      photoUrl: profile.profile_photo_url,
      biography: details?.biography ?? null,
      styleStatement: details?.style_statement ?? null,
      influences: details?.influences ?? [],
      contact: buildVisibleContact(fromDbContactSettings(profile)),
      manuscripts: visibleManuscripts,
    },
  });
}
