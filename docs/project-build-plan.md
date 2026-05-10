# Step-By-Step Build Plan For The Publisher-Author SaaS Marketplace

## Summary

Build V1 as a vertical-slice-first product: first make authenticated signup/profile creation work end-to-end, then expand into author/publisher details, documents, matching, intro requests, billing, admin, observability, and production deployment.

Chosen defaults:

- Build sequence: vertical slice first.
- Scaffold posture: minimal runnable slices before broad production-shaped skeletons.
- Integrations: stub typed adapters first, then wire real providers.
- Launch posture: simplified Growth V1 with SEO-oriented public pages, explainable match details, monthly + annual plans, and stronger admin polish.
- Frontend rendering: React SPA + prerendered public pages, preserving the current architecture.
- Current stack: Vite + React + React Router + TanStack Query, Fastify API, FastAPI AI service, npm workspaces, `uv` for Python, and first-slice Zod contracts with route contracts and OpenAPI emission.
- Current auth posture: email/password plus Google social auth through Supabase Auth, with the app callback route at `/auth/callback` and a profile-first post-signup flow.

## MCP Servers And Agent Tooling

MCP servers are build-time and operations tooling for agents and developers. They are not production runtime dependencies and must not be required by the deployed web, API, or AI services.

Use these MCP servers where available:

- Context7 MCP: required for current framework/library documentation during implementation, especially React, Tailwind, shadcn/ui, FastAPI, Pydantic, Supabase, Terraform, Sentry, Resend, and Google Cloud SDK usage.
- Supabase MCP: required for safe project/schema inspection, migration review, generated type checks, RLS inspection, and local/staging database verification.
- GitHub MCP: required once the repo is hosted on GitHub for issues, pull requests, code review context, CI status, and release tracking.
- Browser/Playwright MCP: required for frontend and admin UI verification, prerendered public page checks, authenticated flow smoke tests, screenshots, and accessibility-oriented inspection.
- Sentry MCP: required after Sentry is configured for issue triage, release health review, trace inspection, and production/staging error investigation.
- Google Cloud MCP, if available in the team's environment: use for read-only inspection of Cloud Run, Cloud Tasks, GCS, Secret Manager, IAM, logs, and monitoring. Terraform and `gcloud` remain the executable source for infrastructure changes.

Do not block implementation on MCP servers that do not exist for a provider. PayTR and Resend integration should primarily use official docs, SDKs/APIs, local stubs, contract tests, and webhook fixtures unless a reliable MCP server is available later.

## Container Strategy

Containers are required for staging and production because Cloud Run deploys container images. They are strongly recommended for CI and integration testing, but daily local development may use direct commands such as `npm run dev` and `uv run uvicorn app.main:app --reload` for faster feedback.

Use containers at three levels:

- Production: build immutable images for `apps/web`, `apps/api`, and `apps/ai-service`, publish them to Artifact Registry, and deploy them to Cloud Run.
- CI: build, test, scan, tag, and push the same images that will be deployed.
- Local development: provide optional Docker Compose for onboarding and integration tests; keep direct local dev commands available for day-to-day coding.

Container best practices:

- Add one production Dockerfile per deployable service: `apps/web`, `apps/api`, and `apps/ai-service`.
- Use multi-stage builds to keep runtime images small.
- Run containers as non-root users where the base image supports it.
- Do not bake secrets, `.env` files, service account keys, source maps intended only for Sentry, or local credentials into images.
- Keep images environment-agnostic; inject config through environment variables and Secret Manager.
- Add `.dockerignore` files to exclude dependencies, build outputs, caches, credentials, local uploads, and test artifacts.
- Add health endpoints: API `/health`, AI service `/health`, and a web container static health check.
- Tag images with git SHA, service name, and environment-friendly release identifiers.
- Align Sentry release names with image versions.

## Junior-Friendly Development Practices

Use a workflow that makes mistakes cheap and visible:

- Work in small vertical slices: schema/contract, API, UI, tests, then polish.
- Keep one task branch focused on one behavior or screen.
- Start each behavior change with a failing test when practical.
- Run the narrowest validation command before broader checks.
- Prefer typed contracts, enums, schemas, and helper functions over copying strings across files.
- Keep business logic out of React components; put data fetching in hooks/clients and product rules in API/service modules.
- Use local stubs first for PayTR, Resend, GCS, Cloud Tasks, Sentry, and Vertex AI so you can build without provider accounts.
- Write setup notes when something is confusing; promote repeated notes into `docs/`.
- Add useful empty, loading, error, and permission-denied states as part of the first implementation, not as cleanup.
- Do not commit secrets, real credentials, generated local files, logs, or uploaded manuscripts.
- When stuck, reduce the problem to one failing test, one route, one component, or one database policy.
- Before opening a PR, include what changed, how it was tested, screenshots for UI changes, and any skipped checks.
- Prefer boring, readable code over clever abstractions. Add abstractions only after the duplication is obvious and stable.

## Key Build Steps

### 1. Bootstrap The Monorepo

