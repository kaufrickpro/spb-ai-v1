import { randomUUID } from "node:crypto";
import type {
  BillingPlanSlug,
  BillingSubscriptionStatus,
} from "@marketplace/contracts";

export type BillingTestSubscription = {
  id: string;
  profileId: string;
  userId: string;
  planSlug: BillingPlanSlug;
  status: BillingSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
};

export type BillingUsageLedgerEntry = {
  id: string;
  profileId: string;
  subscriptionId: string;
  usageType: "intro_request_sent";
  quantity: number;
  periodStart: string;
  periodEnd: string;
  sourceEventKey: string;
  createdAt: string;
};

export type BillingCheckoutSession = {
  id: string;
  merchantOid: string;
  profileId: string;
  userId: string;
  planSlug: BillingPlanSlug;
  amountMinor: number;
  currency: "TRY";
  status: "created" | "paid" | "failed" | "expired";
  token: string;
  createdAt: string;
};

export type BillingPaymentEvent = {
  id: string;
  providerEventId: string;
  subscriptionId: string | null;
  profileId: string | null;
  eventType: string;
  processingStatus: "stored" | "processed" | "ignored" | "failed";
  safePayload: Record<string, unknown>;
  createdAt: string;
  processedAt: string | null;
};

export type BillingTestState = {
  checkoutSessions: BillingCheckoutSession[];
  paymentEvents: BillingPaymentEvent[];
  subscriptions: BillingTestSubscription[];
  trialStartsByUserId: Map<string, string>;
  usageLedger: BillingUsageLedgerEntry[];
};

export function createBillingTestState(): BillingTestState {
  return {
    checkoutSessions: [],
    paymentEvents: [],
    subscriptions: [],
    trialStartsByUserId: new Map(),
    usageLedger: [],
  };
}

export function addTestSubscription(
  state: BillingTestState,
  input: Omit<BillingTestSubscription, "id"> & { id?: string },
): BillingTestSubscription {
  const subscription = {
    ...input,
    id: input.id ?? randomUUID(),
  };
  state.subscriptions.push(subscription);
  if (subscription.trialStartedAt) {
    state.trialStartsByUserId.set(subscription.userId, subscription.id);
  }
  return subscription;
}

export function addTestUsageLedgerEntry(
  state: BillingTestState,
  input: Omit<BillingUsageLedgerEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): BillingUsageLedgerEntry {
  const entry = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  if (
    state.usageLedger.some(
      (item) =>
        item.profileId === entry.profileId &&
        item.sourceEventKey === entry.sourceEventKey,
    )
  ) {
    return entry;
  }
  state.usageLedger.push(entry);
  return entry;
}

export function addTestCheckoutSession(
  state: BillingTestState,
  input: Omit<BillingCheckoutSession, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): BillingCheckoutSession {
  const session = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  state.checkoutSessions.push(session);
  return session;
}

export function addTestPaymentEvent(
  state: BillingTestState,
  input: Omit<BillingPaymentEvent, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): BillingPaymentEvent {
  const existing = state.paymentEvents.find(
    (item) => item.providerEventId === input.providerEventId,
  );
  if (existing) {
    return existing;
  }
  const event = {
    ...input,
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  state.paymentEvents.push(event);
  return event;
}
