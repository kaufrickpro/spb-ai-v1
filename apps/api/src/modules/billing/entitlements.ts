import type {
  BillingPlan,
  BillingSubscriptionSummary,
  EntitlementCapability,
  EntitlementDenial,
  EntitlementDenialReason,
} from "@marketplace/contracts";
import type {
  ActiveSubscription,
  BillingAction,
  BillingProfile,
} from "./types.js";

export function getCapability(
  subscription: BillingSubscriptionSummary,
  action: BillingAction,
): EntitlementCapability {
  if (action === "upload_sample") return subscription.capabilities.uploadSample;
  if (action === "run_match") return subscription.capabilities.runMatch;
  if (action === "send_intro_request")
    return subscription.capabilities.sendIntroRequest;
  return subscription.capabilities.publicDirectoryVisibility;
}

export function getEntitlementStatus(input: {
  active: boolean;
  profile: BillingProfile | null;
  subscription: ActiveSubscription | null;
  trialUsed: boolean;
}): BillingSubscriptionSummary["entitlementStatus"] {
  if (!input.profile) return "profile_required";
  if (
    input.profile.eligibilityStatus !== "eligible" ||
    !input.profile.detailsComplete
  ) {
    return "profile_incomplete";
  }
  if (input.active && input.subscription?.status === "trialing")
    return "trialing";
  if (input.active && input.subscription?.status === "active") return "active";
  if (input.subscription?.plan.kind === "paid") return "inactive";
  if (input.trialUsed) return "expired";
  return "trial_available";
}

export function buildCapabilities(input: {
  active: boolean;
  activePlan: BillingPlan | null;
  entitlementStatus: BillingSubscriptionSummary["entitlementStatus"];
  profile: BillingProfile | null;
  trial: { available: boolean; used: boolean };
}): BillingSubscriptionSummary["capabilities"] {
  const profileReady =
    input.profile?.eligibilityStatus === "eligible" &&
    input.profile.detailsComplete;
  const activeCapability = input.active
    ? allowed()
    : deniedForStatus(input.entitlementStatus);
  return {
    startTrial:
      profileReady && input.trial.available
        ? allowed()
        : {
            allowed: false,
            denial: input.trial.used
              ? denial("trial_already_used")
              : denial(
                  !input.profile
                    ? "profile_not_found"
                    : !input.profile.detailsComplete
                      ? "role_details_incomplete"
                      : "profile_not_eligible",
                ),
          },
    uploadSample:
      input.profile?.role === "author"
        ? activeCapability
        : { allowed: false, denial: denial("role_not_allowed") },
    runMatch: activeCapability,
    sendIntroRequest: activeCapability,
    publicDirectoryVisibility:
      input.activePlan?.limits.directoryVisibility === true && input.active
        ? allowed()
        : {
            allowed: false,
            denial:
              input.profile?.role !== "publisher"
                ? denial("role_not_allowed")
                : deniedForStatus(input.entitlementStatus).denial,
          },
  };
}

export function isCurrentEntitlementActive(
  subscription: ActiveSubscription,
): boolean {
  return (
    ["trialing", "active"].includes(subscription.status) &&
    new Date(subscription.currentPeriodEnd).getTime() > Date.now()
  );
}

export function allowed(): EntitlementCapability {
  return { allowed: true, denial: null };
}

export function deniedForStatus(
  status: BillingSubscriptionSummary["entitlementStatus"],
): EntitlementCapability {
  if (status === "profile_required") {
    return { allowed: false, denial: denial("profile_not_found") };
  }
  if (status === "profile_incomplete") {
    return { allowed: false, denial: denial("role_details_incomplete") };
  }
  if (status === "trial_available") {
    return { allowed: false, denial: denial("trial_not_started") };
  }
  if (status === "expired") {
    return { allowed: false, denial: denial("trial_expired") };
  }
  return { allowed: false, denial: denial("subscription_inactive") };
}

export function denial(reason: EntitlementDenialReason): EntitlementDenial {
  const recoveryAction =
    reason === "profile_not_found" ||
    reason === "profile_not_eligible" ||
    reason === "role_details_incomplete"
      ? "complete_profile"
      : reason === "trial_not_started"
        ? "start_trial"
        : reason === "quota_exhausted" || reason === "storage_limit_exceeded"
          ? null
          : "subscribe";
  const messages: Record<EntitlementDenialReason, string> = {
    admin_not_allowed: "Admin accounts cannot use marketplace billing actions.",
    profile_not_found: "Create a marketplace profile before using this action.",
    profile_not_eligible:
      "Complete profile eligibility before using this action.",
    quota_exhausted: "Intro request quota exhausted for this billing period.",
    role_details_incomplete:
      "Complete role-specific profile details before using this action.",
    role_not_allowed: "This plan does not allow this action for your role.",
    storage_limit_exceeded: "Storage limit exceeded for this billing period.",
    subscription_inactive: "An active subscription is required.",
    trial_already_used: "The one-month trial has already been used.",
    trial_expired: "The trial has expired. Subscription checkout opens in 13b.",
    trial_not_started: "Start your one-month trial to use this action.",
  };
  return { message: messages[reason], reason, recoveryAction };
}