- Status: mostly complete for the minimal runnable scaffold.
- Create `apps/web`, `apps/api`, `apps/ai-service`, `packages/contracts`, `packages/ui`, `supabase/migrations`, `infra/terraform`, and `scripts/seed`.
- Use npm workspaces for TypeScript packages and `uv` for the FastAPI service.
- Add root validation scripts matching `AGENTS.md`: lint, typecheck, test, build, and format check.
- Add `npm run check:harness` so agent entry docs, source-of-truth wording, Codex tooling docs, and CI wiring fail visibly when they drift.
- Add root `npm run dev` with `concurrently` for web + API.
- Add local env examples for Supabase, GCS, PayTR, Resend, Sentry, Vertex AI, and app URLs.
- Add `docs/mcp-tooling.md` with required MCP server names, purpose, setup notes, secret handling, and fallback commands.
- Add a non-secret local MCP setup checklist for Context7, Supabase, GitHub, Browser/Playwright, Sentry, and Google Cloud inspection.
- Add root `README.md` quickstart commands for direct local dev. Docker Compose is deferred.
- Add root `.gitignore` entries for env files, local uploads, build outputs, caches, logs, and generated artifacts.
- Keep `AGENTS.md` as a short map and put durable agent workflow guidance in `docs/agent-harness.md`.

### 2. Create The First-Slice Shared Contract Layer

- Status: complete for the scaffold and first signup/profile slice.
- Define Zod contracts in `packages/contracts`.
- Cover health, API errors, onboarding profile creation, profile responses, and the routes needed by those flows.
- Use a consistent API error shape: `{ error: { code, message, details } }`.
- Keep route contracts, path building, response-validating client helpers, and OpenAPI emission in `packages/contracts`.
- Add future-domain contracts only when the related vertical slice begins.

### 3. Build The Web App Foundation

- Status: complete for the first scaffolded web slice.
- Use Vite + React + React Router + TanStack Query.
- Base styling on Tailwind and shadcn/ui patterns; add concrete shadcn components only when a screen needs them.
- Add Turkish/English i18n key structure before expanding screen copy.
- Keep the first slice product-shaped, not just a detached auth funnel.
- Route `/` to a real home page with the shared platform header, keep login/signup as public entry points, and keep onboarding inside the same overall product shell.
- Validate API health through the shared client layer.
- Defer broader shared UI work in `packages/ui` until real duplication appears.

### 4. Connect Cloud Supabase For The First Slice

