# API Architecture

## Summary

The Fastify + Node.js API is the main product backend. It validates requests, enforces authorization, coordinates Supabase, creates signed file URLs, talks to PayTR and Resend, enqueues Cloud Tasks, and invokes the private FastAPI AI service for ingestion and matching.

The browser must not call Supabase service-role APIs, Google Cloud privileged APIs, PayTR secrets, Resend APIs, or the AI service directly.

## API Style

- Use REST under `/api/v1`.
- Use Fastify app factories so routes can be tested with injection.
- Use TypeScript strict mode.
- Validate request and response bodies with Zod contracts from `packages/contracts`.
- Return consistent JSON errors.
- Use Supabase Auth JWTs for end-user authentication.
- Use service-role Supabase access only inside trusted server code.
- `STORAGE_PROVIDER=local` and `DOCUMENT_PROCESSING_PROVIDER=local` are local-development defaults. Staging and production must use `STORAGE_PROVIDER=gcs` and `DOCUMENT_PROCESSING_PROVIDER=cloud_tasks`.
- GCS signed upload/download URLs are created only by trusted API code after authorization checks. Browsers receive short-lived object URLs only; they never receive GCS credentials, bucket IAM, service-role credentials, or AI-service internal URLs.
- Validate typed environment configuration at startup and fail fast when required values are missing or provider modes are inconsistent.
- `API_AUTH_MODE=test` is allowed only for explicit local development. Startup must fail fast if test auth is configured without `APP_CONFIG_MODE=local` or if `NODE_ENV=production`.
- The API must answer browser CORS preflights for authenticated frontend calls and return `Access-Control-Allow-Origin` for the configured `WEB_APP_URL`.
- In local development, the API should also allow loopback frontend origins such as `http://localhost:<port>` and `http://127.0.0.1:<port>` so Vite fallback ports do not break authenticated browser requests during normal dev work.

## Auth Ownership

Use Supabase Auth on the client for session creation and token refresh. The Node API owns application identity state after authentication:

- `POST /api/v1/profiles` creates or completes the app profile for an authenticated Supabase user.
- The API mirrors and validates profile email from Supabase Auth.
- The API controls role selection, profile completion, eligibility state, review outcomes, and admin-only mutations.
- Users cannot create app roles, eligibility/review state, subscriptions, or admin privileges directly through client-side table writes.
- The first admin is bootstrapped through an idempotent trusted script using service-role credentials, not through public signup.

## Suggested Modules

```txt
apps/api/src/
  modules/auth
  modules/profiles
  modules/manuscripts
  modules/documents
  modules/matching
  modules/intro-requests
  modules/billing
  modules/admin
  modules/notifications
  lib/supabase
  lib/paytr
  lib/resend
  lib/sentry
  lib/cloud-tasks
  lib/storage
  lib/ai-service
```

Current scaffold:

