import { randomUUID } from "node:crypto";
import {
  PaytrCheckoutResponseSchema,
  type BillingPlanSlug,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { findTestProfileByUserId } from "../profiles/testState.js";
import { BillingServiceError } from "./errors.js";
import { addTestCheckoutSession, type BillingTestState } from "./testState.js";
import { buildBillingReadModels, denial } from "./service.js";
import {
  createFixturePaytrCheckoutAdapter,
  createPaytrCheckoutAdapter,
} from "./paytr.js";
import type { CheckoutSessionRecord, PaytrBillingDeps } from "./paytrTypes.js";

const TEST_PLAN_PRICES_MINOR: Record<BillingPlanSlug, number> = {
  "author-trial": 0,
  "publisher-trial": 0,
  "author-pro-monthly": 10_000,
  "author-pro-annual": 100_000,
  "publisher-pro-monthly": 20_000,
  "publisher-pro-annual": 200_000,
};

export async function createPaytrCheckoutToken(
  input: PaytrBillingDeps & { planSlug: BillingPlanSlug; requestIp: string },
) {
  const readModels = await buildBillingReadModels(input);
  const profile = findTestProfileByUserId(
    input.profileTestState,
    input.user.userId,
  );
  const plan = readModels.subscription.plans.find(
    (item) => item.slug === input.planSlug,
  );

  if (!plan || plan.kind !== "paid") {
    throw new BillingServiceError(
      "entitlement_denied",
      "Choose a paid monthly or annual plan.",
      denial("role_not_allowed"),
    );
  }
  if (plan.role !== readModels.subscription.role) {
    throw new BillingServiceError(
      "entitlement_denied",
      "This paid plan is not available for your marketplace role.",
      denial("role_not_allowed"),
    );
  }
  if (
    !["trial_available", "trialing", "expired", "inactive"].includes(
      readModels.subscription.entitlementStatus,
    )
  ) {
    throw new BillingServiceError(
      "entitlement_denied",
      "Complete profile eligibility before checkout.",
      readModels.subscription.capabilities.startTrial.denial ??
        denial("profile_not_eligible"),
    );
  }
  if (
    readModels.subscription.active &&
    readModels.subscription.currentSubscription?.plan.kind === "paid"
  ) {
    throw new BillingServiceError(
      "entitlement_denied",
      "A paid subscription is already active.",
      denial("subscription_inactive"),
    );
  }

  if (
    input.config.authMode !== "test" &&
    input.config.paytrProviderMode === "disabled"
  ) {
    throw new BillingServiceError(
      "not_ready",
      "PayTR checkout is not configured.",
    );
  }

  const priceMinor = await resolvePlanPriceMinor(input.config, input.planSlug);
  if (priceMinor <= 0) {
    throw new BillingServiceError(
      "not_ready",
      "Paid plan pricing must be configured before checkout.",
    );
  }

  const adapter =
    input.paytrAdapter ??
    (input.config.authMode === "test"
      ? createFixturePaytrCheckoutAdapter()
      : createPaytrCheckoutAdapter(input.config));
  const merchantOid = createMerchantOid();
  const displayName =
    profile?.profile.displayName ??
    readModels.subscription.currentSubscription?.profileId ??
    "Smart Publishing Bridge user";
  const token = await adapter.createCheckoutToken({
    email: await resolveCheckoutEmail(input.config, input.user),
    failUrl: `${input.config.webAppUrl}/app/billing?checkout=failed`,
    merchantOid,
    okUrl: `${input.config.webAppUrl}/app/billing?checkout=success`,
    paymentAmountMinor: priceMinor,
    planDisplayName: plan.displayName,
    userIp: sanitizeIp(input.requestIp),
    userName: displayName.slice(0, 60),
  });

  await persistCheckoutSession(
    input.config,
    input.billingTestState,
    {
      amountMinor: priceMinor,
      merchantOid,
      planSlug: plan.slug,
      profileId: readModels.subscription.profileId!,
      status: "created",
      userId: input.user.userId,
    },
    token.token,
  );

  return PaytrCheckoutResponseSchema.parse({
    checkout: {
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${token.token}`,
      orderId: merchantOid,
      plan,
      provider: "paytr",
      token: token.token,
    },
  });
}

async function resolvePlanPriceMinor(
  config: ApiConfig,
  planSlug: BillingPlanSlug,
): Promise<number> {
  if (config.authMode === "test") {
    return TEST_PLAN_PRICES_MINOR[planSlug];
  }
  const db = createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db
    .from("plans")
    .select("price_minor")
    .eq("slug", planSlug)
    .eq("plan_kind", "paid")
    .maybeSingle();
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load paid plan price",
      undefined,
      error,
    );
  }
  return Number(data?.price_minor ?? 0);
}

async function resolveCheckoutEmail(
  config: ApiConfig,
  user: AuthenticatedUser,
): Promise<string> {
  if (config.authMode === "test") {
    return `${user.userId}@example.test`;
  }
  const db = createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db.auth.admin.getUserById(user.userId);
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load checkout identity",
      undefined,
      error,
    );
  }
  return data.user.email ?? `${user.userId}@spb-ai.local`;
}

async function persistCheckoutSession(
  config: ApiConfig,
  state: BillingTestState,
  session: CheckoutSessionRecord,
  token: string,
) {
  if (config.authMode === "test") {
    addTestCheckoutSession(state, {
      ...session,
      currency: "TRY",
      token,
    });
    return;
  }
  const db = createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
  const { data: plan, error: planError } = await db
    .from("plans")
    .select("id")
    .eq("slug", session.planSlug)
    .single();
  if (planError) {
    throw new BillingServiceError(
      "storage",
      "Failed to resolve checkout plan",
      undefined,
      planError,
    );
  }
  const { error } = await db.from("paytr_checkout_sessions").insert({
    amount_minor: session.amountMinor,
    checkout_token: token,
    currency: "TRY",
    merchant_oid: session.merchantOid,
    plan_id: plan.id,
    profile_id: session.profileId,
    status: session.status,
    user_id: session.userId,
  });
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to store checkout session",
      undefined,
      error,
    );
  }
}

function createMerchantOid(): string {
  return `SPB${Date.now()}${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function sanitizeIp(value: string): string {
  if (value === "::1") return "127.0.0.1";
  return value.slice(0, 39);
}
