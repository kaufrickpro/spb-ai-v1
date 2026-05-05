import {
  type CompleteOnboardingDetailsRequest,
  type CreateProfileRequest,
  type OnboardingDetailsResponse,
  type ProfileResponse,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { hasAdminMembership } from "../auth/requestAuth.js";
import { createUserSupabaseClient } from "../supabase/client.js";
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

  const db = createUserSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseAnonKey!,
    input.user.jwt,
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

  const db = createUserSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseAnonKey!,
    input.user.jwt,
  );

  const existing = await getOwnMarketplaceProfile({
    config: input.config,
    user: input.user,
  });

  if (existing.profile.role !== input.details.role) {
    throw new ProfileOnboardingError(
      "role_mismatch",
      "Onboarding details must match the saved marketplace role",
    );
  }

  if (input.details.role === "author") {
    const { error } = await db.from("author_profiles").upsert(
      {
        profile_id: existing.profile.id,
        biography: input.details.biography,
        primary_genre: input.details.primaryGenre,
        writing_languages: input.details.writingLanguages,
      },
      { onConflict: "profile_id" },
    );

    if (error) {
      throw new ProfileOnboardingError(
        "storage",
        "Failed to save author onboarding details",
        error,
      );
    }
  } else {
    const { error } = await db.from("publisher_profiles").upsert(
      {
        profile_id: existing.profile.id,
        focus_genres: input.details.focusGenres,
        preferred_languages: input.details.preferredLanguages,
        accepts_unsolicited: input.details.acceptsUnsolicited,
      },
      { onConflict: "profile_id" },
    );

    if (error) {
      throw new ProfileOnboardingError(
        "storage",
        "Failed to save publisher onboarding details",
        error,
      );
    }
  }

  const { data: profileData, error: profileError } = await db
    .from("profiles")
    .update({
      approval_status: "approved",
      eligibility_status: "eligible",
      review_outcome: "auto_approved",
    })
    .eq("id", existing.profile.id)
    .select()
    .single();

  if (profileError) {
    throw new ProfileOnboardingError(
      "storage",
      "Failed to update profile eligibility",
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