- `apps/api/src/server.ts` is the composition root that wires route registrars, auth dependencies, test fixture state, and the shared error handler.
- `apps/api/src/modules/config/config.ts` validates runtime config with Zod.
- `apps/api/src/modules/config/loadEnvFile.ts` loads `apps/api/.env` before config validation so local dev restarts keep the same environment.
- `apps/api/src/modules/health/registerHealthRoutes.ts` owns health and readiness routes.
- `apps/api/src/modules/profiles/registerProfileRoutes.ts` owns profile route wiring; `apps/api/src/modules/profiles/service.ts` owns the profile onboarding invariant that an authenticated non-admin user creates exactly one marketplace profile and completes role-specific onboarding details through the atomic profile details RPC.
- Step 10 profile surfaces in `apps/api/src/modules/profiles/` are split by responsibility: public publisher directory decisions, match-visible contact settings, access policy helpers, and publisher/author profile page read models. `matchProfileService.ts` stays as a small route-facing barrel.
- `apps/api/src/modules/admin/registerAdminRoutes.ts` owns admin route wiring; `apps/api/src/modules/admin/service.ts` owns admin read-model aggregation and review decision workflow behavior.
- `apps/api/src/modules/admin/profileReviews.ts` keeps the legacy pending-profile route backed by `eligibility_status = 'limited'` and `review_outcome = 'needs_review'`; the primary admin workspace is the exception queue in `apps/api/src/modules/admin/service.ts`.
- `apps/api/src/modules/admin/bootstrapFirstAdmin.ts` and `apps/api/src/scripts/bootstrapFirstAdmin.ts` own the trusted first-admin bootstrap path backed by a service-role client and email allowlist.
- `apps/api/src/modules/auth/requestAuth.ts` centralizes bearer-token authentication and admin authorization checks.
- `apps/api/src/modules/manuscripts/registerManuscriptRoutes.ts` owns the Step 8/9 manuscript/document lifecycle, including author-only checks, local signed upload targets, GCS signed URL responses, local file serving, and test-mode review side effects.
- Step 10 manuscript profile access in `apps/api/src/modules/manuscripts/` is split into manuscript profile page reads, manuscript access request workflow, shared DB access helpers, and a focused error type. `profileAccessService.ts` stays as a small route-facing barrel.
- Step 10 matching in `apps/api/src/modules/matching/` is split by responsibility: `service.ts` is the small route-facing dispatcher, `testMatchingService.ts` owns local fixture behavior, `supabaseMatchingService.ts` owns trusted Supabase run lifecycle and authorization gates, `tracerCandidates.ts` owns deterministic tracer candidate/grant persistence, and mapper/snapshot modules keep response shaping and safe input fingerprints isolated.
- `apps/api/src/modules/storage/localTokens.ts` and `apps/api/src/modules/storage/localStorage.ts` own local fake signed URLs and ignored `local-uploads/` storage.
- `apps/api/src/modules/storage/gcsStorage.ts` owns private GCS object names, signed upload/download URL creation, and server-side object existence checks.
- `apps/api/src/modules/manuscripts/documentProcessingQueue.ts` owns Cloud Tasks enqueueing for document-processing jobs. The task payload is `{ job_id }` only and Cloud Tasks uses OIDC with the configured invoker service account to call the private AI service.
- `apps/api/src/lib/http/` contains shared JSON error helpers and the Fastify error handler.
- `GET /health` and `GET /ready` return the shared health contract.
- `POST /api/v1/profiles` and `GET /api/v1/profiles/me` support test auth mode and Supabase-backed mode.
- `GET /api/v1/admin/pending-profiles` and `POST /api/v1/admin/profiles/:profileId/decision` are compatibility endpoints for profile exceptions. The legacy decision endpoint must resolve a pending profile review and then use the canonical admin review decision workflow, so profile decisions remain audited and constrained to `status = 'pending'`, `eligibility_status = 'limited'`, and `review_outcome = 'needs_review'`.
- Admin dashboard, exception queue/detail/decision, audit log, job health, payment health, and trust-safety routes are scaffolded behind admin authorization checks.
- Admin review decisions call `public.apply_admin_review_decision(...)` so review status updates and audit-log inserts happen together in one Postgres transaction.

## Planned V1 Route Groups

The route groups below describe the target V1 API. The current scaffold includes health/readiness, profile creation and lookup, and the initial admin operations listed above; the remaining groups are planned slices.

### Auth And Profile

- `GET /api/v1/me`
- `PUT /api/v1/me`
- `POST /api/v1/profiles`
- `PUT /api/v1/author-profile`
- `GET /api/v1/author-profile`
- `PUT /api/v1/publisher-profile/change-request`
- `GET /api/v1/publisher-profile`

Rules:

- Role is chosen once during onboarding.
- Users cannot set their own eligibility or review outcome.
- Publishers submit preference changes through change requests. Clean changes can be auto-approved; uncertain or risky changes become admin exceptions.

### Manuscripts And Documents

- `GET /api/v1/manuscripts`
- `POST /api/v1/manuscripts`
- `GET /api/v1/manuscripts/:id`
- `PATCH /api/v1/manuscripts/:id`
- `POST /api/v1/uploads/signed-url`
- `PUT /api/v1/uploads/local/:uploadToken`
- `POST /api/v1/documents/:id/complete-upload`
- `GET /api/v1/documents/:id`
- `GET /api/v1/documents/:id/download-url`

Rules:

