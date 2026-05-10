import type { BillingPlanSlug } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { BillingTestState } from "./testState.js";
import type { PaytrCheckoutAdapter } from "./paytr.js";

export type PaytrBillingDeps = {
  billingTestState: BillingTestState;
  config: ApiConfig;
  manuscriptTestState?: ManuscriptTestState;
  paytrAdapter?: PaytrCheckoutAdapter;
  profileTestState: ProfileTestState;
  user: AuthenticatedUser;
};

export type PaytrWebhookInput = {
  merchant_oid?: unknown;
  status?: unknown;
  total_amount?: unknown;
  hash?: unknown;
  payment_amount?: unknown;
  payment_type?: unknown;
  currency?: unknown;
  failed_reason_code?: unknown;
  failed_reason_msg?: unknown;
  test_mode?: unknown;
};

export type AdminBillingRepairInput = {
  actorUserId: string;
  billingTestState: BillingTestState;
  config: ApiConfig;
  internalNote: string;
  paymentEventId?: string;
  paytrSubscriptionRef?: string;
  status?: "active" | "past_due" | "cancelled" | "expired";
  subscriptionId?: string;
  action:
    | "mark_event_processed"
    | "attach_paytr_reference"
    | "reconcile_subscription_status";
};

export type CheckoutSessionRecord = {
  merchantOid: string;
  profileId: string;
  userId: string;
  planSlug: BillingPlanSlug;
  amountMinor: number;
  status: "created" | "paid" | "failed" | "expired";
};