- Status: complete. Cloud Supabase is used instead of local Docker-based Supabase (Docker was not available).
- Created `apps/api/.env` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and placeholder values for future providers. `API_AUTH_MODE=test` is kept until Step 6 implements JWKS verification.
- Created `apps/web/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Updated `apps/api/src/modules/config/config.ts`: removed `supabaseJwtSecret` (not needed for JWKS), kept `supabaseUrl`, updated supabase-mode validation to only require `supabaseUrl`. JWKS endpoint is derived as `${supabaseUrl}/auth/v1/.well-known/jwks.json`.
- Decided: use JWKS-based JWT verification (via `jose` library) instead of the legacy symmetric JWT secret. This aligns with current Supabase recommendations.
- Remaining manual task: apply `supabase/migrations/202604300001_create_profiles.sql` in the Supabase cloud SQL Editor. This must be done before Step 6 can write real profile rows.
- Service-role credentials are kept out of all env files until explicitly needed.

### 5. Build The Fastify API Foundation

- Status: complete. Config has been updated to support JWKS-based auth (no JWT secret required).
- Fastify TypeScript API is running with strict mode, shared contract validation, typed config, route tests, and consistent error handling.
- `/health` and `/ready` endpoints are in place.
- Public API routes are versioned under `/api/v1`.
- Test-mode auth is active; replace with JWKS-based Supabase JWT verification in Step 6.
- Add server-side Supabase clients (anon-aware user client and service-role trusted client) in Step 6.
- Add typed adapters for PayTR, Resend, Cloud Tasks, GCS, Sentry, and AI service only when their vertical slices begin.

### 6. Build Auth, Signup, And Profile Creation

- Status: complete.
- Implemented signup/login via Supabase Auth on the frontend (`LoginPage`, `SignupPage`).
- Added a dedicated staff login path at `/admin/login`; marketplace `/login` is for authors and publishers and redirects staff accounts to the staff entry point.
- Added shared forgot/reset password routes and an `/admin/mfa` path for TOTP enrollment or verification.
- Frontend uses Supabase Auth directly for session creation and refresh (`AuthContext`, `AuthGuard`).
- API verifies the Supabase access token via JWKS, requires issuer `${SUPABASE_URL}/auth/v1` plus audience `authenticated`, and never trusts `user_id` from request bodies (`verifyJwt.ts`).
- Added a 3-step signup flow for email/password accounts: account credentials, profile basics, and usage intent.
- Added Google social auth entry points on login. Signup itself is now a single 3-step wizard; users without a marketplace profile return to `/signup`, and `/signup/complete` is only a compatibility redirect.
- Public `/auth/callback` is marketplace-only: if a staff identity reaches it, the app clears signup state, signs out, and redirects to `/admin/login?reason=staff` instead of landing in admin.
- `/signup` blocks all staff membership states from rendering the marketplace wizard; `mfa_required` goes to `/admin/mfa`, `allowed` goes to `/admin`, and `revoked` returns to staff login.
- Persisting app profile rows through the API to `public.profiles` with `display_name`, `role`, `locale`, `profile_photo_url`, and `signup_intent` (`server.ts`).
- Added `GET /api/v1/profiles/me` to fetch the current user's profile.
- Replaced the standalone onboarding journey with a profile-first flow. `/onboarding*` routes now behave as compatibility redirects to `/app/profile`.
- Added a basic profile placeholder page as the first post-signup destination.
- `/app/profile` now includes the author detail form for biography, primary genre, and writing languages and calls `POST /api/v1/profiles/me/onboarding-details`; publisher preference editing on `/app/profile` remains for a later slice.
- Add automated profile eligibility checks after the richer profile fields are in place.
- Profiles that pass deterministic checks can become discoverable automatically; profiles with uncertain or high-risk signals enter admin exception review.
- Production rollout rule: before production auth testing, replace all `localhost:5173` app callback values with the public domain in frontend config, backend `WEB_APP_URL`, and Supabase Auth URL Configuration. Provider callback URLs such as Google should continue to use the Supabase project callback unless the project itself changes.
- Auth email delivery rule: configure Supabase Auth custom SMTP with Resend before serious email/password signup testing or production auth testing. Supabase Auth sends confirmation, reset, invite, and future OTP/magic-link emails through its SMTP settings; these are separate from the API-owned product email adapter.

### 7. Build The Admin Operations Console

- Implement `/admin` as a lean same-domain exception and override console with dashboard, needs-review workspace, quarantine, reports, system failures, jobs, payments, audit logs, and settings.
- Implement exception screens for profiles, manuscripts, documents, and publisher change requests when automated checks return `needs_review`, `quarantined`, report, or system-failure outcomes.
- Use a review detail drawer with entity summary, submitted fields, risk warnings, eligibility status, review outcome, related events/jobs, audit history, safe override actions, and required internal notes.
- Add admin-only access checks and audit logs for every admin mutation. Use Sentry for runtime exceptions, traces, release health, and triage links; use Postgres audit logs for durable product/admin decisions.
- Require MFA-satisfied admin sessions before protected admin pages or mutations are usable in staging and production. Local development may use the guarded `npm run admin:seed --workspace apps/api` path with known credentials and local-only MFA bypass.

### 8. Build Manuscript And Document Upload Flow

- Status: complete.
- Authors can create/edit manuscripts and upload one active sample document.
- API validates file type, size, ownership, eligibility state, and storage quota.
- API issues short-lived signed upload/download URLs.
- Store document metadata in Postgres and private files in GCS.
- Use local storage or fake signed URLs in local development until real GCS is wired.

### 9. Build AI Service Foundation

- Status: complete for the Step 9 AI service foundation. The local job-boundary, production-shaped processing adapters, reprocessing storage boundary, admin exception policy, Step 9c scanner slice, staging env templates, and ADR 0008 scanner launch posture are implemented and documented. Upload completion queues an idempotent processing job; the API processor claims queued jobs and dispatches the AI service by `job_id`; the AI service reads stored bytes through storage adapters, scans before parsing, processes local `text/plain` samples, writes bounded chunks plus reference-only embedding records, and preserves one active chunk/reference set per document.
- Create FastAPI app with ingestion, retrieval, matching, repositories, and settings modules.
- Add Pydantic models that match the then-current API contracts for AI-facing requests and responses.
- Implemented first ingestion slice supports plain text (`text/plain`) only, behind parser/storage/repository/embedding interfaces that can later add digital PDF, DOCX, and EPUB without changing the job flow.
- Upload completion creates or reuses an idempotent `document_processing_jobs` row and moves the document into an async checking state. User-facing upload completion must continue to avoid inline ingestion.
- Preserve the production architecture shape in every environment: browser -> Node API -> processing job -> internal AI service/worker. Local development may fake providers, but it must not fake away the job boundary.
- Production files live in private Google Cloud Storage. Supabase stores document metadata, processing jobs, chunks, embedding references, audit records, and admin exceptions.
- Local development uses local file storage and fake signed URLs as a GCS-shaped adapter. Staging and production use private GCS objects and short-lived trusted access for the API/AI service path.
- Local development now has a local AI-service worker/test fake shape for queued jobs and an API-side processor command: `npm run documents:process --workspace apps/api -- <limit>`. The local worker reads queued/running jobs and document metadata through Supabase service-role REST, reads uploaded bytes from `LOCAL_STORAGE_ROOT`, and writes document chunks plus embedding reference records back to Supabase. Staging and production use Cloud Tasks to call the private AI service.
- Local validation commands: `npm run test --workspace apps/api -- localDocumentProcessingFlow` verifies author upload, queued processing, processed/failed document query states, and no default admin exception for user-correctable failure; `cd apps/ai-service && uv run pytest tests/test_local_validation_flow.py` verifies local worker chunk and embedding-reference writes plus safe empty-file failure.
- The production-shaped Step 9B plumbing is wired behind config and adapters: staging/production require `DOCUMENT_PROCESSING_PROVIDER=cloud_tasks`, private GCS storage, Cloud Tasks queue config, and an AI service URL; local development keeps `DOCUMENT_PROCESSING_PROVIDER=local`, local storage, and fake signed URLs.
- Cloud Tasks document-processing tasks carry only `{ job_id }` and use OIDC with the configured Cloud Tasks invoker service account to call the private AI Cloud Run service. Browser/frontend code never receives service-role credentials, GCS privileged access, or AI-service internal URLs.
- The API can issue private GCS signed upload/download URLs when `STORAGE_PROVIDER=gcs`; the AI service can read private GCS objects through its service identity when `STORAGE_PROVIDER=gcs` and `GCS_BUCKET_PRIVATE_UPLOADS` are configured.
- Local development uses reference-only fake embedding records. Step 9 intentionally stops at embedding references; Step 10 owns the full three-axis matching model, with real Vertex/Gemini match explanations and Vertex AI embeddings/Vector Search behind provider adapters as the production retrieval path.
- Step 9c implements the scanner issue set (#34-#39): `scanner_failed` is part of the shared contract/schema/AI enum, the AI worker runs a `DocumentScanner` boundary before UTF-8 decoding or parsing, local development/tests can simulate `not_scanned`, `clean`, `suspicious`, `quarantined`, and `scanner_failed`, and real scanning uses `DOCUMENT_SCANNER_PROVIDER=http-clamav` with `DOCUMENT_SCANNER_ENDPOINT`, `DOCUMENT_SCANNER_TOKEN`, and `DOCUMENT_SCANNER_TIMEOUT_SECONDS`.
- Scanner outcomes are fail-closed. `clean` continues ingestion. `suspicious` and `quarantined` stop before parsing with `scanner_suspicious`, write no chunks or embeddings, and route to Needs Review or Quarantine. Provider errors, timeouts, malformed payloads, and unknown response values fail as retryable `scanner_failed`.
- Scanner metadata must stay safe and bounded: `scanner`, `scanner_result`, `scanner_version`, `scanner_signature`, and `scanner_error_type` only. API/admin sanitizers must not preserve manuscript text, chunks, original filenames, storage paths, signed URLs, author IDs, tokens, or raw provider payloads.
- No repo-owned scanner deployable is introduced in Step 9c. ADR 0008 documents a controlled internal staging smoke-test escape hatch with `DOCUMENT_SCANNER_LAUNCH_DECISION_ID=ADR-0008`; live malware protection for production and any real-user staging uploads still requires a private scanner endpoint.
- Existing remote databases must apply `supabase/migrations/20260506120855_add_scanner_failed_processing_code.sql` to accept `scanner_failed`; edits to older migrations only keep fresh rebuilds accurate.
- AI service internal calls use a local shared `AI_INTERNAL_TOKEN` in local/dev. Staging and production use private Cloud Run IAM/OIDC.
- Store bounded extracted chunks in `document_chunks`; never store the original file bytes in Postgres. The Supabase-backed worker persists only document metadata, chunks, embedding references, job metadata, and status transitions.
- Store one active chunk set per document. Re-ingestion replaces the active chunks and embedding records through the transactional `public.replace_document_ingestion_outputs(...)` RPC while preserving `document_processing_jobs` history.
- Store chunk-level embedding references only in `embedding_records`; do not store numeric vector arrays in Postgres.
- Step 9 marks documents as checked/processed and stores ingestion evidence. Step 10 owns full matching/discovery eligibility.
- Failed outcomes use stable safe failure codes. Ordinary user-correctable failures such as empty text, unsupported type in the text-only phase, too-large extracted text, and corrupt/unreadable files do not create default admin work.
- Admin exceptions are narrow: suspicious scanner results, quarantine, file type mismatches that indicate validation bypass, repeated system/provider failures after automatic retries including `scanner_failed`, and unexpected runtime errors.
- Author-facing UI uses simple Turkish/English copy and avoids technical terms such as ingestion, chunking, embeddings, parser, job, provider, GCS, Cloud Tasks, or pipeline.
- `/health` and `/ready` endpoints exist for container and Cloud Run checks.

### 10. Build Matching Vertical Slice

- Status: Step 10 Phase 0 profile/access foundation is implemented for GitHub issues #40-#45. GitHub issues #47-#51 are implemented as the durable run/profile-access lifecycle foundation. GitHub issues #52-#56 added the stored scoring/result UI shape. GitHub issues #60-#65 now move deployed matching behind the AI-service-owned path: staging/production AI-service config fails closed without real Vertex/Gemini matching settings; Vertex embedding and Vector Search adapters exist; signal sync embeds/upserts eligible manuscript and publisher signals; `RepositoryBackedMatchingWorker.process_run(match_run_id)` performs retrieval, scoring, candidate/profile-access persistence, and top-10 explanation persistence; and the deployed API reads AI-persisted candidates instead of creating tracer candidates.
- Phase 0: build the profile/access foundation before matching. Add match-revealed publisher, author, and manuscript profile pages; public `/publishers` directory with only admin-approved logo/name/website; owner-approved match-visible contact fields; manual manuscript access requests; and admin public directory approval.
- Implement both author-to-publisher and publisher-to-manuscript match runs.
- Keep hard gates narrow: requester authorization, eligible profile/manuscript where applicable, successful processed sample for manuscript candidates, discoverable publisher profile, entitlement checks, and rate limits.
- Add matching-required author fields: primary genre, subgenres, audience categories, manuscript form, logline, synopsis, and either arc summary or chapter summaries. Collect optional comp titles, declared themes, and declared content warnings.
- Add matching-required publisher fields: publisher name, accepted primary genres, accepted audience categories, accepted manuscript forms, and submission guidelines. Keep editor wishlist and recent acquisitions optional.
- Use three manuscript semantic axes: `premise`, `voice`, and `arc`. Use publisher semantic signals: `guidelines`, optional `wishlist`, and optional `catalog`.
- Track semantic signal freshness in `match_signal_sources`; keep numeric vectors out of Postgres and store only vector references in `embedding_records`.
- Apply genre, audience, manuscript-form, word-count, and exclusion-topic conflicts as penalties and watch-outs, not broad hard filters.
- Retrieve more candidates than are shown, hide final scores below `0.35`, store up to 25 visible candidates, and show stored top-10 one-paragraph explanations. The deployed path is now AI-service-owned; local `API_AUTH_MODE=test` keeps in-memory tracer-like fixtures for repeatable local tests.
- Store `match_runs`, `match_signal_sources`, and `match_candidates` with fingerprints, input snapshots, reference-only embedding records, score breakdowns, penalties, safe snippets, explanation metadata, and stale-run support.
- Return score band, axis bands, one-paragraph explanation when present, fit reasons, risk reasons, snippets, intro CTA state, and match detail CTA state.
- Expose prior match runs under profile history. Rematch always creates a new run; old runs remain visible and may be marked stale.
- Ensure subscription plan never secretly boosts relevance.
- The detailed Step 10 implementation plan lives in `docs/step-10-matching-implementation-plan.md`.

### 11. Build Intro Requests And Contact Unlock

- Status: implemented for GitHub issues #67-#74 as a first end-to-end Step 11 slice. Intro requests can be created from match/access evidence, managed from `/app/requests`, surfaced through match/profile read models, investigated by admins, and used for accepted contact plus publisher sample unlocks.
- Either author or publisher can send an intro request for one manuscript/publisher pair only when durable match/access evidence exists: a stored match candidate for that pair or an approved manuscript access request for that publisher/manuscript.
- Prevent arbitrary outreach from guessed IDs, logged-out public directory browsing, or unrelated profile access. Both profiles, the manuscript, and the active sample must remain eligible for send, accept, and unlock behavior.
- Prevent duplicate pending requests for the same pair. An accepted request is terminal for that pair. Rejected or cancelled requests can be retried only after a 14-day pair-level cooldown.
- Only the recipient can accept or reject. Only the original requester can cancel while pending. Accept requires a confirmation step because it unlocks private relationship data.
- Consume intro request quota when the request is sent, transactionally with request creation, notification creation, and product audit event creation. Start with the simple default limit of 10 intro requests per user/day; Step 13 can replace the quota source with real subscription plan limits.
- Accepted requests unlock relationship contact details for both counterparties and publisher-only sample download access for the current active eligible manuscript sample. Unlocks are computed live from the accepted intro row plus current eligibility; do not copy broad grants into profile rows.
- Keep match-visible contact separate from accepted-intro contact. Use a clearly named `acceptedIntroContact` response block and continue to serve signed sample download URLs only through secure API endpoints.
- Write in-app notification records and product audit events for create, accept, reject, and cancel. Product emails remain deferred to Step 14.
- Add a read-only admin intro request investigation surface with filters, safe metadata, timeline, and unlock status. Do not add admin accept/reject/cancel-on-behalf actions in Step 11.
- The detailed Step 11 implementation notes live in `docs/step-11-intro-requests-implementation-plan.md`. Existing remote databases must apply `supabase/migrations/20260508213000_step11_intro_requests.sql` after the Step 10 matching/access migrations.

### 12. Build Match Detail View

- Status: implemented locally for GitHub issues #75-#82. New AI-service candidates persist a validated historical `detail_snapshot`; the existing candidate detail endpoint/page is enriched in place; and the match run endpoint stays a lightweight card/list response.
- The forward migration is `supabase/migrations/20260509120000_step12_match_detail_snapshot.sql`. Existing remote databases must apply it after the Step 10 and Step 11 migrations before deployed AI-service writers can persist Step 12 detail snapshots.
- `detail_snapshot` stores bounded publisher context, manuscript metadata context, comparison rows, axis evidence, source-labeled snippets, and limitations for every newly persisted visible candidate, including ranks 11-25.
- Match details remain requester-owned, read-only, and deterministic. The only live computed field on candidate detail is `introState`; old rows without `detail_snapshot` use a limited fallback and never reconstruct history from live profile/manuscript tables.
- New candidate writes no longer store raw numeric `scoreDebug`; the migration strips existing `scoreDebug` from `score_details` and adds durable checks against writing it again.
- Match detail shows intro request state/action, but accepted-intro contact and sample download controls remain on request/profile/manuscript surfaces.
- Match result cards are compact previews with score/axis bands, generated explanation when available, two-item fit/watch-out previews, profile/detail links, and intro state/action. Full comparison/evidence/watch-out detail lives on the candidate detail route.
- No report jobs, generated narrative reports, detail-time LLM calls, admin diagnostics, PDF exports, or Google ADK workflows were added in V1.
- The detailed Step 12 implementation notes and validation record live in `docs/step-12-match-detail-implementation-plan.md`; browser smoke coverage lives in `docs/step-12-match-detail-smoke-checklist.md`.

### 13. Build Billing And Usage

- Status: Step 13a billing/usage core is implemented locally for GitHub issues #83-#89, and Step 13b PayTR checkout/webhook core is implemented locally for GitHub issues #90-#93. Existing remote databases must apply `supabase/migrations/20260509080705_step13a_billing_usage_core.sql` after the Step 10, Step 11, and Step 12 migrations before deployed entitlement gates and intro quota can work. Live PayTR wiring is deferred until after Step 21; apply `supabase/migrations/20260509153000_step13b_paytr_checkout_webhooks.sql` with that post-Step-21 PayTR wiring pass.
- Split Step 13 into `13a` billing/usage core and `13b` PayTR checkout/webhooks.
- `13a` now adds explicit 1-month role-derived trials, Author Pro monthly/annual, Publisher Pro monthly/annual, central entitlement checks, plan-backed intro usage, author storage enforcement, public directory entitlement visibility, `/app/billing`, and public `/pricing`. No permanent free tier or admin comp/manual pilot plan was added.
- Trials start only through `POST /api/v1/billing/trial/start` after role-specific profile setup is complete and the profile is eligible. One trial per Supabase Auth user is enforced by `billing_trial_starts`.
- Step 11 fixed intro request quota has been replaced for new sends by monthly `usage_ledger` consumption, transactionally inside `public.create_intro_request(...)`; daily/hourly controls remain abuse controls only when added separately.
- Storage usage is computed from active document state, with upload quota precheck at signed URL creation and completion-time enforcement that avoids unfair double-counting for replacements.
- Match runs are entitlement-gated and remain rate-limited but not monthly quota-metered. Billing state must never affect match relevance, scoring, AI-service inputs, or match detail.
- Downgrade gracefully when trial/subscription entitlement expires: keep historical workspace data, match history/details, match-revealed profiles, intro history, and accepted-intro unlocks readable, but block new gated actions.
- `13b` implements PayTR checkout token creation through a typed adapter, hash-verified idempotent webhook handling, payment event storage, subscription changes, inactive paid downgrade behavior, and narrow audited billing repair for provider-sync incidents. It does not add manual/free comp entitlement. Keep `PAYTR_PROVIDER_MODE=disabled` in deployed environments until the post-Step-21 PayTR wiring checkpoint.
- The detailed Step 13 implementation plan lives in `docs/step-13-billing-usage-implementation-plan.md`.

### 14. Build Notifications And Email

- Status: implemented locally for GitHub issues #94-#101. The detailed Step 14 implementation plan and validation record live in `docs/step-14-notifications-email-implementation-plan.md`.
- Split Step 14 into `14a` in-app marketplace notifications and `14b` product email.
- `14a` starts with existing Step 11 intro-request notifications as the tracer slice. Build a Fastify-only notification read model, shared contracts, metadata guardrails, cursor pagination, read/read-all mutations, a latest-5 header bell preview, and `/app/notifications` with `all`/`unread` filters.
- Keep in-app notification writes transactional with the domain mutation. Use frontend i18n for in-app notification copy, API-owned safe `ctaPath` values, compact actor/target summaries, polling instead of realtime/push, and a 180-day notification retention rule.
- `14b` adds product email through an async idempotent email outbox, typed Resend adapter, worker, bilingual Turkish/English templates, delivery event storage, and signature-verified Resend webhooks.
- Product email triggers are an allowlisted subset of product events such as intro request updates, profile/manuscript decisions, and subscription updates. Do not send email for every in-app notification.
- Verify Resend webhook signatures before processing delivery/failure lifecycle events. Ignore opens/clicks for V1 product state.
- Do not email manuscript text, document chunks, signed URLs, raw PayTR payloads, intro messages, rejection notes, unreleased contact details, provider payloads, secrets, or tokens.
- Keep Supabase Auth emails out of this adapter. Auth lifecycle emails are configured in Supabase custom SMTP through Resend SMTP using dedicated auth senders such as `no-reply@auth.spb-ai.com` for production and `no-reply@auth.spb-ai.dev` for staging.
- Existing remote databases must apply `supabase/migrations/20260509180000_step14_notifications_email.sql` after the Step 13b migration. Live Resend validation requires a verified sender/domain plus `EMAIL_PROVIDER_MODE=resend`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, and `RESEND_WEBHOOK_SECRET`.

### 15. Build Frontend Product Screens

- Public pages: home, pricing, login, signup, signup complete compatibility redirect, auth callback, forgot password, terms, privacy, KVKK, cookies.
- App pages: dashboard, manuscripts, manuscript detail, matches, guarded match detail/profile pages, guarded discover authors/publishers placeholders, requests, profile, profile history, match-revealed publisher/author/manuscript profiles, billing, settings. Keep `/onboarding` only as a compatibility redirect until removed.
- Admin pages: dashboard, reviews, users, manuscripts, publishers, jobs, payments, audit logs, settings.
- Public pages should be SEO-oriented and prerendered while the authenticated app remains a SPA.
- Add a static health route or file for the web container and Cloud Run health checks.
- Use Browser/Playwright MCP for route inspection, screenshot checks, mobile/desktop layout validation, and authenticated flow smoke tests.

### 16. Wire Observability

- Add structured JSON logs with `timestamp`, `service`, `environment`, `request_id`, `user_id`, `job_id`, `event`, `status`, and `duration_ms`.
- Propagate `request_id` across frontend, API, Cloud Tasks, AI service, and database writes.
- Enable Sentry for frontend, API, and AI service with environment/release tags.
- Use Sentry projects `spb-ai-web`, `spb-ai-api`, and `spb-ai-ai-service`; tag deployed events with `staging` or `production`.
- Align release names with the deployed service and git SHA: `web@<git-sha>`, `api@<git-sha>`, and `ai-service@<git-sha>`.
- Route initial Sentry alerts to email, with Slack routing deferred until the team has a shared Slack workspace.
- Scrub manuscript text, document chunks, signed URLs, PayTR secrets, Resend secrets, service-role keys, and unreleased contact details.
- Track API latency/errors, onboarding completion, automated eligibility outcomes, exception-review time, upload failures, AI job failures, match latency, PayTR failures, Resend failures, quota denials, and intro acceptance.
- Use Sentry MCP after staging is configured to inspect issues, traces, releases, and alert quality without exposing sensitive payloads.

### 17. Build Infrastructure

- Terraform Cloud Run services for web, API, and private AI service.
- Add Artifact Registry repositories for container images.
- Add Cloud Tasks queues, GCS buckets, Secret Manager secrets, IAM, monitoring, DNS/domain mapping, and service accounts.
- Keep separate local, staging, and production configuration.
- Use `https://spb-ai.com` as the canonical production URL, redirect `https://www.spb-ai.com` to the apex domain, and use `https://spb-ai.dev` for staging.
- Use private manuscript buckets `spb-ai-prod-manuscripts` and `spb-ai-staging-manuscripts`; all upload/download access must go through API authorization checks and short-lived signed URLs.
- Use Frankfurt-aligned GCP regions where service support allows.
- Configure Resend SPF, DKIM, and DMARC for auth senders `no-reply@auth.spb-ai.com` and `no-reply@auth.spb-ai.dev`.
- Configure Resend SPF, DKIM, and DMARC for product senders `support@mail.spb-ai.com` and `support@mail.spb-ai.dev`.
- Use Google Cloud MCP for read-only deployed resource inspection where available; use Terraform for all planned infrastructure changes.