- Only authors can create manuscripts.
- Only authors upload sample documents in v1.
- `POST /api/v1/uploads/signed-url` creates a pending document record and returns a short-lived local fake signed upload URL in local mode, or a short-lived private GCS signed upload URL when `STORAGE_PROVIDER=gcs`.
- `PUT /api/v1/uploads/local/:uploadToken` is a public signed URL target and does not rely on a bearer token.
- The local signed upload target must accept bytes only while the document is still `pending_upload`, and must verify the request content type and exact byte length against the metadata validated by `POST /api/v1/uploads/signed-url` before writing local storage.
- `POST /api/v1/documents/:id/complete-upload` returns a conflict when the pending upload is stale, already completed, or the stored file is missing. Replacement uploads keep the previous uploaded sample active until completion succeeds; completion atomically creates or reuses exactly one idempotent ingestion job, marks the previous uploaded sample `pending_delete`, and attaches the new sample. If job creation fails, the document must remain pending and unattached.
- Local Step 9 processing is run from trusted API code with `npm run documents:process --workspace apps/api -- <limit>`. The processor selects queued `document_processing_jobs`, claims them, and invokes the internal AI-service ingestion endpoint with `{ job_id }` only. It must skip already-running, succeeded, failed, or cancelled jobs.
- Staging and production enqueue the idempotent `document_processing_jobs.id` to Cloud Tasks after upload completion. Cloud Tasks calls `POST /internal/ingestion/run` on the private AI Cloud Run service with `{ job_id }` only and an OIDC token for `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL`. The API must not put manuscript text, signed URLs, user JWTs, service-role keys, or GCS credentials into task payloads.
- Signed download URLs require ownership, admin access, or accepted intro access.

### Matching

- `POST /api/v1/matches/run`
- `GET /api/v1/matches`
- `GET /api/v1/matches/:matchRunId`
- `GET /api/v1/matches/:matchRunId/candidates/:candidateId`
- `GET /api/v1/profile/history`
- `GET /api/v1/profiles/publishers/:publisherProfileId`
- `GET /api/v1/profiles/authors/:authorProfileId`
- `GET /api/v1/profiles/manuscripts/:manuscriptId`
- `GET /api/v1/public/publishers`
- `POST /api/v1/manuscripts/:manuscriptId/access-requests`
- `GET /api/v1/manuscript-access-requests`
- `POST /api/v1/manuscript-access-requests/:requestId/approve`
- `POST /api/v1/manuscript-access-requests/:requestId/reject`

Rules:

- Match runs are rate-limited but not monthly quota-limited.
- Step 10 supports both `author_to_publisher` and `publisher_to_manuscript` runs. Author-to-publisher runs are tied to one manuscript; publisher-to-manuscript runs use the publisher's general profile.
- The current Step 10 tracer implementation creates durable match runs, calls the private AI service with only `{ match_run_id }`, and persists deterministic safe candidates so the product path is usable while real retrieval/scoring is built.
- Full match visibility requires eligible profile state, eligible manuscript/document state where a manuscript is the source or candidate, successful sample processing for manuscript candidates, publisher discoverability, and entitlement checks.
- The Node API owns authorization, eligibility, rate limits, run creation, persistence, response validation, and role-based redaction.
- The FastAPI AI service owns three-axis retrieval/scoring, soft-constraint penalties, ranking, safe snippet selection, and real Vertex/Gemini explanation generation.
- The AI service is called with trusted identifiers such as `{ match_run_id }` and loads data through service-role repositories. Browser requests must not include raw manuscript text, signed URLs, provider credentials, or AI-service internals.
- API returns explanation fields, not raw model internals.
- Candidate detail returns stored explanation data, structured score details, penalties, and source snippets; it does not generate a separate report.
- Match runs and candidates must store algorithm/version metadata, input fingerprints, and compact safe input snapshots for auditability and stale-run badges.
- Rematch creates a new run. Previous runs remain available in profile history.
- Full profile pages are match-revealed app resources, not public profiles. Access must be granted by owner/admin status, stored match candidate, approved manuscript access request, or later accepted intro.
- Stored match visibility currently flows through `profile_access_grants`; later `match_candidates` writes should create those grants instead of broadening table RLS for raw profile/manuscript tables.
- Public `/publishers` returns only admin-approved publisher logo, name, and valid `https` website. It must not expose full publisher profile details or marketplace-only matching data.
- Manuscript access requests are manual and publisher/manuscript-specific. Approval unlocks only the manuscript profile page for the requesting publisher; it does not unlock private contact details, sample download, or full manuscript text.
- Owner-approved match-visible contact fields may appear on match-revealed profile pages. Private account email/phone, staff/editor contact, sample URLs, and full manuscripts remain locked until a later accepted intro or explicit owner-visible setting permits them.

### Discovery

- `GET /api/v1/discovery/publishers`
- `GET /api/v1/discovery/manuscripts`

V1 discovery filters:

