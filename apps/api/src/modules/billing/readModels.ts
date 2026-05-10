import {
  BillingSubscriptionResponseSchema,
  billingPlanCatalog,
  type BillingPlan,
  type BillingSubscriptionSummary,
  type BillingUsageSummary,
  type Profile,
} from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findTestProfileByUserId } from "../profiles/testState.js";
import { BillingServiceError } from "./errors.js";
import { buildCapabilities, getEntitlementStatus } from "./entitlements.js";
import {
  createBillingDb,
  mapDbPlan,
  mapDbSubscription,
  mapTestSubscription,
} from "./dbMappers.js";
import { buildUsageSummary } from "./usageReadModels.js";
import type {
  ActiveSubscription,
  BillingDeps,
  BillingProfile,
} from "./types.js";

export async function buildBillingReadModels(input: BillingDeps): Promise<{
  subscription: BillingSubscriptionSummary;
  usage: BillingUsageSummary;
}> {
  const profile = await resolveBillingProfile(input);
  const plans = await resolvePlans(input);
  const subscription = profile
    ? await resolveActiveSubscription(input, profile, plans)
    : null;
  const trial = profile
    ? await resolveTrialSummary(input, profile)
    : { available: false, used: false, startedAt: null, endsAt: null };
  const activePlan = subscription?.plan ?? null;
  const active = Boolean(
    subscription &&
    ["trialing", "active"].includes(subscription.status) &&
    new Date(subscription.currentPeriodEnd).getTime() > Date.now(),
  );
  const entitlementStatus = getEntitlementStatus({
    active,
    profile,
    subscription,
    trialUsed: trial.used,
  });
  const capabilities = buildCapabilities({
    active,
    activePlan,
    entitlementStatus,
    profile,
    trial,
  });
  const summary = BillingSubscriptionResponseSchema.shape.subscription.parse({
    active,
    activePlan,
    capabilities,
    currentSubscription: subscription,
    entitlementStatus,
    plans,
    profileId: profile?.id ?? null,
    role: profile?.role ?? null,
    trial,
  });
  const usage = await buildUsageSummary(
    input,
    profile,
    subscription,
    activePlan,
  );
  return { subscription: summary, usage };
}

export async function resolveBillingProfile(
  input: BillingDeps,
): Promise<BillingProfile | null> {
  if (input.config.authMode === "test") {
    const record = findTestProfileByUserId(
      input.profileTestState,
      input.user.userId,
    );
    if (!record) return null;
    return toBillingProfile(record.profile, Boolean(record.details));
  }

  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("profiles")
    .select("id,user_id,role,eligibility_status")
    .eq("user_id", input.user.userId)
    .maybeSingle();
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load billing profile",
      undefined,
      error,
    );
  }
  if (!data) return null;
  const role = String(data.role) as "author" | "publisher";
  const detailsComplete = await hasDbRoleDetails(db, String(data.id), role);
  return {
    detailsComplete,
    eligibilityStatus: String(data.eligibility_status),
    id: String(data.id),
    role,
    userId: String(data.user_id),
  };
}

function toBillingProfile(
  profile: Profile,
  detailsComplete: boolean,
): BillingProfile {
  return {
    detailsComplete,
    eligibilityStatus: profile.eligibilityStatus,
    id: profile.id,
    role: profile.role,
    userId: profile.userId,
  };
}

async function hasDbRoleDetails(
  db: SupabaseClient,
  profileId: string,
  role: "author" | "publisher",
): Promise<boolean> {
  const table = role === "author" ? "author_profiles" : "publisher_profiles";
  const { data, error } = await db
    .from(table)
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load role-specific billing profile details",
      undefined,
      error,
    );
  }
  return Boolean(data);
}

async function resolvePlans(input: BillingDeps): Promise<BillingPlan[]> {
  if (input.config.authMode === "test") {
    return billingPlanCatalog;
  }
  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("plans")
    .select(
      "id,slug,role,plan_kind,billing_period,display_name,limits,price_minor",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load billing plan catalog",
      undefined,
      error,
    );
  }
  return (data ?? []).map((row) => mapDbPlan(row as Record<string, unknown>));
}

async function resolveActiveSubscription(
  input: BillingDeps,
  profile: BillingProfile,
  plans: BillingPlan[],
): Promise<ActiveSubscription | null> {
  if (input.config.authMode === "test") {
    const active = input.billingTestState.subscriptions
      .filter((item) => item.profileId === profile.id)
      .sort((left, right) =>
        right.currentPeriodEnd.localeCompare(left.currentPeriodEnd),
      )[0];
    return active ? mapTestSubscription(active, plans) : null;
  }

  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("subscriptions")
    .select(
      "id,profile_id,user_id,status,current_period_start,current_period_end,trial_started_at,trial_ends_at,plans(id,slug,role,plan_kind,billing_period,display_name,limits,price_minor)",
    )
    .eq("profile_id", profile.id)
    .in("status", ["trialing", "active", "past_due", "cancelled", "expired"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load current subscription",
      undefined,
      error,
    );
  }
  return data ? mapDbSubscription(data as Record<string, unknown>) : null;
}

async function resolveTrialSummary(
  input: BillingDeps,
  profile: BillingProfile,
) {
  if (input.config.authMode === "test") {
    const trialSubscriptionId = input.billingTestState.trialStartsByUserId.get(
      profile.userId,
    );
    const trialSubscription = input.billingTestState.subscriptions.find(
      (item) => item.id === trialSubscriptionId,
    );
    return {
      available:
        !trialSubscriptionId &&
        profile.eligibilityStatus === "eligible" &&
        profile.detailsComplete,
      used: Boolean(trialSubscriptionId),
      startedAt: trialSubscription?.trialStartedAt ?? null,
      endsAt: trialSubscription?.trialEndsAt ?? null,
    };
  }

  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("billing_trial_starts")
    .select("started_at,trial_ends_at")
    .eq("user_id", profile.userId)
    .maybeSingle();
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load trial status",
      undefined,
      error,
    );
  }
  return {
    available:
      !data &&
      profile.eligibilityStatus === "eligible" &&
      profile.detailsComplete,
    used: Boolean(data),
    startedAt: data ? String(data.started_at) : null,
    endsAt: data ? String(data.trial_ends_at) : null,
  };
}