### 18. Containerize Services

- Add production Dockerfiles for `apps/web`, `apps/api`, and `apps/ai-service`.
- Add `.dockerignore` files for each service or a root `.dockerignore` that keeps images clean.
- Use multi-stage builds:
  - web: install dependencies, build/prerender static assets, serve with a small static server image.
  - API: install dependencies, build TypeScript, run compiled output in production mode.
  - AI service: install Python dependencies, copy app code, run FastAPI with a production ASGI server.
- Ensure containers run without root privileges where practical.
- Add container labels for service, version, git SHA, source repository, and environment.
- Keep all runtime configuration external through environment variables and Secret Manager.
- Add local `docker-compose.yml` for optional integration testing of web, API, AI service, and local dependency stubs.
- Add image build commands to the root scripts or CI workflow.
- Add image scanning in CI before pushing images to Artifact Registry.

### 19. Hardening And Compliance

- Add KVKK, privacy, cookie, retention, export, and deletion flows.
- Add admin audit history for automated eligibility outcomes, admin overrides, billing mutations, document access grants, role/admin changes, and sensitive email events.
- Keep the logging boundary clear: Sentry handles application exceptions, traces, release health, and user-impact debugging; Postgres audit logs handle durable business decisions, admin overrides, and compliance history.
- Add rate limits for match runs, upload signed URLs, intro requests, login-sensitive endpoints, and webhook endpoints.
- Add replay protection for PayTR and Resend webhooks.
- Confirm no service-role keys, PayTR secrets, Resend keys, Sentry auth tokens, or GCP credentials can reach frontend code.
- Confirm no secrets, `.env` files, or service account keys are copied into container images.

