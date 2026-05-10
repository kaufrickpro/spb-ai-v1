import type { BillingPlan, BillingPlanSlug } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { BillingServiceError } from "./errors.js";
import { denial } from "./entitlements.js";
import type { ActiveSubscription } from "./types.js";
import type { BillingTestSubscription } from "./testState.js";

export function mapTestSubscription(
  subscription: BillingTestSubscription,
  plans: BillingPlan[],
): ActiveSubscription {
  const plan = plans.find((item) => item.slug === subscription.planSlug);
  if (!plan) {
    throw new BillingServiceError("storage", "Billing plan fixture is missing");
  }
  return {
    currentPeriodEnd: subscription.currentPeriodEnd,
    currentPeriodStart: subscription.currentPeriodStart,
    id: subscription.id,
    plan,
    profileId: subscription.profileId,
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    trialStartedAt: subscription.trialStartedAt,
    userId: subscription.userId,
  };
}

export function mapDbPlan(row: Record<string, unknown>): BillingPlan {
  return {
    id: String(row.id),
    billingPeriod: String(row.billing_period) as BillingPlan["billingPeriod"],
    checkoutEnabled:
      row.plan_kind === "paid" && Number(row.price_minor ?? 0) > 0,
    displayName: String(row.display_name),
    kind: String(row.plan_kind) as BillingPlan["kind"],
    limits: row.limits as BillingPlan["limits"],
    role: String(row.role) as BillingPlan["role"],
    slug: String(row.slug) as BillingPlanSlug,
  };
}

export function mapDbSubscription(
  row: Record<string, unknown>,
): ActiveSubscription {
  const planRow = Array.isArray(row.plans) ? row.plans[0] : row.plans;
  if (!planRow || typeof planRow !== "object") {
    throw new BillingServiceError(
      "storage",
      "Current subscription is missing plan data",
    );
  }
  return {
    currentPeriodEnd: String(row.current_period_end),
    currentPeriodStart: String(row.current_period_start),
    id: String(row.id),
    plan: mapDbPlan(planRow as Record<string, unknown>),
    profileId: String(row.profile_id),
    status: String(row.status) as ActiveSubscription["status"],
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    trialStartedAt: row.trial_started_at ? String(row.trial_started_at) : null,
    userId: String(row.user_id),
  };
}

export function createBillingDb(config: ApiConfig) {
  return createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
}

export function mapDbBillingError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return new BillingServiceError(
      "entitlement_denied",
      "The one-month trial has already been used.",
      denial("trial_already_used"),
      error,
    );
  }
  if (error.code === "22023") {
    return new BillingServiceError(
      "entitlement_denied",
      error.message ?? "Trial cannot be started",
      denial("profile_not_eligible"),
      error,
    );
  }
  return new BillingServiceError(
    "storage",
    "Failed to start trial",
    undefined,
    error,
  );
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
