import {
  BillingUsageResponseSchema,
  type BillingPlan,
  type BillingUsageSummary,
} from "@marketplace/contracts";
import { BillingServiceError } from "./errors.js";
import {
  allowed,
  deniedForStatus,
  isCurrentEntitlementActive,
} from "./entitlements.js";
import { createBillingDb } from "./dbMappers.js";
import type {
  ActiveSubscription,
  BillingDeps,
  BillingProfile,
} from "./types.js";

const ZERO_USAGE_PERIOD = {
  periodStart: null,
  periodEnd: null,
};

export async function buildUsageSummary(
  input: BillingDeps,
  profile: BillingProfile | null,
  subscription: ActiveSubscription | null,
  activePlan: BillingPlan | null,
): Promise<BillingUsageSummary> {
  const introUsed =
    profile && subscription
      ? await countIntroUsage(input, profile.id, subscription)
      : 0;
  const introLimit = activePlan?.limits.introRequestsPerPeriod ?? 0;
  const storageUsed =
    profile?.role === "author"
      ? await computeAuthorStorageUsage(input, profile.userId)
      : 0;
  const storageLimit = activePlan?.limits.storageBytes ?? 0;
  return BillingUsageResponseSchema.shape.usage.parse({
    directoryVisibility:
      activePlan?.limits.directoryVisibility === true &&
      subscription &&
      isCurrentEntitlementActive(subscription)
        ? allowed()
        : deniedForStatus(
            profile
              ? subscription
                ? "inactive"
                : "trial_available"
              : "profile_required",
          ),
    introRequests: {
      limit: introLimit,
      remaining: Math.max(0, introLimit - introUsed),
      used: introUsed,
      ...(subscription
        ? {
            periodEnd: subscription.currentPeriodEnd,
            periodStart: subscription.currentPeriodStart,
          }
        : ZERO_USAGE_PERIOD),
    },
    profileId: profile?.id ?? null,
    storage: {
      limitBytes: storageLimit,
      remainingBytes: Math.max(0, storageLimit - storageUsed),
      usedBytes: storageUsed,
    },
  });
}

async function countIntroUsage(
  input: BillingDeps,
  profileId: string,
  subscription: ActiveSubscription,
): Promise<number> {
  if (input.config.authMode === "test") {
    return input.billingTestState.usageLedger
      .filter(
        (item) =>
          item.profileId === profileId &&
          item.usageType === "intro_request_sent" &&
          item.periodStart === subscription.currentPeriodStart &&
          item.periodEnd === subscription.currentPeriodEnd,
      )
      .reduce((sum, item) => sum + item.quantity, 0);
  }
  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("usage_ledger")
    .select("quantity")
    .eq("profile_id", profileId)
    .eq("usage_type", "intro_request_sent")
    .eq("period_start", subscription.currentPeriodStart)
    .eq("period_end", subscription.currentPeriodEnd);
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load intro usage",
      undefined,
      error,
    );
  }
  return (data ?? []).reduce(
    (sum, row: { quantity?: number }) => sum + Number(row.quantity ?? 0),
    0,
  );
}

async function computeAuthorStorageUsage(
  input: BillingDeps,
  userId: string,
): Promise<number> {
  if (input.config.authMode === "test") {
    return (input.manuscriptTestState?.documents ?? [])
      .filter((item) => item.authorId === userId)
      .filter((item) => ["uploaded", "attached"].includes(item.storageStatus))
      .reduce((sum, item) => sum + item.fileSizeBytes, 0);
  }

  const db = createBillingDb(input.config);
  const { data, error } = await db
    .from("documents")
    .select("file_size_bytes")
    .eq("author_id", userId)
    .in("storage_status", ["uploaded", "attached"]);
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to load author storage usage",
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
