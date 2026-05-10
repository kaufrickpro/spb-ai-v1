import {
  INTRO_REQUEST_COOLDOWN_DAYS,
  INTRO_REQUEST_DAILY_LIMIT,
  IntroStateSchema,
  billingPlanCatalog,
  type IntroState,
  type IntroStateStatus,
} from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findTestProfileById } from "../profiles/testState.js";
import { getDbProfileById } from "./repository.js";
import type { IntroRequestDeps } from "./types.js";

export function notEligibleState(): IntroState {
  return IntroStateSchema.parse({ status: "not_eligible", requestId: null });
}

export function getTestIntroState(
  input: IntroRequestDeps,
  pair: {
    manuscriptId: string;
    publisherProfileId: string;
    viewerProfileId: string;
  },
): IntroState {
  const requests = input.introTestState.requests
    .filter(
      (request) =>
        request.manuscriptId === pair.manuscriptId &&
        request.publisherProfileId === pair.publisherProfileId,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const accepted = requests.find((request) => request.status === "accepted");
  if (accepted) return buildIntroState("accepted", accepted.id);
  const pending = requests.find((request) => request.status === "pending");
  if (pending) {
    return buildIntroState(
      pending.requesterProfileId === pair.viewerProfileId
        ? "pending_sent"
        : "pending_received",
      pending.id,
    );
  }
  const cooldown = requests.find(
    (request) =>
      request.status === "rejected" || request.status === "cancelled",
  );
  if (cooldown) {
    const cooldownUntil = addDays(
      cooldown.respondedAt ?? cooldown.updatedAt,
      INTRO_REQUEST_COOLDOWN_DAYS,
    );
    if (new Date(cooldownUntil).getTime() > Date.now()) {
      return buildIntroState(
        cooldown.status === "rejected"
          ? "rejected_cooldown"
          : "cancelled_cooldown",
        cooldown.id,
        { cooldownUntil },
      );
    }
  }
  const quota = getTestIntroQuota(input, pair.viewerProfileId);
  if (quota.status !== "can_request") {
    return buildIntroState(quota.status, null, {
      quotaRemaining: quota.remaining,
    });
  }
  return buildIntroState("can_request", null, {
    quotaRemaining: quota.remaining,
  });
}

export async function getDbIntroState(
  db: SupabaseClient,
  pair: {
    manuscriptId: string;
    publisherProfileId: string;
    viewerProfileId: string;
  },
): Promise<IntroState> {
  const { data } = await db
    .from("intro_requests")
    .select()
    .eq("manuscript_id", pair.manuscriptId)
    .eq("publisher_profile_id", pair.publisherProfileId)
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const accepted = rows.find((row) => row.status === "accepted");
  if (accepted) return buildIntroState("accepted", String(accepted.id));
  const pending = rows.find((row) => row.status === "pending");
  if (pending) {
    return buildIntroState(
      pending.requester_profile_id === pair.viewerProfileId
        ? "pending_sent"
        : "pending_received",
      String(pending.id),
    );
  }
  const cooldown = rows.find(
    (row) => row.status === "rejected" || row.status === "cancelled",
  );
  if (cooldown) {
    const cooldownUntil = addDays(
      String(cooldown.responded_at ?? cooldown.updated_at),
      INTRO_REQUEST_COOLDOWN_DAYS,
    );
    if (new Date(cooldownUntil).getTime() > Date.now()) {
      return buildIntroState(
        cooldown.status === "rejected"
          ? "rejected_cooldown"
          : "cancelled_cooldown",
        String(cooldown.id),
        { cooldownUntil },
      );
    }
  }
  const quota = await getDbIntroQuota(db, pair.viewerProfileId);
  if (quota.status !== "can_request") {
    return buildIntroState(quota.status, null, {
      quotaRemaining: quota.remaining,
    });
  }
  const remaining = quota.remaining ?? 0;
  return buildIntroState(
    remaining === 0 ? "quota_exhausted" : "can_request",
    null,
    {
      quotaRemaining: remaining,
    },
  );
}

export function getTestIntroQuota(
  input: IntroRequestDeps,
  viewerProfileId: string,
): { remaining: number | null; status: IntroStateStatus } {
  const viewer = findTestProfileById(input.profileTestState, viewerProfileId);
  if (!viewer) return { remaining: null, status: "not_eligible" };
  if (!input.billingTestState) {
    return { remaining: INTRO_REQUEST_DAILY_LIMIT, status: "can_request" };
  }
  const active = input.billingTestState.subscriptions.find(
    (subscription) =>
      subscription.profileId === viewerProfileId &&
      ["trialing", "active"].includes(subscription.status) &&
      new Date(subscription.currentPeriodEnd).getTime() > Date.now(),
  );
  if (!active) {
    const trialUsed = input.billingTestState.trialStartsByUserId.has(
      viewer.profile.userId,
    );
    return {
      remaining: null,
      status: trialUsed ? "entitlement_expired" : "trial_required",
    };
  }
  const plan = billingPlanCatalog.find((item) => item.slug === active.planSlug);
  const limit =
    plan?.limits.introRequestsPerPeriod ?? INTRO_REQUEST_DAILY_LIMIT;
  const used = input.billingTestState.usageLedger
    .filter(
      (item) =>
        item.profileId === viewerProfileId &&
        item.usageType === "intro_request_sent" &&
        item.periodStart === active.currentPeriodStart &&
        item.periodEnd === active.currentPeriodEnd,
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  return {
    remaining: Math.max(0, limit - used),
    status: used >= limit ? "quota_exhausted" : "can_request",
  };
}

export async function getDbIntroQuota(
  db: SupabaseClient,
  viewerProfileId: string,
): Promise<{ remaining: number | null; status: IntroStateStatus }> {
  const { data: subscription } = await db
    .from("subscriptions")
    .select("id,status,current_period_start,current_period_end,plans(limits)")
    .eq("profile_id", viewerProfileId)
    .in("status", ["trialing", "active"])
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription) {
    const profile = await getDbProfileById(db, viewerProfileId);
    if (!profile) return { remaining: null, status: "not_eligible" };
    const { data: trial } = await db
      .from("billing_trial_starts")
      .select("user_id")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    return {
      remaining: null,
      status: trial ? "entitlement_expired" : "trial_required",
    };
  }
  const planRow = Array.isArray(subscription.plans)
    ? subscription.plans[0]
    : subscription.plans;
  const limit = Number(
    ((planRow as { limits?: Record<string, unknown> } | null)?.limits?.[
      "introRequestsPerPeriod"
    ] as number | undefined) ?? 0,
  );
  const { data: usage } = await db
    .from("usage_ledger")
    .select("quantity")
    .eq("profile_id", viewerProfileId)
    .eq("usage_type", "intro_request_sent")
    .eq("period_start", subscription.current_period_start)
    .eq("period_end", subscription.current_period_end);
  const used = (usage ?? []).reduce(
    (sum: number, row: { quantity?: number }) =>
      sum + Number(row.quantity ?? 0),
    0,
  );
  return {
    remaining: Math.max(0, limit - used),
    status: used >= limit ? "quota_exhausted" : "can_request",
  };
}

export function buildIntroState(
  status: IntroStateStatus,
  requestId: string | null,
  overrides: Partial<IntroState> = {},
): IntroState {
  return IntroStateSchema.parse({
    status,
    requestId,
    viewerCanAccept: status === "pending_received",
    viewerCanReject: status === "pending_received",
    viewerCanCancel: status === "pending_sent",
    ...overrides,
  });
}

function addDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}