### 20. Seed Data, Evals, And Demo Readiness

- Add seed data for genres, age categories, plans, test authors, test publishers, manuscripts, eligible samples, match runs, intro requests, and admin exception reviews.
- Add CSV publisher import script for local/dev only.
- Add AI eval fixtures with expected top-k publishers, mismatch reasons, source snippet quality, and match detail checklist.
- Prepare demo scenarios for author, publisher, and admin flows.

### 21. Staging Rollout

- Use `https://spb-ai.dev` as the staging app URL and `https://spb-ai.dev/auth/callback` as the staging app callback URL.
- Deploy infrastructure to staging.
- Run migrations and seeds.
- Build and push container images for web, API, and AI service to Artifact Registry.
- Deploy API, AI service, and frontend containers to Cloud Run.
- Wire real Sentry and Resend.
- Wire real GCS and Cloud Tasks.
- Keep PayTR disabled during the initial Step 21 staging rollout unless the
  separate post-Step-21 PayTR wiring checkpoint has started.
- Wire Vertex AI Vector Search when provider config is ready.
- Run smoke, integration, E2E, security, webhook replay, and AI eval checks.

### Post-Step-21 PayTR Wiring Checkpoint

- Apply `supabase/migrations/20260509153000_step13b_paytr_checkout_webhooks.sql`
  after the Step 13a billing migration is already live.
