export const introActions = {
  send: "Send intro",
  accept: "Accept",
  reject: "Reject",
  cancel: "Cancel",
  acceptConfirm:
    "Accepting unlocks relationship contact and publisher sample access. Continue?",
  rejectNote: "Optional rejection note",
  state: {
    can_request: "Ready",
    pending_sent: "Pending sent",
    pending_received: "Pending received",
    accepted: "Accepted",
    rejected_cooldown: "Cooling down",
    cancelled_cooldown: "Cooling down",
    not_eligible: "Not eligible",
    trial_required: "Trial required",
    entitlement_expired: "Subscription required",
    subscription_required: "Subscription required",
    quota_exhausted: "Plan limit reached",
  },
};
