# Step 14 Notifications And Email Implementation Plan

## Summary

Build notifications and product email in two slices:

- **14a: In-app notifications** exposes the existing marketplace notification
  records through a safe API read model and user-facing inbox. It starts with
  the intro-request notifications already written by Step 11.
- **14b: Product email** adds an async, idempotent Resend-backed email outbox,
  bilingual templates, delivery event processing, and signature-verified Resend
  webhooks.

Step 14 is for marketplace product notifications and transactional product
email only. Do not mix Supabase Auth lifecycle emails into this adapter. Auth
confirmation, password reset, magic link/OTP, and staff invite emails remain
configured in Supabase custom SMTP through dedicated Resend SMTP senders.

Do not add marketing email, newsletters, in-app chat, browser push
notifications, Supabase Realtime, user notification preferences, unsubscribe
flows, or admin/system alerting in Step 14.

## Locked Decisions

- Split Step 14 into `14a` in-app notifications and `14b` product email.
- 14a is marketplace profile-scoped only. Admin queues, Sentry alerts, PayTR
  health, email delivery failures, and system failures remain on their existing
  admin/ops surfaces.
- Notification rows store typed routing data and safe metadata. They do not
  store rendered title/body text.
- In-app notification display text is generated in the frontend i18n layer from
  typed read-model fields.
- Product email templates are rendered server-side in Turkish and English.
- Use one marketplace inbox surface first: `/app/notifications` with `all` and
  `unread` filters.
- The header bell shows an unread badge and a latest-5 preview. The full inbox
  owns pagination, filters, mark-all-read, and richer empty/error states.
- Opening the bell is passive. Clicking a notification marks that notification
  read and navigates. Explicit single-item and mark-all-read controls also
  exist.
- 14a uses TanStack Query polling, refetch-on-focus, and mutation-triggered
  refetches. Realtime and browser push are deferred.
- In-app notification writes remain transactional inside the domain mutation.
  Product email uses an async idempotent outbox and must not roll back product
  actions when Resend is unavailable.
- Notification UI calls the Fastify API only. Do not read
  `public.notifications` directly from the browser.
- Notifications are ephemeral UX records with a 180-day retention rule. Durable
  history stays in source product tables and `product_audit_events`.
- Add database guardrails for notification metadata, plus service-level
  per-type allowlisting.
- The API returns a browser-safe `ctaPath` for each notification.
- Intro-request notifications are the tracer slice. Profile/manuscript decision
  notifications and billing/subscription notifications come after the inbox path
  is proven.
- Product email triggers are an allowlisted subset of product events, not a
  mirror of every in-app notification.
- Step 14 transactional emails are mandatory service emails in V1. Do not add a
  notification preference center or unsubscribe surface.
- Emails may include bounded, already-authorized actor and target labels. They
  must keep sensitive details behind authenticated app routes.
- Resend webhooks process delivery/failure lifecycle events only in V1. Opens
  and clicks stay out of product state.
- Use cursor pagination for notification listing from the first API version.
- `read-all` clears all unread notifications for the current marketplace
  profile.
- Shared app-visible notification types live in `packages/contracts`.
- Unknown notification types are hidden from the user inbox and logged for
  operations/debugging.
- Mark-read operations are idempotent. Cross-profile access should not leak
  useful existence details.
- Notification CTAs target existing workspace surfaces first. Do not create an
  intro-request detail page just for notifications.
- 14a is not fully implemented until the actual bell and inbox UI are browser
  smoke-tested.

## 14a In-App Notifications

### Scope

Implement a complete marketplace notification read path using existing
Step 11 intro-request notification writes:

- shared contracts and route contracts
- metadata hardening migration
- Fastify notification routes
- API read model with compact safe actor/target summaries
- header bell unread badge and latest-5 dropdown
- `/app/notifications` inbox page
- read/read-all mutations
- polling and mutation invalidation
- focused API/UI tests and browser smoke validation

Do not add new product email, Resend configuration, delivery event handling,
decision notification writers, or notification preferences in 14a.