- Configure PayTR sandbox/test credentials and callback URL.
- Set final non-zero TRY prices in the paid `plans.price_minor` rows.
- Switch staging to `PAYTR_PROVIDER_MODE=sandbox`.
- Smoke checkout-token creation, PayTR callback success/replay/invalid hash,
  inactive downgrade gates, and narrow admin billing repair.

### 22. Production Launch

- Configure production domain `https://spb-ai.com`, redirect `https://www.spb-ai.com` to the apex domain, and use `https://spb-ai.com/auth/callback` as the production app callback URL.
- Configure production Resend sender domains for Supabase Auth and API-owned product email.
- Apply production infrastructure.
- Run migrations.
- Seed taxonomy and production plans.
- Bootstrap first admin through trusted server/admin path, keep staff accounts separate from marketplace profiles, and require MFA for protected admin routes.
- Promote or rebuild signed container images for API, AI service, and frontend.
- Deploy production containers to Cloud Run.
- Enable PayTR production credentials.
- Enable Sentry production alerts.
- Protect GitHub `main` with required pull requests, passing CI, up-to-date branch before merge, at least one approval, resolved conversations, no force pushes, and no direct pushes.
- Run production smoke tests.
- Monitor onboarding, auto-approval/exception rates, payments, jobs, matching, email delivery, and error rates during launch.

