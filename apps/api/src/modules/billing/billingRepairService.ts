import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { BillingServiceError } from "./errors.js";
import type { AdminBillingRepairInput } from "./paytrTypes.js";

export async function repairBillingFromAdmin(input: AdminBillingRepairInput) {
  if (input.config.authMode === "test") {
    return repairTestBilling(input);
  }
  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db.rpc("repair_billing_subscription", {
    p_action: input.action,
    p_actor_user_id: input.actorUserId,
    p_internal_note: input.internalNote,
    p_payment_event_id: input.paymentEventId ?? null,
    p_paytr_subscription_ref: input.paytrSubscriptionRef ?? null,
    p_status: input.status ?? null,
    p_subscription_id: input.subscriptionId ?? null,
  });
  if (error) {
    throw new BillingServiceError(
      "storage",
      "Failed to repair billing state",
      undefined,
      error,
    );
  }
  return data;
}

function repairTestBilling(input: AdminBillingRepairInput) {
  const now = new Date().toISOString();
  if (input.action === "mark_event_processed") {
    const event = input.billingTestState.paymentEvents.find(
      (item) => item.id === input.paymentEventId,
    );
    if (!event) {
      throw new BillingServiceError("not_found", "Payment event not found");
    }
    event.processingStatus = "processed";
    event.processedAt = now;
    return { repaired: true };
  }
  const subscription = input.billingTestState.subscriptions.find(
    (item) => item.id === input.subscriptionId,
  );
  if (!subscription) {
    throw new BillingServiceError("not_found", "Subscription not found");
  }
  if (input.action === "attach_paytr_reference") {
    return { repaired: true };
  }
  if (input.status) {
    subscription.status = input.status;
  }
  return { repaired: true };
}
