import {
  type CompleteOnboardingDetailsRequest,
  type CreateProfileRequest,
  type OnboardingDetailsResponse,
  type ProfileResponse,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { hasAdminMembership } from "../auth/requestAuth.js";
import {
  createServiceRoleSupabaseClient,
  createUserSupabaseClient,
} from "../supabase/client.js";
import {
  mapDbAuthorDetails,
  mapDbProfile,
  mapDbPublisherDetails,
} from "./mappers.js";
import {
  completeTestProfileDetails,
  createTestProfile,
  type ProfileTestState,
  getTestProfile,
} from "./testState.js";

export class ProfileOnboardingError extends Error {
  constructor(
    readonly kind:
      | "admin_account"
      | "duplicate"
      | "not_found"
      | "role_mismatch"
      | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}

export async function createMarketplaceProfile(input: {
  config: ApiConfig;
  profile: CreateProfileRequest;
  testState?: ProfileTestState;
  user: AuthenticatedUser;
}): Promise<ProfileResponse> {
  if (await hasAdminMembership(input.user, input.config)) {
    throw new ProfileOnboardingError(
      "admin_account",
      "Admin accounts cannot create marketplace profiles",
    );
  }

  if (input.config.authMode === "test") {
    const existing = getTestProfile(input.testState!, input.user.userId);
    if (existing) {
      throw new ProfileOnboardingError(
        "duplicate",
        "A profile already exists for this account",
      );
    }

    return createTestProfile(
      input.testState!,
      input.user.userId,
      input.profile,
    );
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );

  const { data, error } = await db
    .from("profiles")
    .insert({
      user_id: input.user.userId,
      role: input.profile.role,
      display_name: input.profile.displayName,
      profile_photo_url: input.profile.profilePhotoUrl,
      signup_intent: input.profile.signupIntent,
      approval_status: "pending",
      eligibility_status: "limited",
      review_outcome: "needs_review",
      locale: input.profile.locale,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ProfileOnboardingError(
        "duplicate",
        "A profile already exists for this account",
        error,
      );
    }

    throw new ProfileOnboardingError(
      "storage",
      "Failed to insert profile",
      error,
    );
  }

  return { profile: mapDbProfile(data), details: null };
}

export async function getOwnMarketplaceProfile(input: {
  config: ApiConfig;
  testState?: ProfileTestState;
  user: AuthenticatedUser;
}): Promise<ProfileResponse> {
  if (await hasAdminMembership(input.user, input.config)) {
    throw new ProfileOnboardingError(
      "not_found",
      "No profile found for this account",
    );
  }

  if (input.config.authMode === "test") {
    const existing = getTestProfile(input.testState!, input.user.userId);
    if (!existing) {
      throw new ProfileOnboardingError(
        "not_found",
        "No profile found for this account",
      );
    }

    return existing;
  }

  const db = createUserSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseAnonKey!,
    input.user.jwt,
  );

  const { data, error } = await db
    .from("profiles")
    .select()
    .eq("user_id", input.user.userId)
    .in("role", ["author", "publisher"])
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ProfileOnboardingError(
        "not_found",
        "No profile found for this account",
        error,
      );
    }

    throw new ProfileOnboardingError(
      "storage",
      "Failed to fetch profile",
      error,
    );
  }

  const profile = mapDbProfile(data);
  const details = await getProfileDetails(db, profile.id, profile.role);

  return { profile, details };
}

