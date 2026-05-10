import { randomUUID } from "node:crypto";
import type { BillingTestSubscription } from "./testState.js";
import type { CreateBillingTestSubscriptionInput } from "./types.js";

export function createBillingTestSubscription(
  input: CreateBillingTestSubscriptionInput,
): BillingTestSubscription {
  const now = new Date();
  const end = new Date(now.getTime() + (input.periodDays ?? 30) * 86_400_000);
  return {
    currentPeriodEnd: end.toISOString(),
    currentPeriodStart: now.toISOString(),
    id: randomUUID(),
    planSlug: input.planSlug,
    profileId: input.profileId,
    status: input.status ?? "trialing",
    trialEndsAt: input.planSlug.endsWith("-trial") ? end.toISOString() : null,
    trialStartedAt: input.planSlug.endsWith("-trial")
      ? now.toISOString()
      : null,
    userId: input.userId,
  };
}
