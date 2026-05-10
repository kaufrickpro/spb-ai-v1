# Step 13 Billing And Usage Implementation Plan

## Summary

Build billing and usage in two slices:

- **13a: Billing and usage core** adds plans, subscriptions, explicit trial
  activation, entitlement checks, usage meters, gated-action recovery, and
  billing/pricing UI. It does not process PayTR payments.
- **13b: PayTR checkout and webhooks** adds checkout-token creation,
  hash-verified PayTR callbacks, idempotent subscription mutation, payment event
  processing, inactive paid downgrade behavior, and narrow audited billing
  repair for provider-sync incidents. This is implemented locally for GitHub
  issues #90-#93. Live PayTR wiring, including remote migration application,
  sandbox credentials, final prices, callback URL setup, and provider smoke, is
  deferred until after Step 21.

Step 13 is for SaaS subscriptions only. Do not add marketplace payouts, escrow,
contracts, royalties, commissions, organization accounts, team billing,
coupons, free manual comp plans, or hidden matching boosts.

## Locked Decisions

- There is no permanent free user tier in V1.
- Users may explicitly start one 1-month trial after completing an eligible
  role-specific profile.
- Trial starts only through a trusted endpoint, not automatically at profile
  creation.
- Trial activation can be offered from `/app/billing` and from gated-action
  prompts. Both paths call the same idempotent backend endpoint.
- One Supabase Auth user can start one trial in V1. Recreating a marketplace
  profile must not grant another trial.
- Trial entitlement is role-derived. Users do not choose a trial plan.
- Store separate internal trial plan rows: `author-trial` and
  `publisher-trial`.
- Paid catalog rows are `author-pro-monthly`, `author-pro-annual`,
  `publisher-pro-monthly`, and `publisher-pro-annual`.
- Do not add `pilot-admin-comp` or any admin-granted free access plan in V1.
- Narrow audited admin repair for real billing/provider sync incidents is
  allowed in 13b, but not in 13a.
- Annual plans are present in 13a catalog/UI. Checkout remains disabled until
  13b.
- 13a may seed placeholder internal prices, but user-facing pricing should say
  launch pricing is coming soon until final PayTR-aligned prices are chosen.
- Expired trials, cancelled subscriptions, expired subscriptions, and `past_due`
  subscriptions downgrade gracefully: historical workspace data remains
  readable, but new gated marketplace actions are blocked.
- Billing state is an entitlement gate only. It must never enter AI-service,
  scoring, ranking, candidate persistence, or match detail inputs.

## Entitlement Model

Pre-trial users can:

- complete and edit their marketplace profile
- complete role-specific profile details
- create and edit manuscript metadata
- view Billing and public pricing

Pre-trial users cannot:

- upload manuscript samples
- run new matches
- send intro requests
- become public-directory visible
- consume plan quotas

Active trial or paid users can use gated actions within plan limits. Expired or
inactive users can still:

- log in
- edit profile and manuscript metadata
- view existing manuscripts and document statuses
- view match history and match detail
- view match-revealed profiles already unlocked through stored match access
- view intro request history
- use accepted-intro contact and publisher sample download unlocks, subject to
  normal profile/manuscript/document eligibility and security checks

Active entitlement is required for:

- sample upload signed URL creation
- sample upload completion
- match run creation
- intro request creation
- public directory visibility becoming effective

Match runs remain abuse rate-limited but are not monthly quota-metered.

## Plan Limits

Use plan `limits` and capabilities for enforcement. Do not scatter plan-slug
checks through product modules except when selecting the correct catalog row.

Recommended launch-shaped starter limits:

| Plan                    | Intro requests/month | Upload storage | Directory visibility | Support  |
| ----------------------- | -------------------: | -------------: | -------------------- | -------- |
| `author-trial`          |                    5 |          50 MB | false                | standard |
| `publisher-trial`       |                    5 |           0 MB | true                 | standard |
| `author-pro-monthly`    |                   25 |         250 MB | false                | priority |
| `author-pro-annual`     |                   25 |         250 MB | false                | priority |
| `publisher-pro-monthly` |                   50 |           0 MB | true                 | priority |
| `publisher-pro-annual`  |                   50 |           0 MB | true                 | priority |

Storage applies to authors in V1 because only authors upload manuscript samples.
Publisher upload storage remains `0 MB` until a future slice introduces
publisher-owned files.

## Usage Rules

Intro requests use the general `usage_ledger`.

- `usage_type = intro_request_sent`
- `source_event_key = intro_request:<intro_request_id>`
- usage period follows the active subscription period when present
- trial usage period follows the trial subscription period
- if a future paid subscription has no period data, fail closed instead of
  silently falling back to a broader period

Remove the active Step 11 `intro_request_usage_events` product path in 13a. Do
not maintain two quota systems. A forward migration may drop the table or leave
it inert if a safer deployment sequence requires it, but all new quota reads and
writes must use `usage_ledger`.