export async function completeMarketplaceOnboardingDetails(input: {
  config: ApiConfig;
  details: CompleteOnboardingDetailsRequest;
  testState?: ProfileTestState;
  user: AuthenticatedUser;
}): Promise<OnboardingDetailsResponse> {
  if (await hasAdminMembership(input.user, input.config)) {
    throw new ProfileOnboardingError(
      "not_found",
      "No profile found for this account",
    );
  }

  if (input.config.authMode === "test") {
    const existing = getTestProfile(input.testState!, input.user.userId);
    if (!existing) {
      throw new ProfileOnboardingError(
        "not_found",
        "No profile found for this account",
      );
    }

    if (existing.profile.role !== input.details.role) {
      throw new ProfileOnboardingError(
        "role_mismatch",
        "Onboarding details must match the saved marketplace role",
      );
    }

    return completeTestProfileDetails(
      input.testState!,
      input.user.userId,
      input.details,
    )!;
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );

  const { data: profileData, error: profileError } = await db.rpc(
    "complete_profile_onboarding_details",
    {
      p_accepts_unsolicited:
        input.details.role === "publisher"
          ? input.details.acceptsUnsolicited
          : null,
      p_actor_user_id: input.user.userId,
      p_biography:
        input.details.role === "author" ? input.details.biography : null,
      p_style_statement:
        input.details.role === "author"
          ? (input.details.styleStatement ?? null)
          : null,
      p_influences:
        input.details.role === "author"
          ? (input.details.influences ?? [])
          : null,
      p_focus_genres:
        input.details.role === "publisher" ? input.details.focusGenres : null,
      p_preferred_languages:
        input.details.role === "publisher"
          ? input.details.preferredLanguages
          : null,
      p_publisher_name:
        input.details.role === "publisher"
          ? (input.details.publisherName ?? null)
          : null,
      p_logo_url:
        input.details.role === "publisher"
          ? (input.details.logoUrl ?? null)
          : null,
      p_website_url:
        input.details.role === "publisher"
          ? (input.details.websiteUrl ?? null)
          : null,
      p_publisher_biography:
        input.details.role === "publisher"
          ? (input.details.about ?? null)
          : null,
      p_editorial_note:
        input.details.role === "publisher"
          ? (input.details.editorialFocus ?? null)
          : null,
      p_what_we_are_looking_for:
        input.details.role === "publisher"
          ? (input.details.lookingFor ?? null)
          : null,
      p_accepted_primary_genres:
        input.details.role === "publisher" ? input.details.focusGenres : null,
      p_accepted_audience_categories:
        input.details.role === "publisher"
          ? (input.details.acceptedAudienceCategories ?? [])
          : null,
      p_accepted_manuscript_forms:
        input.details.role === "publisher"
          ? (input.details.acceptedManuscriptForms ?? [])
          : null,
      p_submission_guidelines:
        input.details.role === "publisher"
          ? (input.details.submissionGuidelines ?? null)
          : null,
      p_recent_acquisitions:
        input.details.role === "publisher"
          ? (input.details.recentAcquisitions ?? [])
          : null,
      p_best_selling_books:
        input.details.role === "publisher"
          ? (input.details.bestSellingBooks ?? [])
          : null,
      p_excluded_topics:
        input.details.role === "publisher"
          ? (input.details.excludedTopics ?? [])
          : null,
      p_editor_wishlist:
        input.details.role === "publisher"
          ? (input.details.editorWishlist ?? null)
          : null,
      p_imprint_tone:
        input.details.role === "publisher"
          ? (input.details.imprintTone ?? null)
          : null,
      p_market_positioning:
        input.details.role === "publisher"
          ? (input.details.marketPositioning ?? null)
          : null,
      p_primary_genre:
        input.details.role === "author" ? input.details.primaryGenre : null,
      p_role: input.details.role,
      p_writing_languages:
        input.details.role === "author" ? input.details.writingLanguages : null,
    },
  );

  if (profileError) {
    if (profileError.code === "P0002") {
      throw new ProfileOnboardingError(
        "not_found",
        "No profile found for this account",
        profileError,
      );
    }

    if (profileError.code === "P0004") {
      throw new ProfileOnboardingError(
        "role_mismatch",
        "Onboarding details must match the saved marketplace role",
        profileError,
      );
    }

    throw new ProfileOnboardingError(
      "storage",
      "Failed to complete onboarding details",
      profileError,
    );
  }

  return {
    profile: mapDbProfile(profileData),
    details: input.details,
  };
}

async function getProfileDetails(
  db: ReturnType<typeof createUserSupabaseClient>,
  profileId: string,
  role: CreateProfileRequest["role"],
) {
  if (role === "author") {
    const { data, error } = await db
      .from("author_profiles")
      .select()
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) {
      throw new ProfileOnboardingError(
        "storage",
        "Failed to fetch author profile details",
        error,
      );
    }

    if (data) {
      return mapDbAuthorDetails(data);
    }

    return null;
  }

  const { data, error } = await db
    .from("publisher_profiles")
    .select()
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw new ProfileOnboardingError(
      "storage",
      "Failed to fetch publisher profile details",
      error,
    );
  }

  if (data) {
    return mapDbPublisherDetails(data);
  }

  return null;
}