## Public Interfaces And Types

- API stays REST under `/api/v1`.
- Shared request/response validation lives in `packages/contracts`.
- Frontend never calls privileged provider APIs directly.
- Sensitive actions flow through the Node API.
- AI service is private and called only by trusted backend paths.
- External providers are wrapped behind typed adapters:
  - PayTR billing adapter.
  - Resend email adapter.
  - GCS storage adapter.
  - Cloud Tasks adapter.
  - Sentry telemetry setup.
  - Vertex AI retrieval/embedding adapter.
  - Vertex/Gemini explanation adapter.
- Environment config must include public frontend config, server-only API secrets, AI service secrets, provider credentials, and per-environment URLs.
- Deployable services must expose health checks and run from environment-agnostic container images.
- MCP server credentials must be stored outside the repo in local MCP config, CI secrets, or the provider's approved credential store.
- MCP tools must not mutate production resources unless an explicit task calls for it and the change path is documented.

## Test Plan

- Unit tests:
  - matching/scoring
  - platform gates and soft-constraint penalties
  - quota enforcement
  - PayTR hash validation
  - Resend webhook verification
  - signed URL access checks
  - match detail response validation
  - i18n key coverage for critical flows

- API integration tests:
  - signup/profile completion flows
  - manuscript/document upload lifecycle
  - match run lifecycle
  - intro request lifecycle
  - billing and usage flows
  - admin review flows
  - notification/email event flows