Storage quota is computed live from current active document state, not from the
monthly usage ledger. If an author replaces or removes a sample later, current
storage usage should reflect the active stored documents.

Sample upload quota should be checked twice:

- precheck at signed upload URL creation for immediate feedback
- authoritative enforcement at upload completion before attaching the sample

Replacement uploads must avoid unfair double-counting after replacement
completion. The completion-time calculation should consider the post-completion
active document set.

## Data Model

13a should add a forward migration for:

- `plans`
- `subscriptions`
- `payment_events`
- `usage_ledger`
- trial-start guard data needed to enforce one trial per Auth user

Recommended subscription fields:

- `profile_id`
- `user_id` or another immutable Auth-user reference for trial uniqueness
- `plan_id`
- `status`
- `current_period_start`
- `current_period_end`
- `trial_started_at`
- `trial_ends_at`
- `paytr_customer_id`
- `paytr_subscription_ref`
- timestamps

Add constraints/indexes for:

- stable unique plan slugs
- one active-ish subscription per profile where practical
- one trial per Auth user
- unique `payment_events.provider_event_id`
- unique/scoped `usage_ledger.source_event_key`

Payment tables are created in 13a so 13b has a stable schema, but 13a must not
process PayTR callbacks or mutate subscriptions from provider payloads.

## API And Contracts

Add shared Zod contracts and route contracts for:

- `GET /api/v1/billing/subscription`
- `GET /api/v1/billing/usage`
- `POST /api/v1/billing/trial/start`

13b adds:

- `POST /api/v1/billing/paytr/checkout-token`
- `POST /api/v1/webhooks/paytr`

Create a central API-side entitlement service that answers what a profile can
do now. Product modules should call this service instead of reading billing
tables directly.

The service should return typed capability results for:

- `start_trial`
- `upload_sample`
- `run_match`
- `send_intro_request`
- `public_directory_visibility`

Use explicit denial reasons such as:

- `profile_not_eligible`
- `trial_not_started`
- `trial_already_used`
- `trial_expired`
- `subscription_inactive`
- `quota_exhausted`
- `storage_limit_exceeded`
- `role_not_allowed`

Relevant API errors and action-state responses should include structured
entitlement details so the frontend can show the correct recovery path without
parsing message strings.

Extend `IntroStateStatus` carefully:

- keep `quota_exhausted` for an active entitlement with no intro quota remaining
- add statuses for entitlement recovery, such as `trial_required`,
  `entitlement_expired`, and `subscription_required`

## Flow Integration

### Trial Start

`POST /api/v1/billing/trial/start` should:

1. authenticate the marketplace user
2. require completed role-specific profile details
3. require `profiles.eligibility_status = 'eligible'`
4. reject staff/admin identities
5. enforce one trial per Auth user
6. select `author-trial` or `publisher-trial` from the profile role
7. create a `trialing` subscription with a 1-month period
8. write a product audit event
9. return the updated subscription and usage summary

### Intro Requests

Intro creation must consume quota transactionally with request creation,
notification creation, and product audit event creation. Replace the fixed
10/day Step 11 quota source with plan-backed monthly usage from
`usage_ledger`.

Daily/hourly abuse rate limits may still exist separately from subscription
quota. Do not model those abuse limits as monthly plan usage.

### Uploads

`POST /api/v1/uploads/signed-url` and
`POST /api/v1/documents/:id/complete-upload` both require active entitlement for
author sample uploads. Completion-time enforcement is authoritative.

### Matching

`POST /api/v1/matches/run` requires active entitlement before run creation and
then applies the existing matching rate limits. Do not pass plan/subscription
data to the AI service or scoring code.

### Directory Visibility

Public publisher directory visibility should be computed:

```txt
owner_wants_directory_visibility
  && plan_allows_directory_visibility
  && profile_is_eligible
  && admin_directory_status_is_approved
```

If entitlement expires, the publisher disappears from `/publishers` without
mutating the saved owner preference. If they later subscribe again, the saved
preference can become effective subject to normal eligibility/admin checks.

## Frontend

13a should update both public and authenticated surfaces.

Public `/pricing`:

- show the 1-month trial
- show author/publisher monthly and annual plan categories
- show plan limits and positioning
- avoid final TRY prices until production prices are chosen
- do not expose checkout as available before 13b

Authenticated `/app/billing`:

- show current entitlement state
- show whether trial is available, active, expired, or already used
- show trial end/subscription period when present
- show plan limits
- show intro usage meter
- show storage usage meter for authors
- show directory visibility entitlement for publishers
- offer Start Trial when eligible
- show paid checkout as coming in 13b

Dashboard:

- show compact entitlement status
- show one or two role-relevant usage meters
- link to Billing for full management

Gated-action prompts:

- use structured entitlement denial details
- offer Start Trial and continue when the profile is eligible and trial is
  unused
