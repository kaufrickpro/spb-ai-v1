# ADR 4: Use PayTR For Türkiye Billing

## Status

Accepted

## Context

The platform launches in Türkiye and needs a local payment provider for SaaS subscriptions.

## Decision

Use PayTR for subscription checkout and recurring payment flows. V1 uses PayTR for SaaS subscriptions only.

## Consequences

- Payment implementation must be callback-driven, hash-verified, and idempotent.
- The platform must never store card data.
- Marketplace payouts, escrow, contracts, and commissions remain out of scope for v1.
- Billing state is mirrored in `subscriptions`, `payment_events`, and `usage_ledger`.
