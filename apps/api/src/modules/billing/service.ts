import {
  BillingSubscriptionResponseSchema,
  BillingUsageResponseSchema,
  StartTrialResponseSchema,
} from "@marketplace/contracts";
import { findTestProfileByUserId } from "../profiles/testState.js";
import { BillingServiceError } from "./errors.js";
import { addTestSubscription, addTestUsageLedgerEntry } from "./testState.js";
import { addMonths, createBillingDb, mapDbBillingError } from "./dbMappers.js";
import { denial, getCapability } from "./entitlements.js";
import { buildBillingReadModels, resolveBillingProfile } from "./readModels.js";
import type { BillingAction, BillingDeps } from "./types.js";

export async function getBillingSubscription(input: BillingDeps) {
  const response = await buildBillingReadModels(input);
  return BillingSubscriptionResponseSchema.parse({
    subscription: response.subscription,
  });
}

export async function getBillingUsage(input: BillingDeps) {
  const response = await buildBillingReadModels(input);
  return BillingUsageResponseSchema.parse({ usage: response.usage });
}

export async function startBillingTrial(input: BillingDeps) {
  const current = await buildBillingReadModels(input);
  const startTrial = current.subscription.capabilities.startTrial;
  if (!startTrial.allowed) {
    if (
      current.subscription.currentSubscription?.status === "trialing" &&
      current.subscription.active
    ) {
      return StartTrialResponseSchema.parse(current);
    }
    throw new BillingServiceError(
      "entitlement_denied",
      startTrial.denial?.message ?? "Trial cannot be started",
      startTrial.denial ?? undefined,
    );
  }

  const profile = await resolveBillingProfile(input);
  if (!profile) {
    throw new BillingServiceError("not_found", "No marketplace profile found");
  }

  const planSlug =
    profile.role === "author" ? "author-trial" : "publisher-trial";
  if (input.config.authMode === "test") {
    const now = new Date();
    const startsAt = now.toISOString();
    const endsAt = addMonths(now, 1).toISOString();
    addTestSubscription(input.billingTestState, {
      currentPeriodStart: startsAt,
      currentPeriodEnd: endsAt,
      planSlug,
      profileId: profile.id,
      status: "trialing",
      trialEndsAt: endsAt,
      trialStartedAt: startsAt,
      userId: profile.userId,
    });
  } else {
    const db = createBillingDb(input.config);
    const { error } = await db.rpc("start_role_trial", {
      p_actor_user_id: input.user.userId,
      p_plan_slug: planSlug,
      p_profile_id: profile.id,
    });
    if (error) {
      throw mapDbBillingError(error);
    }
  }

  return StartTrialResponseSchema.parse(await buildBillingReadModels(input));
}

export async function assertEntitlementForAction(
  input: BillingDeps & { action: BillingAction },
) {
  const { subscription } = await buildBillingReadModels(input);
  const capability = getCapability(subscription, input.action);
  if (!capability.allowed) {
    throw new BillingServiceError(
      "entitlement_denied",
      capability.denial?.message ?? "Active entitlement is required",
      capability.denial ?? undefined,
    );
  }
  return subscription;
}

export async function assertCanUploadSample(
  input: BillingDeps & {
    fileSizeBytes: number;
    manuscriptId?: string | null;
    replacementDocumentId?: string | null;
  },
) {
  if (
    input.config.authMode === "test" &&
    !findTestProfileByUserId(input.profileTestState, input.user.userId)
  ) {
    return null;
  }
  const { subscription, usage } = await buildBillingReadModels(input);
  const capability = subscription.capabilities.uploadSample;
  if (!capability.allowed) {
    throw new BillingServiceError(
      "entitlement_denied",
      capability.denial?.message ?? "Active entitlement is required",
      capability.denial ?? undefined,
    );
  }
  const replacementBytes = input.manuscriptId
    ? await computeActiveManuscriptStorageUsage(input, input.manuscriptId)
    : 0;
  const projectedUsedBytes =
    usage.storage.usedBytes - replacementBytes + input.fileSizeBytes;
  if (projectedUsedBytes > usage.storage.limitBytes) {
    throw new BillingServiceError(
      "entitlement_denied",
      "Storage limit exceeded",
      denial("storage_limit_exceeded"),
    );
  }
  return subscription;
}

async function computeActiveManuscriptStorageUsage(
  input: BillingDeps,
  manuscriptId: string,
): Promise<number> {
  if (input.config.authMode === "test") {
    return (input.manuscriptTestState?.documents ?? [])
      .filter((item) => item.manuscriptId === manuscriptId)
      .filter((item) => ["uploaded", "attached"].includes(item.storageStatus))
      .reduce((sum, item) => sum + item.fileSizeBytes, 0);
  }
  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("documents")
    .select("file_size_bytes")
    .eq("manuscript_id", manuscriptId)
    .in("storage_status", ["uploaded", "attached"]);
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load replacement storage usage",
      undefined,
      error,
    );
  }
  return (data ?? []).reduce(
    (sum, row: { file_size_bytes?: number }) =>
      sum + Number(row.file_size_bytes ?? 0),
    0,
  );
}

export async function consumeIntroRequestUsage(
  input: BillingDeps & { introRequestId: string },
) {
  const { subscription, usage } = await buildBillingReadModels(input);
  const capability = subscription.capabilities.sendIntroRequest;
  if (!capability.allowed) {
    throw new BillingServiceError(
      "entitlement_denied",
      capability.denial?.message ?? "Active entitlement is required",
      capability.denial ?? undefined,
    );
  }
  if (usage.introRequests.remaining <= 0 || !subscription.currentSubscription) {
    throw new BillingServiceError(
      "entitlement_denied",
      "Intro request quota exhausted",
      denial("quota_exhausted"),
    );
  }

  if (input.config.authMode === "test") {
    addTestUsageLedgerEntry(input.billingTestState, {
      periodEnd: subscription.currentSubscription.currentPeriodEnd,
      periodStart: subscription.currentSubscription.currentPeriodStart,
      profileId: subscription.currentSubscription.profileId,
      quantity: 1,
      sourceEventKey: `intro_request:${input.introRequestId}`,
      subscriptionId: subscription.currentSubscription.id,
      usageType: "intro_request_sent",
    });
  }
}

export { buildBillingReadModels } from "./readModels.js";
export { denial } from "./entitlements.js";
export { createBillingTestSubscription } from "./testFactory.js";