- role/type
- eligibility status
- genre
- language
- target age band
- city/country
- accepts unsolicited
- manuscript/document processing status
- created date

Rules:

- Limited, blocked, quarantined, or otherwise ineligible profiles/manuscripts never appear.
- Private contact details and sample URLs are excluded unless an accepted intro unlock exists. Owner-approved match-visible contact fields are exposed only through access-checked profile detail routes.
- Discovery ordering must not use paid plan status as a hidden relevance boost.

### Intro Requests

- `POST /api/v1/intro-requests`
- `GET /api/v1/intro-requests`
- `POST /api/v1/intro-requests/:id/accept`
- `POST /api/v1/intro-requests/:id/reject`
- `POST /api/v1/intro-requests/:id/cancel`

Rules:

- Either side can initiate.
- Only the recipient can accept or reject.
- Accepted requests unlock contact details and sample access.

### Billing

- `GET /api/v1/billing/subscription`
- `GET /api/v1/billing/usage`
- `POST /api/v1/billing/paytr/checkout-token`
- `POST /api/v1/webhooks/paytr`
- `POST /api/v1/webhooks/resend`

Rules:

- PayTR callbacks must be hash-verified and idempotent.
- Payment event payloads are stored for audit.
- Never store card data.
- Resend webhooks must be signature-verified before processing delivery events.

### Notifications

Transactional email is sent through Resend from the API or trusted async workers.

Initial email events:

- profile eligibility or exception decision
- manuscript eligibility or exception decision
- intro request received
- intro request accepted or rejected
- payment/subscription update

Rules:

- Email templates must use route-independent i18n keys and support Turkish and English.
- Do not include full manuscript text, document chunks, signed URLs, raw PayTR payloads, or unreleased contact details in email bodies.
- Prefer emails that bring users back into the authenticated app for sensitive details.
- Email sends tied to product events should be idempotent using event IDs or unique constraints.
- Store minimal delivery metadata for operations; avoid storing full rendered email bodies when they include user data.

### Admin

- `GET /api/v1/admin/reviews`
- `POST /api/v1/admin/reviews/:id/approve`
- `POST /api/v1/admin/reviews/:id/reject`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/payment-events`
- `GET /api/v1/admin/audit-logs`

Rules:

- Admin routes require active `public.admin_users` membership and an MFA-satisfied session, except the guarded local seeded admin bypass.
- All admin mutations write audit logs. Sentry captures runtime failures/traces around admin operations, but does not replace audit logs.

## Error Format

Use a shared shape:

```json
{
  "error": {
    "code": "MANUSCRIPT_NOT_APPROVED",
    "message": "This manuscript is not eligible for matching.",
    "details": {}
  }
}
```

## Idempotency

Required for:

- PayTR callbacks.
- Resend webhook events.
- Cloud Task handlers.
- document ingestion starts.
- match generation.
- usage ledger writes.

Use explicit idempotency keys or unique constraints:

- PayTR callbacks: unique provider event ID plus hash verification before mutation.
- Resend webhooks: unique provider event ID plus signature verification before processing.
- Intro requests: unique pending manuscript/publisher pair.
- Match generation: unique request key for the same requester/manuscript/direction while a run is queued or running.
- Usage ledger: unique source event ID for quota-consuming actions.
- Document ingestion: unique document ID plus ingestion idempotency key. Upload completion creates or reuses the row without resetting an existing processing attempt.

Quota-consuming writes must be transactional. The API must reserve or consume quota in the same database transaction as the action that creates usage.

## Runtime Limits

Initial V1 limits:

- Manuscript sample upload size: 25 MB.
- Accepted sample formats: digital PDF, DOCX, EPUB, and plain text.
- Maximum extracted characters per sample for V1 matching: 250,000.
- Maximum chunks per document: 300.
- Maximum returned match candidates per run: 25.
- AI ingestion timeout: 5 minutes per document.
- Matching timeout: 60 seconds per run.

Initial V1 rate limits:

- Match runs: 10 per user per hour and 3 per manuscript per hour.
- Upload signed URLs: 20 per user per hour.
- Intro request creation: 10 per user per day, also constrained by subscription quota.
- Auth-sensitive API endpoints: 10 attempts per IP per 10 minutes.
- PayTR and Resend webhooks: require signature/hash verification and replay protection; do not rely on IP allowlists alone.

## Open Questions

- Should production rate limits be adjusted after staging usage data?