### Data Model

The existing `public.notifications` table remains the source for in-app
notification rows:

- `recipient_profile_id`
- `actor_profile_id`
- `notification_type`
- `target_type`
- `target_id`
- `metadata`
- `read_at`
- `created_at`

Add a forward migration that hardens `metadata` without overfitting every future
notification type:

- require `jsonb_typeof(metadata) = 'object'`
- cap serialized metadata length, recommended maximum `4096` bytes
- forbid obvious top-level sensitive keys, including:
  - `message`
  - `note`
  - `rejection_note`
  - `email`
  - `phone`
  - `contact`
  - `signed_url`
  - `download_url`
  - `document_text`
  - `chunk`
  - `paytr_payload`
  - `provider_payload`
  - `raw_payload`
  - `secret`
  - `token`

Keep full per-type metadata allowlisting in API service code and tests.

Notifications are retained for 180 days as UX records. Step 14a may document
the retention rule without implementing cleanup immediately. A future cleanup
job can delete notification rows older than the retention window after product
audit and source records are confirmed durable.

### Contracts

Add shared notification contracts in `packages/contracts`.

Initial app-visible notification types:

- `intro_request_created`
- `intro_request_accepted`
- `intro_request_rejected`
- `intro_request_cancelled`

Recommended response shape:

```ts
type NotificationItem = {
  id: string;
  type:
    | "intro_request_created"
    | "intro_request_accepted"
    | "intro_request_rejected"
    | "intro_request_cancelled";
  createdAt: string;
  readAt: string | null;
  actor: {
    profileId: string;
    displayName: string;
    role: "author" | "publisher";
  } | null;
  target: {
    type: "intro_request";
    id: string;
    label: string | null;
  };
  ctaPath: string;
};

type NotificationListResponse = {
  items: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};
```

The API should hide unknown notification types from the response and log a safe
warning containing only the notification id and type.

### API Routes

Add routes under `/api/v1`:

- `GET /notifications?filter=all|unread&cursor=&limit=`
- `POST /notifications/:notificationId/read`
- `POST /notifications/read-all`

Rules:

- Require an authenticated marketplace profile.
- Staff-only identities without a marketplace profile cannot use the
  marketplace notification inbox.
- Default list limit is `20`; maximum is `50`.
- Use cursor pagination from `created_at` plus `id`, encoded as an opaque
  cursor.
- `read-all` updates all unread notifications for the current marketplace
  profile, not only the current page.
- `POST /notifications/:id/read` is idempotent for the owner.
- Cross-profile notification read attempts return a not-found-style denial.
- Response validation must use shared contracts.
- Do not expose raw notification metadata to the frontend.
- Do not expose intro request messages, rejection notes, private contact,
  signed URLs, manuscript text, document chunks, provider payloads, raw PayTR
  payloads, admin notes, secrets, or tokens.

### CTA Paths

The API owns safe `ctaPath` generation. The frontend should not duplicate
target routing rules.

Initial intro-request routing:

- `intro_request_created` -> `/app/requests?box=received`
- `intro_request_accepted` -> `/app/requests?box=all`
- `intro_request_rejected` -> `/app/requests?box=all`
- `intro_request_cancelled` -> `/app/requests?box=all`

Use existing workspace surfaces. Do not create an intro-request detail route
only for notification navigation.

### Frontend

Add a marketplace notification module in `apps/web`:

- API client/hooks using the shared route client path.
- Header bell unread badge.
- Bell dropdown with latest 5 notifications, loading/error/empty states, and a
  `View all` link.
- `/app/notifications` page with:
  - `all` / `unread` filters
  - cursor pagination
  - single-item mark-read
  - mark-all-read
  - click-to-read-and-navigate
  - mobile and desktop layouts

The frontend maps notification type and safe summaries to route-independent i18n
keys. Do not store or receive rendered title/body strings from the API for
in-app notifications.

Polling:

- Poll unread/latest notification data every 30 to 60 seconds while
  authenticated.
