import type { BillingPlanSlug } from "@marketplace/contracts";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { BillingServiceError } from "./errors.js";
import {
  addTestPaymentEvent,
  addTestSubscription,
  type BillingPaymentEvent,
  type BillingTestState,
} from "./testState.js";
import { verifyPaytrWebhookHash } from "./paytr.js";
import type { PaytrWebhookInput } from "./paytrTypes.js";
import type { ApiConfig } from "../config/config.js";

export async function processPaytrWebhook(input: {
  billingTestState: BillingTestState;
  config: ApiConfig;
  payload: PaytrWebhookInput;
}): Promise<{ eventId: string; processingStatus: string }> {
  const callback = parsePaytrWebhookPayload(input.payload);
  if (
    input.config.authMode !== "test" &&
    input.config.paytrProviderMode === "disabled"
  ) {
    throw new BillingServiceError("not_ready", "PayTR webhooks are disabled.");
  }
  const hashVerified =
    input.config.authMode === "test"
      ? callback.hash === "valid-test-hash"
      : verifyPaytrWebhookHash(callback, input.config);
  if (!hashVerified) {
    await storeInvalidPaytrWebhook(input.config, input.billingTestState, {
      callback,
      providerEventId: callback.merchantOid,
    });
    throw new BillingServiceError("forbidden", "Invalid PayTR callback hash.");
  }

  if (input.config.authMode === "test") {
    return processTestPaytrWebhook(input.billingTestState, callback);
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db.rpc("apply_paytr_webhook_event", {
    p_provider_event_id: callback.merchantOid,
    p_event_type: callback.status,
    p_safe_payload: sanitizePaytrPayload(callback),
  });
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to process PayTR callback",
      undefined,
      error,
    );
  }
  const result = data as { event_id?: string; processing_status?: string };
  return {
    eventId: String(result.event_id),
    processingStatus: String(result.processing_status),
  };
}

function processTestPaytrWebhook(
  state: BillingTestState,
  callback: ReturnType<typeof parsePaytrWebhookPayload>,
) {
  const existing = state.paymentEvents.find(
    (item) => item.providerEventId === callback.merchantOid,
  );
  if (existing?.processingStatus === "processed") {
    return {
      eventId: existing.id,
      processingStatus: existing.processingStatus,
    };
  }

  const session = state.checkoutSessions.find(
    (item) => item.merchantOid === callback.merchantOid,
  );
  const eventType = callback.status;
  if (!session) {
    const event = addTestPaymentEvent(state, {
      eventType,
      profileId: null,
      processedAt: null,
      processingStatus: "stored",
      providerEventId: callback.merchantOid,
      safePayload: sanitizePaytrPayload(callback),
      subscriptionId: null,
    });
    return { eventId: event.id, processingStatus: event.processingStatus };
  }

  if (!["success", "failed"].includes(callback.status)) {
    const event = addTestPaymentEvent(state, {
      eventType,
      profileId: session.profileId,
      processedAt: null,
      processingStatus: "stored",
      providerEventId: callback.merchantOid,
      safePayload: sanitizePaytrPayload(callback),
      subscriptionId: null,
    });
    return { eventId: event.id, processingStatus: event.processingStatus };
  }

  const event = (existing ??
    addTestPaymentEvent(state, {
      eventType,
      profileId: session.profileId,
      processedAt: null,
      processingStatus: callback.status === "success" ? "processed" : "failed",
      providerEventId: callback.merchantOid,
      safePayload: sanitizePaytrPayload(callback),
      subscriptionId: null,
    })) as BillingPaymentEvent;

  if (callback.status === "success") {
    session.status = "paid";
    const now = new Date();
    const end = addBillingPeriod(now, session.planSlug);
    const existingSubscription = state.subscriptions.find(
      (item) => item.profileId === session.profileId,
    );
    const subscription =
      existingSubscription ??
      addTestSubscription(state, {
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: end.toISOString(),
        planSlug: session.planSlug,
        profileId: session.profileId,
        status: "active",
        trialEndsAt: null,
        trialStartedAt: null,
        userId: session.userId,
      });
    subscription.planSlug = session.planSlug;
    subscription.status = "active";
    subscription.currentPeriodStart = now.toISOString();
    subscription.currentPeriodEnd = end.toISOString();
    subscription.trialStartedAt = null;
    subscription.trialEndsAt = null;
    event.subscriptionId = subscription.id;
    event.processingStatus = "processed";
    event.processedAt = now.toISOString();
  } else {
    session.status = "failed";
    event.processingStatus = "failed";
  }

  return { eventId: event.id, processingStatus: event.processingStatus };
}

async function storeInvalidPaytrWebhook(
  config: ApiConfig,
  state: BillingTestState,
  input: {
    callback: ReturnType<typeof parsePaytrWebhookPayload>;
    providerEventId: string;
  },
) {
  if (config.authMode === "test") {
    addTestPaymentEvent(state, {
      eventType: input.callback.status,
      profileId: null,
      processedAt: null,
      processingStatus: "failed",
      providerEventId: `${input.providerEventId}:invalid_hash`,
      safePayload: {
        ...sanitizePaytrPayload(input.callback),
        hash_verification_status: "failed",
      },
      subscriptionId: null,
    });
    return;
  }
  const db = createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
  await db.from("payment_events").upsert(
    {
      event_type: input.callback.status,
      processing_status: "failed",
      provider: "paytr",
      provider_event_id: `${input.providerEventId}:invalid_hash`,
      safe_payload: {
        ...sanitizePaytrPayload(input.callback),
        hash_verification_status: "failed",
      },
    },
    { onConflict: "provider,provider_event_id" },
  );
}

function parsePaytrWebhookPayload(payload: PaytrWebhookInput) {
  const merchantOid = stringField(payload.merchant_oid);
  const status = stringField(payload.status);
  const totalAmount = stringField(payload.total_amount);
  const hash = stringField(payload.hash);
  if (!merchantOid || !status || !totalAmount || !hash) {
    throw new BillingServiceError(
      "not_ready",
      "Invalid PayTR callback payload",
    );
  }
  return {
    currency: stringField(payload.currency),
    failedReasonCode: stringField(payload.failed_reason_code),
    failedReasonMessage: stringField(payload.failed_reason_msg),
    hash,
    merchantOid,
    paymentAmount: stringField(payload.payment_amount),
    paymentType: stringField(payload.payment_type),
    status,
    testMode: stringField(payload.test_mode),
    totalAmount,
  };
}

function sanitizePaytrPayload(
  payload: ReturnType<typeof parsePaytrWebhookPayload>,
): Record<string, unknown> {
  return {
    currency: payload.currency,
    failed_reason_code: payload.failedReasonCode,
    merchant_oid: payload.merchantOid,
    payment_amount: payload.paymentAmount,
    payment_type: payload.paymentType,
    status: payload.status,
    test_mode: payload.testMode,
    total_amount: payload.totalAmount,
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function addBillingPeriod(start: Date, planSlug: BillingPlanSlug): Date {
  const next = new Date(start);
  if (planSlug.endsWith("-annual")) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}
