# PayTR Payments Architecture

## Summary

PayTR powers SaaS subscription payments for Türkiye. V1 uses PayTR for platform subscriptions only. Do not implement marketplace payouts, escrow, royalties, or contract payments.

## Billing Model

Subscriptions are per individual account. There are no organization/team subscriptions in v1.

Starter plans:

- Free or Trial.
- Author Pro monthly.
- Publisher Pro monthly.
- Admin comp/manual pilot plan.

Plan gates:

- intro request quota
- upload storage limit
- directory visibility
- support/admin service level

Match runs are rate-limited but not charged as monthly quota.

## Checkout Flow

1. User chooses plan in the frontend.
2. Frontend calls `POST /api/v1/billing/paytr/checkout-token`.
3. Node API validates plan and current subscription state.
4. Node API requests a PayTR checkout token.
5. Frontend renders PayTR checkout.
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

## Usage Rules

- Intro request quota is consumed when request is sent.
- Upload storage is tracked by stored file size.
- Monthly usage periods follow subscription period where possible.
- Quota-consuming actions must be written transactionally with usage ledger rows.
- Usage rows must include a source event key or equivalent uniqueness guard to prevent duplicate consumption.

## Data Touchpoints

- `plans`
- `subscriptions`
- `payment_events`
- `usage_ledger`
- `audit_logs`

## Open Questions

- What are the first production prices in TRY?
- Will annual plans be offered at launch or only monthly?
- What happens when a subscription expires: hide matches, block new actions, or downgrade gracefully?