- RLS/security tests:
  - cross-user profile access denial
  - private contact detail denial before accepted intro
  - document access denial before accepted intro
  - admin-only route enforcement
  - payment event non-readability
  - webhook replay protection

- AI tests:
  - ingestion fixtures for PDF, DOCX, EPUB, and text
  - deterministic local embedding tests
  - known manuscript/publisher top-k fixtures
  - mismatch reason quality checks
  - match detail completeness checks

- E2E tests:
  - signup and onboarding
  - author creates manuscript and uploads sample
  - automated checks mark clean profile/manuscript/document eligible
  - admin handles a `needs_review` or `quarantined` exception
  - author runs match
  - intro request is sent and accepted
  - contact and sample unlock after acceptance
  - checkout and PayTR callback handling
  - admin reviews jobs, payments, and audit logs

- Validation commands:
  - root `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
  - workspace checks for web, API, and contracts
  - `cd apps/ai-service && uv run ruff check .`, `uv run mypy .`, and `uv run pytest` for AI service
  - `supabase db lint` and local migration reset where safe
  - `terraform fmt -check` and `terraform validate`
  - container builds for `apps/web`, `apps/api`, and `apps/ai-service`
  - Docker Compose integration smoke test when container-related files change
  - MCP smoke check: verify configured MCP servers are reachable before tasks that depend on them, and record fallbacks when unavailable

## Assumptions

- The frontend remains a React SPA, with prerendered public pages for Growth V1 SEO.
- Real third-party providers are introduced after local typed stubs prove product flows.
- Production and staging deploy through containers on Cloud Run.
- Direct local development remains supported without forcing every task through Docker.
- MCP servers are agent/developer tooling only and are not deployed with product services.
- If an MCP server is unavailable, use official docs, CLI inspection, SDKs, tests, and typed stubs instead of blocking feature work.
- Product name/domain are not hardcoded; use app configuration until final brand/domain are provided.
- Annual plans are included in the plan catalog, alongside monthly plans.
- The first admin is bootstrapped through a trusted server/admin path, not self-service signup.
- Match relevance is never affected by paid plan status.
- OCR/Document AI remains deferred unless explicitly requested later.
- Contracts, RLS, PayTR, Resend, signed URL access, matching, match details, and quota behavior use TDD.

## Deferred To V1.5

- AI-generated fit reports.
- Report jobs and report admin screens.
- PDF report exports.
- Google ADK report workflows.
- Report quotas and report-ready emails.

## Related Documents

- `docs/project-knowledge-base.md`
- `docs/mcp-tooling.md`
- `AGENTS.md`
- `docs/architecture/overview.md`
- `docs/architecture/frontend.md`
- `docs/architecture/api.md`
- `docs/architecture/database.md`
- `docs/architecture/ai-rag-pipeline.md`
- `docs/architecture/auth-security-rls.md`
- `docs/architecture/payments-paytr.md`
- `docs/step-13-billing-usage-implementation-plan.md`
- `docs/architecture/observability.md`
- `docs/architecture/deployment-google-cloud.md`