- Refetch on window focus.
- Refetch after intro-request create/accept/reject/cancel mutations.

### 14a Tests

API tests:

- recipient can list own notifications
- unread filter returns only unread rows
- cursor pagination is stable
- unknown notification types are omitted
- cross-profile reads and mark-read attempts are denied
- mark-read is idempotent
- read-all clears all unread rows for the recipient
- response payloads do not include raw metadata or sensitive keys

Frontend tests where practical:

- bell shows unread count
- dropdown renders latest notifications and empty/error states
- clicking a notification marks read and navigates to `ctaPath`
- inbox filters between all and unread
- mark-all-read clears the badge

Browser smoke:

- authenticated author/publisher can open the bell dropdown
- latest-5 preview renders without overlap on desktop and mobile
- `/app/notifications` renders all/unread states
- click-to-read navigation reaches the existing requests page
- mark-all-read updates the badge and inbox state

## 14b Product Email

### Scope

Add product email without coupling product mutations to Resend availability.
Email is an allowlisted subset of product events, not a mirror of every in-app
notification.

Initial email-worthy events:

- intro request created
- intro request accepted
- intro request rejected
- subscription activated or renewed
- subscription payment failed or became inactive
- profile/manuscript decision notifications after those writers are added

Do not send email for every in-app notification. Do not add marketing email,
newsletters, account authentication email, or user-configurable notification
preferences.

### Data Model

Add a forward migration for:

- `email_outbox`
- `email_delivery_events`

Recommended `email_outbox` fields:

- `id`
- `recipient_profile_id`
- `recipient_user_id`
- `recipient_email`
- `template_key`
- `locale`
- `template_data`
- `idempotency_key`
- `status`
- `attempt_count`
- `next_attempt_at`
- `provider`
- `provider_message_id`
- `last_error_code`
- `last_error_message`
- timestamps

Recommended statuses:

- `pending`
- `sending`
- `sent`
- `delivered`
- `failed_retryable`
- `failed_permanent`
- `bounced`
- `complained`

Recommended `email_delivery_events` fields:

- `id`
- `provider`
- `provider_event_id`
- `provider_message_id`
- `email_outbox_id`
- `event_type`
- `occurred_at`
- `metadata`
- `signature_verified`
- `created_at`

Add unique constraints for idempotency:

- unique outbox `idempotency_key`
- unique provider delivery event id, scoped by provider

Add metadata guardrails similar to notification metadata. Store only bounded
safe delivery metadata. Do not store raw webhook payloads.

### Resend Adapter

Add a typed Resend email adapter in trusted API/server code only.

Rules:

- Resend API keys and webhook secrets come from server-only env/Secret Manager.
- The browser never receives Resend keys, webhook secrets, provider payloads, or
  provider message metadata.
- Local development can use a fake email adapter that records outbox transitions
  without contacting Resend.
- Staging and production require configured sender domains before real sending.
- Sender domains remain separate from Supabase Auth SMTP senders.

Product senders:

- production: `support@mail.spb-ai.com`
- staging: `support@mail.spb-ai.dev`

Auth senders remain outside this adapter:

- production: `no-reply@auth.spb-ai.com`
- staging: `no-reply@auth.spb-ai.dev`

### Email Worker

Add a trusted worker/command that processes pending outbox rows:

- claims pending rows safely
- sends through the configured adapter
- records provider message id when available
- handles retryable and permanent failures explicitly
- uses bounded retry/backoff
- avoids duplicate sends through idempotency keys and provider message tracking

Product API routes and trusted RPCs may create outbox rows transactionally with
product state changes, but they must not wait for Resend.

### Webhooks

Add `POST /api/v1/webhooks/resend`.

Rules:

- Verify Resend webhook signatures before processing.
- Reject or no-op unverified events without mutating product/email state.
- Process delivery/failure lifecycle events only in V1:
  - sent
  - delivered
  - bounced
  - complained
  - failed
