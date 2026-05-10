import type { BillingPlan, BillingPlanSlug } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { BillingTestState } from "./testState.js";

export type BillingAction =
  | "upload_sample"
  | "run_match"
  | "send_intro_request"
  | "public_directory_visibility";

export type BillingDeps = {
  billingTestState: BillingTestState;
  config: ApiConfig;
  manuscriptTestState?: ManuscriptTestState;
  profileTestState: ProfileTestState;
  user: AuthenticatedUser;
};

export type BillingProfile = {
  id: string;
  userId: string;
  role: "author" | "publisher";
  eligibilityStatus: string;
  detailsComplete: boolean;
};

export type ActiveSubscription = {
  id: string;
  profileId: string;
  userId: string;
  plan: BillingPlan;
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
};

export type CreateBillingTestSubscriptionInput = {
  profileId: string;
  userId: string;
  planSlug: BillingPlanSlug;
  status?: ActiveSubscription["status"];
  periodDays?: number;
};
