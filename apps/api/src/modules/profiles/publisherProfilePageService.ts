import {
  type PublisherProfilePage,
  PublisherProfilePageResponseSchema,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { findTestProfileById, type ProfileTestState } from "./testState.js";
import { MatchProfileServiceError } from "./matchProfileErrors.js";
import {
  buildVisibleContact,
  fromDbContactSettings,
} from "./matchContactSettings.js";
import { canViewDbProfile, canViewProfile } from "./profileAccessPolicy.js";

export async function getPublisherProfilePage(input: {
  config: ApiConfig;
  publisherProfileId: string;
  testState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  if (input.config.authMode === "test") {
    const publisher = findTestProfileById(
      input.testState,
      input.publisherProfileId,
    );
    if (!publisher || publisher.profile.role !== "publisher") {
      throw new MatchProfileServiceError(
        "not_found",
        "Publisher profile not found",
      );
    }
    if (!(await canViewProfile(input))) {
      throw new MatchProfileServiceError(
        "not_found",
        "Publisher profile not found",
      );
    }
    if (publisher.details?.role !== "publisher") {
      throw new MatchProfileServiceError(
        "not_found",
        "Publisher profile not found",
      );
    }

    const page: PublisherProfilePage = {
      id: publisher.profile.id,
      name: publisher.profile.displayName,
      logoUrl: publisher.profile.profilePhotoUrl,
      websiteUrl:
        input.testState.matchVisibleContactsByProfileId.get(
          publisher.profile.id,
        )?.websiteUrl ?? null,
      about: publisher.details.about ?? null,
      editorialFocus: publisher.details.editorialFocus ?? null,
      lookingFor: publisher.details.lookingFor ?? null,
      acceptedGenres: publisher.details.focusGenres,
      acceptedLanguages: publisher.details.preferredLanguages,
      acceptedAudienceCategories:
        publisher.details.acceptedAudienceCategories ?? [],
      acceptedManuscriptForms: publisher.details.acceptedManuscriptForms ?? [],
      acceptsUnsolicited: publisher.details.acceptsUnsolicited,
      submissionGuidelines: publisher.details.submissionGuidelines ?? null,
      excludedTopics: publisher.details.excludedTopics ?? [],
      editorWishlist: publisher.details.editorWishlist ?? null,
      imprintTone: publisher.details.imprintTone ?? null,
      marketPositioning: publisher.details.marketPositioning ?? null,
      recentAcquisitions: publisher.details.recentAcquisitions ?? [],
      bestSellingBooks: publisher.details.bestSellingBooks ?? [],
      contact: buildVisibleContact(
        input.testState.matchVisibleContactsByProfileId.get(
          publisher.profile.id,
        ),
      ),
    };

    return PublisherProfilePageResponseSchema.parse({ publisher: page });
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select()
    .eq("id", input.publisherProfileId)
    .eq("role", "publisher")
    .maybeSingle();
  if (profileError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to fetch publisher profile",
      profileError,
    );
  }
  if (!profile) {
    throw new MatchProfileServiceError(
      "not_found",
      "Publisher profile not found",
    );
  }
  if (
    !(await canViewDbProfile({ ...input, db, targetProfileId: profile.id }))
  ) {
    throw new MatchProfileServiceError(
      "not_found",
      "Publisher profile not found",
    );
  }

  const { data: details, error: detailsError } = await db
    .from("publisher_profiles")
    .select()
    .eq("profile_id", input.publisherProfileId)
    .maybeSingle();
  if (detailsError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to fetch publisher details",
      detailsError,
    );
  }
  if (!details) {
    throw new MatchProfileServiceError(
      "not_found",
      "Publisher profile not found",
    );
  }

  return PublisherProfilePageResponseSchema.parse({
    publisher: {
      id: profile.id,
      name: details.publisher_name ?? profile.display_name,
      logoUrl: details.logo_url ?? profile.profile_photo_url,
      websiteUrl: details.website_url ?? profile.website_url,
      about: details.biography ?? null,
      editorialFocus: details.editorial_note ?? null,
      lookingFor: details.what_we_are_looking_for ?? null,
      acceptedGenres:
        details.accepted_primary_genres?.length > 0
          ? details.accepted_primary_genres
          : details.focus_genres,
      acceptedLanguages: details.preferred_languages,
      acceptedAudienceCategories: details.accepted_audience_categories ?? [],
      acceptedManuscriptForms: details.accepted_manuscript_forms ?? [],
      acceptsUnsolicited: details.accepts_unsolicited,
      submissionGuidelines: details.submission_guidelines ?? null,
      excludedTopics: details.excluded_topics ?? [],
      editorWishlist: details.editor_wishlist ?? null,
      imprintTone: details.imprint_tone ?? null,
      marketPositioning: details.market_positioning ?? null,
      recentAcquisitions: details.recent_acquisitions ?? [],
      bestSellingBooks: details.best_selling_books ?? [],
      contact: buildVisibleContact(fromDbContactSettings(profile)),
    },
  });
}