- Ignore opens and clicks for product state.
- Store bounded event metadata only.
- Webhook replay should be idempotent through provider event ids.

### Templates

Email templates must be bilingual from the first 14b slice.

Template rules:

- Choose locale from recipient profile, with the app's standard fallback.
- Use sparse transactional copy.
- Include safe actor and target labels only when already authorized for that
  recipient.
- Link users back to authenticated app surfaces for sensitive details.
- Do not include intro messages, rejection notes, private contact, signed URLs,
  manuscript text, synopsis, document chunks, PayTR raw payloads, provider
  payloads, admin notes, secrets, or tokens.

### 14b Tests

Unit/API tests:

- product event creates exactly one outbox row for each idempotency key
- worker sends pending rows through fake adapter
- retryable failure schedules retry without mutating product state
- permanent failure records safe error state
- templates render in Turkish and English
- templates reject or omit forbidden sensitive fields
- Resend webhook signature verification is required before mutation
- webhook replay is idempotent
- opens/clicks are ignored

Security tests:

- frontend cannot import Resend/server-only email modules
- outbox/template data cannot contain forbidden sensitive keys
- webhook route does not expose raw provider payloads

## Admin And Operations

14a does not add admin notification management. Admins continue using existing
review, jobs, payments, audit, and system-failure surfaces.

14b should make email delivery failures visible through the existing admin jobs
or system-failures surface where practical. Do not add a broad email operations
console unless the existing admin surface cannot represent delivery failures
cleanly.

Sentry and logs should capture safe operational failures after redaction. Do
not send manuscript content, document chunks, contact details, signed URLs,
Resend secrets, or raw webhook payloads to logs or Sentry.

## Validation Checklist

14a completion requires:

- metadata hardening migration
- shared notification contracts
- Fastify list/read/read-all routes
- header bell and `/app/notifications`
- API and UI tests where practical
- browser smoke for desktop and mobile notification flows
- docs updated with implementation status and validation record

14b completion requires:

- email outbox and delivery event migration
- typed Resend adapter and local fake adapter
- outbox processor command/worker
- signature-verified Resend webhook route
- bilingual templates
- idempotency/retry tests
- sensitive-data redaction tests
- docs updated with sender/domain setup and validation record

## Implementation Record

Status: implemented locally for GitHub issues #94-#101.

Implemented:

- `supabase/migrations/20260509180000_step14_notifications_email.sql` hardens notification metadata, adds email outbox/delivery tables, adds safe transactional triggers for notification, decision, and billing/payment email enqueueing, and adds `claim_email_outbox(...)`.
- Shared notification contracts and route contracts cover list, read, read-all, and the Resend webhook acknowledgement.
- Fastify notification routes enforce authenticated marketplace profile ownership, hide unknown types, omit raw metadata, generate safe `ctaPath`, and support cursor pagination plus `all|unread`.
- The web app adds a marketplace-only header bell preview, `/app/notifications`, all/unread filters, mark-read, mark-all-read, polling, refetch-on-focus, and intro-request mutation invalidation.
- Product email uses an async outbox, local fake worker, typed Resend adapter, bilingual templates, and signature-verified Resend webhooks for sent/delivered/bounced/complained/failed lifecycle events.

Validation run locally:

- `npm run test --workspace apps/api -- notifications.test.ts`
- `npm run test --workspace apps/api -- email.test.ts`
- `npm run typecheck --workspace packages/contracts`
- `npm run typecheck --workspace apps/api`
- `npm run typecheck --workspace apps/web`
- `npm run build --workspace packages/contracts`

Not completed locally:

- Live Resend delivery was not validated because sender/domain verification and target-environment secrets are not configured in this workspace.
- Browser smoke for desktop/mobile notification UI still requires starting the local app with seeded notification rows.

Remote migration note:

- Apply `supabase/migrations/20260509180000_step14_notifications_email.sql` after the Step 13b PayTR migration. Configure `EMAIL_PROVIDER_MODE=resend`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, and `RESEND_WEBHOOK_SECRET` before live product email validation.
