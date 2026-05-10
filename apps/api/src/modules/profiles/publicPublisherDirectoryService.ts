import {
  PublicDirectoryDecisionResponseSchema,
  PublicPublisherDirectoryResponseSchema,
} from "@marketplace/contracts";
import { billingPlanCatalog } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { findTestProfileById, type ProfileTestState } from "./testState.js";
import type { BillingTestState } from "../billing/testState.js";
import { emptyContactSettings } from "./matchContactSettings.js";
import { MatchProfileServiceError } from "./matchProfileErrors.js";

type DirectoryStatus = "approved" | "hidden" | "rejected";

export async function listPublicPublishers(input: {
  billingTestState: BillingTestState;
  config: ApiConfig;
  testState: ProfileTestState;
}) {
  if (input.config.authMode === "test") {
    const publishers = [...input.testState.profilesByUserId.values()]
      .filter(({ profile, details }) => {
        const contacts =
          input.testState.matchVisibleContactsByProfileId.get(profile.id) ??
          emptyContactSettings;
        const websiteUrl = contacts.websiteUrl;
        return (
          profile.role === "publisher" &&
          profile.eligibilityStatus === "eligible" &&
          hasEffectiveDirectoryEntitlement(
            input.billingTestState,
            profile.id,
          ) &&
          input.testState.publicDirectoryStatusByProfileId.get(profile.id) ===
            "approved" &&
          Boolean(profile.profilePhotoUrl) &&
          Boolean(profile.displayName.trim()) &&
          Boolean(websiteUrl?.startsWith("https://")) &&
          details?.role === "publisher"
        );
      })
      .map(({ profile }) => {
        const contacts =
          input.testState.matchVisibleContactsByProfileId.get(profile.id) ??
          emptyContactSettings;
        return {
          id: profile.id,
          name: profile.displayName,
          logoUrl: profile.profilePhotoUrl!,
          websiteUrl: contacts.websiteUrl!,
        };
      });

    return PublicPublisherDirectoryResponseSchema.parse({ publishers });
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db
    .from("publisher_profiles")
    .select("profile_id,publisher_name,logo_url,website_url")
    .eq("public_directory_status", "approved")
    .not("logo_url", "is", null)
    .not("publisher_name", "is", null)
    .like("website_url", "https://%");

  if (error) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to list public publishers",
      error,
    );
  }

  const publishers = [];
  for (const item of data ?? []) {
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,role,eligibility_status")
      .eq("id", item.profile_id)
      .eq("role", "publisher")
      .eq("eligibility_status", "eligible")
      .maybeSingle();
    if (profileError) {
      throw new MatchProfileServiceError(
        "storage",
        "Failed to filter public publisher directory",
        profileError,
      );
    }
    if (
      profile &&
      (await dbPublisherHasDirectoryEntitlement(db, item.profile_id))
    ) {
      publishers.push({
        id: item.profile_id,
        name: item.publisher_name,
        logoUrl: item.logo_url,
        websiteUrl: item.website_url,
      });
    }
  }

  return PublicPublisherDirectoryResponseSchema.parse({ publishers });
}

function hasEffectiveDirectoryEntitlement(
  billingTestState: BillingTestState,
  profileId: string,
): boolean {
  const active = billingTestState.subscriptions.find(
    (subscription) =>
      subscription.profileId === profileId &&
      ["trialing", "active"].includes(subscription.status) &&
      new Date(subscription.currentPeriodEnd).getTime() > Date.now(),
  );
  if (!active) return false;
  return Boolean(
    billingPlanCatalog.find((plan) => plan.slug === active.planSlug)?.limits
      .directoryVisibility,
  );
}

async function dbPublisherHasDirectoryEntitlement(
  db: ReturnType<typeof createServiceRoleSupabaseClient>,
  profileId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("subscriptions")
    .select("id,plans(limits)")
    .eq("profile_id", profileId)
    .in("status", ["trialing", "active"])
    .gt("current_period_end", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;
  const planRow = Array.isArray(data.plans) ? data.plans[0] : data.plans;
  return Boolean(
    (planRow as { limits?: Record<string, unknown> } | null)?.limits?.[
      "directoryVisibility"
    ],
  );
}

export async function applyPublicDirectoryDecision(input: {
  config: ApiConfig;
  publisherProfileId: string;
  status: DirectoryStatus;
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

    if (
      input.status === "approved" &&
      !canApprovePublicDirectoryFixture(
        input.testState,
        input.publisherProfileId,
      )
    ) {
      throw new MatchProfileServiceError(
        "not_ready",
        "Publisher profile is missing required public directory fields",
      );
    }

    input.testState.publicDirectoryStatusByProfileId.set(
      input.publisherProfileId,
      input.status,
    );
    return PublicDirectoryDecisionResponseSchema.parse({
      publisherProfileId: input.publisherProfileId,
      status: input.status,
    });
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  if (input.status === "approved") {
    const { data: publisher, error: publisherError } = await db
      .from("publisher_profiles")
      .select("profile_id,publisher_name,logo_url,website_url")
      .eq("profile_id", input.publisherProfileId)
      .maybeSingle();
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,role,eligibility_status")
      .eq("id", input.publisherProfileId)
      .maybeSingle();
    if (publisherError || profileError) {
      throw new MatchProfileServiceError(
        "storage",
        "Failed to validate public directory fields",
        publisherError ?? profileError,
      );
    }
    if (
      !publisher ||
      !profile ||
      profile.role !== "publisher" ||
      profile.eligibility_status !== "eligible" ||
      !publisher.publisher_name ||
      !publisher.logo_url?.startsWith("https://") ||
      !publisher.website_url?.startsWith("https://")
    ) {
      throw new MatchProfileServiceError(
        "not_ready",
        "Publisher profile is missing required public directory fields",
      );
    }
  }

  const { error } = await db
    .from("publisher_profiles")
    .update({
      public_directory_status: input.status,
      public_directory_reviewed_by: input.user.userId,
      public_directory_reviewed_at: new Date().toISOString(),
    })
    .eq("profile_id", input.publisherProfileId);

  if (error) {
    throw new MatchProfileServiceError(
      "storage",
      "Failed to update public directory status",
      error,
    );
  }

  return PublicDirectoryDecisionResponseSchema.parse({
    publisherProfileId: input.publisherProfileId,
    status: input.status,
  });
}

function canApprovePublicDirectoryFixture(
  state: ProfileTestState,
  publisherProfileId: string,
) {
  const publisher = findTestProfileById(state, publisherProfileId);
  const contacts =
    state.matchVisibleContactsByProfileId.get(publisherProfileId);
  return Boolean(
    publisher?.profile.eligibilityStatus === "eligible" &&
    publisher.profile.profilePhotoUrl &&
    publisher.profile.displayName.trim() &&
    contacts?.websiteUrl?.startsWith("https://"),
  );
}
