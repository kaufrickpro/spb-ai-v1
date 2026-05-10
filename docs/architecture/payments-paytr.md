# PayTR Payments Architecture

## Summary

PayTR powers SaaS subscription payments for Türkiye. V1 uses PayTR for platform subscriptions only. Do not implement marketplace payouts, escrow, royalties, or contract payments.

## Billing Model

Subscriptions are per individual account. There are no organization/team subscriptions in v1.

Starter plans:

- Author trial, started explicitly for one month after an eligible author profile is complete.
- Publisher trial, started explicitly for one month after an eligible publisher profile is complete.
- Author Pro monthly and annual.
- Publisher Pro monthly and annual.

Step 13a creates the local billing catalog, trial-start guard, subscription
mirror tables, payment event table, and usage ledger. Step 13b adds PayTR
checkout sessions, checkout-token creation, callback processing, inactive paid
downgrade behavior, and narrow admin repair for provider-sync incidents.
Existing remote databases must apply
`supabase/migrations/20260509080705_step13a_billing_usage_core.sql` for
entitlement gates. The Step 13b PayTR migration,
`supabase/migrations/20260509153000_step13b_paytr_checkout_webhooks.sql`, is
deferred to the post-Step-21 PayTR wiring checkpoint together with sandbox
credentials, callback URL setup, final non-zero prices, and provider smoke.
Until then deployed environments should keep `PAYTR_PROVIDER_MODE=disabled`.

There is no permanent free tier in V1. Do not add an admin comp/manual pilot
plan. Narrow audited admin repair is allowed only for real provider-sync
incidents after PayTR is wired; it must not grant free access.

Plan gates:

- intro request quota
- upload storage limit
- directory visibility
- support/admin service level

Match runs are rate-limited but not charged as monthly quota.

Match runs require active entitlement, but billing state must never affect
matching relevance, scoring, AI-service inputs, candidate persistence, or match
detail.

## Checkout Flow

1. User chooses plan in the frontend.
2. Frontend calls `POST /api/v1/billing/paytr/checkout-token`.
3. Node API validates profile eligibility, role-compatible paid plan, configured
   non-zero plan price, and current subscription state.
4. Node API requests a PayTR checkout token.
5. Frontend renders PayTR checkout with browser-safe token/iframe data only.
6. PayTR callback hits `POST /api/v1/webhooks/paytr`.
7. API verifies callback hash.
8. API stores `payment_events`.
9. API updates `subscriptions` idempotently.

## Callback Rules

- Verify PayTR hash before mutating subscription state.
- Store all callback events.
- Make processing idempotent with provider event identifiers and database constraints.
- Never store card data.
- Treat unknown callback types as stored-but-unprocessed events until explicitly supported.
- Respond to valid PayTR callbacks with plain `OK` and no surrounding JSON or
  HTML.

## Admin Repair

Admin repair is limited to real provider-sync incidents: marking a stored
payment callback processed, attaching a PayTR reference to an existing
subscription, or reconciling an existing subscription status. Repair cannot
create a subscription, grant a free/manual comp plan, bypass trial uniqueness,
or set a non-PayTR entitlement.

## Usage Rules

- Intro request quota is consumed when request is sent.
- Intro request quota is monthly plan-backed usage in `usage_ledger`.
- Upload storage is computed from current active document state.
- Monthly usage periods follow subscription period where possible.
- Quota-consuming actions must be written transactionally with usage ledger rows.
- New intro send usage rows use `usage_type = intro_request_sent` and
  `source_event_key = intro_request:<intro_request_id>` to prevent duplicate
  consumption.
- Expired trials and inactive subscriptions downgrade gracefully: historical
  workspace data, match details, match-revealed profiles, intro history, and
  accepted-intro unlocks remain readable, while new gated actions are blocked.

## Data Touchpoints

- `plans`
- `subscriptions`
- `payment_events`
- `usage_ledger`
- `audit_logs`

## Open Questions

- What are the first production prices in TRY?
