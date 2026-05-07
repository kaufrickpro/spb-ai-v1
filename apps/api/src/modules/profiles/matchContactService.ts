import {
  type MatchVisibleContactSettings,
  MatchVisibleContactSettingsResponseSchema,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { findTestProfileByUserId, type ProfileTestState } from "./testState.js";
import { MatchProfileServiceError } from "./matchProfileErrors.js";

export async function updateOwnMatchVisibleContacts(input: {
  config: ApiConfig;
  settings: MatchVisibleContactSettings;
  testState: ProfileTestState;
  user: AuthenticatedUser;
}) {
  if (input.config.authMode === "test") {
    const owner = findTestProfileByUserId(input.testState, input.user.userId);
    if (!owner) {
      throw new MatchProfileServiceError(
        "not_found",
        "No profile found for this account",
      );
    }

    input.testState.matchVisibleContactsByProfileId.set(
      owner.profile.id,
      input.settings,
    );
    return MatchVisibleContactSettingsResponseSchema.parse({
      settings: input.settings,
    });
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", input.user.userId)
    .maybeSingle();

  if (profileError) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to fetch profile",
      profileError,
    );
  }
  if (!profile) {
    throw new MatchProfileServiceError(
      "not_found",
      "No profile found for this account",
    );
  }

  const { error } = await db
    .from("profiles")
    .update({
      public_contact_email: input.settings.publicEmail,
      public_phone: input.settings.publicPhone,
      website_url: input.settings.websiteUrl,
      social_links: input.settings.socialLinks,
      contact_visibility: input.settings.visibility,
    })
    .eq("id", profile.id);

  if (error) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to update match-visible contacts",
      error,
    );
  }

  return MatchVisibleContactSettingsResponseSchema.parse({
    settings: input.settings,
  });
}