- show subscribe/checkout-coming-soon messaging when trial is expired or already
  used in 13a

## 13a Implementation Slices

1. **Schema and seed data**
   - Add billing migration for plans, subscriptions, payment events, usage
     ledger, one-trial-per-user guard, RLS, indexes, and grants.
   - Seed trial and paid plan rows with stable slugs and placeholder internal
     prices.

2. **Contracts**
   - Add billing contracts, entitlement summary schemas, usage schemas, and
     structured entitlement denial details.
   - Add route contracts for subscription, usage, and trial start.

3. **API billing module**
   - Add `apps/api/src/modules/billing`.
   - Implement billing read models and `POST /billing/trial/start`.
   - Add a central entitlement service and focused tests.

4. **Intro quota migration**
   - Replace `intro_request_usage_events` reads/writes with `usage_ledger`.
   - Keep intro creation transactional.
   - Update match card/detail intro state reads.

5. **Upload entitlement gate**
   - Gate signed URL creation and upload completion.
   - Compute active author storage usage from active document rows.

6. **Match run entitlement gate**
   - Gate new run creation.
   - Preserve existing rate limits.
   - Add tests proving plan state does not affect ranking/scoring.

7. **Directory visibility gate**
   - Compute public directory visibility from entitlement, owner preference,
     profile eligibility, and admin approval.
   - Do not mutate saved preference on expiry.

8. **Frontend billing and pricing**
   - Replace the `/app/billing` placeholder with a functional billing page.
   - Add compact Dashboard billing/usage cards.
   - Refresh public `/pricing` copy for trial and plan categories.

9. **Gated-action recovery UI**
   - Render structured entitlement recovery states on intro actions, upload
     actions, match run actions, and directory visibility controls.

10. **Docs and validation**
    - Update architecture docs, build plan, knowledge base, and smoke checklist.
    - Run focused API/contract/frontend tests and harness checks.

## 13b Implementation Slices

1. **PayTR config and adapter**
   - Add typed PayTR config validation and fail-fast provider mode checks.
   - Implement checkout-token adapter behind an interface with fixtures.

2. **Checkout endpoint**
   - Add `POST /api/v1/billing/paytr/checkout-token`.
   - Validate selected paid plan and current subscription state.
   - Return browser-safe checkout token data only.

3. **PayTR webhook**
   - Add `POST /api/v1/webhooks/paytr`.
   - Verify hash before mutation.
   - Store every callback in `payment_events`.
   - Process known event types idempotently.
   - Treat unknown event types as stored-but-unprocessed.

4. **Subscription state transitions**
   - Map provider events to `trialing`, `active`, `past_due`, `cancelled`, and
     `expired` subscription states.
   - Keep graceful downgrade behavior.
   - Write product audit events for billing mutations.

5. **Narrow admin repair**
   - Add audited repair actions only for provider-sync incidents.
   - Do not allow admins to grant free/manual comp access.

6. **Checkout UI**
   - Enable paid plan selection and PayTR checkout rendering.
   - Add failure, pending, and success states.

## 13b Implementation Record

- Added `POST /api/v1/billing/paytr/checkout-token` for role-compatible paid
  monthly and annual plans.
- Added a typed PayTR iframe-token adapter using the official token/hash shape.
- Added `POST /api/v1/webhooks/paytr`; valid callbacks return PayTR's required
  plain `OK` response.
- Added `paytr_checkout_sessions` and service-role RPCs for idempotent callback
  processing and narrow billing repair.
- Extended entitlement read models so inactive paid states remain visible and
  block new gated actions while historical reads remain available.
- Added admin billing repair for existing provider-sync records only; no
  free/manual comp entitlement path exists.
- Remote databases must apply
  `supabase/migrations/20260509153000_step13b_paytr_checkout_webhooks.sql`
  after the Step 13a migration during the post-Step-21 PayTR wiring checkpoint.
- Keep deployed `PAYTR_PROVIDER_MODE=disabled` until that checkpoint begins.

## Validation

13a focused checks:

- contract tests for billing schemas/routes
- API tests for subscription read, usage read, trial start, duplicate trial
  denial, ineligible profile denial, expired entitlement denial, quota
  exhaustion, and storage limit denial
- intro request tests proving quota consumption uses `usage_ledger` and remains
  transactional
- upload tests for signed URL precheck and completion-time storage enforcement
- matching tests for entitlement gate plus plan-independent scoring
- public directory tests for computed entitlement visibility
- frontend tests for Billing, Dashboard cards, pricing copy, and gated-action
  recovery states
- `npm run check:harness`

13b focused checks:

- PayTR hash validation fixtures
- replay/idempotency tests
- unknown callback stored-but-unprocessed test
- subscription transition tests
- admin repair authorization/audit tests
- checkout UI success/failure tests

Before staging or production checkout is enabled, final TRY prices and PayTR
product mapping must be chosen and documented. The team has intentionally moved
live PayTR wiring to after Step 21.
