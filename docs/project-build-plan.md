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
- Persisting app profile rows through the API to `public.profiles` with `display_name`, `role`, `locale`, `profile_photo_url`, and `signup_intent` (`server.ts`).
- Added `GET /api/v1/profiles/me` to fetch the current user's profile.
- Replaced the standalone onboarding journey with a profile-first flow. `/onboarding*` routes now behave as compatibility redirects to `/app/profile`.
- Added a basic profile placeholder page as the first post-signup destination.
- Add author profile and publisher preference forms on `/app/profile` in the next slice.
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

- Status: in progress. First implementation decision record must be updated before code changes continue.
- Create FastAPI app with ingestion, retrieval, matching, repositories, and settings modules.
- Add Pydantic models that match the then-current API contracts for AI-facing requests and responses.
- Implement the first ingestion slice with plain text (`text/plain`) only, behind parser interfaces that can later add digital PDF, DOCX, and EPUB without changing the job flow.
- Upload completion must create or reuse an idempotent `document_processing_jobs` row and move the document into an async checking state. Do not perform user-facing ingestion directly inside the upload request.
- Preserve the production architecture shape in every environment: browser -> Node API -> processing job -> internal AI service/worker. Local development may fake providers, but it must not fake away the job boundary.
- Production files live in private Google Cloud Storage. Supabase stores document metadata, processing jobs, chunks, embedding references, audit records, and admin exceptions.
- Local development uses local file storage and fake signed URLs as a GCS-shaped adapter. Staging and production use private GCS objects and short-lived trusted access for the API/AI service path.
- Local development uses a local processor or inline test fake to run queued jobs. Staging and production use Cloud Tasks to call the private AI service.
- Local development uses reference-only fake embedding records. Staging and production wire Vertex AI embeddings and Vertex AI Vector Search behind config.
- Local development may mark scanner metadata as `not_scanned` with a local scanner adapter. Staging and production must either configure real scanning or carry an explicit launch decision before real user documents are accepted.
- AI service internal calls use a local shared `AI_INTERNAL_TOKEN` in local/dev. Staging and production use private Cloud Run IAM/OIDC.
- Store bounded extracted chunks in `document_chunks`; never store the original file bytes in Postgres.
- Store one active chunk set per document. Re-ingestion replaces the active chunks and embedding records while preserving `document_processing_jobs` history.
- Store chunk-level embedding references only in `embedding_records`; do not store numeric vector arrays in Postgres.
- Step 9 marks documents as checked/processed and stores ingestion evidence. Step 10 owns full matching/discovery eligibility.
- Failed outcomes use stable safe failure codes. Ordinary user-correctable failures such as empty text, unsupported type in the text-only phase, too-large extracted text, and corrupt/unreadable files should not create default admin work.
- Admin exceptions are narrow: suspicious scanner results, quarantine, file type mismatches that indicate validation bypass, repeated system/provider failures after automatic retries, and unexpected runtime errors.
- Author-facing UI must use simple Turkish/English copy and avoid technical terms such as ingestion, chunking, embeddings, parser, job, provider, GCS, Cloud Tasks, or pipeline.
- Add `/health` and `/ready` endpoints for container and Cloud Run checks.

### 10. Build Matching Vertical Slice

- Implement eligibility checks for `eligibility_status = 'eligible'`, valid profile/manuscript/document data, successful ingestion, and entitlement/rate limits.
- Retrieve candidate publishers using the local fake vector adapter first.
- Apply hard filters for genre, excluded genres, language, age range, accepted formats, and structured content limits.
- Store `match_runs` and `match_candidates`.
- Return score band, fit reasons, risk reasons, shared genres, source snippets, intro CTA state, and match detail CTA state.
- Ensure subscription plan never secretly boosts relevance.

### 11. Build Intro Requests And Contact Unlock

- Either author or publisher can send an intro request for one manuscript/publisher pair.
- Prevent duplicate pending requests for the same pair.
- Only the recipient can accept or reject.
- Accepted requests unlock contact details and sample access through secure API endpoints, not direct broad table access.
- Write notifications and audit logs for request state changes.

### 12. Build Match Detail View

- Build a synchronous match detail view from stored `match_candidates` data.
- Show full fit reasons, mismatch/risk reasons, source snippets, publisher preferences, manuscript metadata comparison, and intro request state.
- Keep match details read-only and deterministic; do not create report jobs, generated narrative reports, or PDF exports in V1.
- Keep the stored explanation data structured enough to support future V1.5 report generation.

### 13. Build Billing And Usage

- Implement plans with free/trial, Author Pro monthly/annual, Publisher Pro monthly/annual, and admin comp/manual pilot.
- Add quota checks for intro requests, upload storage, directory visibility, and support level.
- Keep match runs rate-limited but not monthly quota-gated.
- Implement PayTR checkout token creation through a typed adapter.
- Implement hash-verified, idempotent PayTR webhook handling.
- Store payment events and subscription changes for audit.

### 14. Build Notifications And Email

- Implement in-app notifications first.
- Add Resend adapter with local stub first, real Resend later.
- Send transactional emails for profile decisions, manuscript decisions, intro request updates, and subscription updates.
- Verify Resend webhook signatures before processing delivery events.
- Do not email manuscript text, document chunks, signed URLs, raw PayTR payloads, or unreleased contact details.
- Keep Supabase Auth emails out of this adapter. Auth lifecycle emails are configured in Supabase custom SMTP, preferably with Resend SMTP on a dedicated auth sender such as `no-reply@auth.your-domain.com`.

### 15. Build Frontend Product Screens

- Public pages: home, pricing, login, signup, signup complete, auth callback, forgot password, terms, privacy, KVKK, cookies.
- App pages: dashboard, manuscripts, manuscript detail, matches, match detail, discover authors, discover publishers, requests, profile, billing, settings. Keep `/onboarding` only as a compatibility redirect until removed.
- Admin pages: dashboard, reviews, users, manuscripts, publishers, jobs, payments, audit logs, settings.
- Public pages should be SEO-oriented and prerendered while the authenticated app remains a SPA.
- Add a static health route or file for the web container and Cloud Run health checks.
- Use Browser/Playwright MCP for route inspection, screenshot checks, mobile/desktop layout validation, and authenticated flow smoke tests.

### 16. Wire Observability

- Add structured JSON logs with `timestamp`, `service`, `environment`, `request_id`, `user_id`, `job_id`, `event`, `status`, and `duration_ms`.
- Propagate `request_id` across frontend, API, Cloud Tasks, AI service, and database writes.
- Enable Sentry for frontend, API, and AI service with environment/release tags.
- Scrub manuscript text, document chunks, signed URLs, PayTR secrets, Resend secrets, service-role keys, and unreleased contact details.
- Track API latency/errors, onboarding completion, automated eligibility outcomes, exception-review time, upload failures, AI job failures, match latency, PayTR failures, Resend failures, quota denials, and intro acceptance.
- Use Sentry MCP after staging is configured to inspect issues, traces, releases, and alert quality without exposing sensitive payloads.

### 17. Build Infrastructure

- Terraform Cloud Run services for web, API, and private AI service.
- Add Artifact Registry repositories for container images.
- Add Cloud Tasks queues, GCS buckets, Secret Manager secrets, IAM, monitoring, DNS/domain mapping, and service accounts.
- Keep separate local, staging, and production configuration.
- Use Frankfurt-aligned GCP regions where service support allows.
- Configure Resend SPF, DKIM, and DMARC for the sender domain.
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

- Deploy infrastructure to staging.
- Run migrations and seeds.
- Build and push container images for web, API, and AI service to Artifact Registry.
- Deploy API, AI service, and frontend containers to Cloud Run.
- Wire real Sentry and Resend.
- Wire real GCS and Cloud Tasks.
- Wire PayTR sandbox/test credentials.
- Wire Vertex AI Vector Search when provider config is ready.
- Run smoke, integration, E2E, security, webhook replay, and AI eval checks.

### 22. Production Launch

- Configure production domain and Resend sender domain.
- Apply production infrastructure.
- Run migrations.
- Seed taxonomy and production plans.
- Bootstrap first admin through trusted server/admin path, keep staff accounts separate from marketplace profiles, and require MFA for protected admin routes.
- Promote or rebuild signed container images for API, AI service, and frontend.
- Deploy production containers to Cloud Run.
- Enable PayTR production credentials.
- Enable Sentry production alerts.
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
- Environment config must include public frontend config, server-only API secrets, AI service secrets, provider credentials, and per-environment URLs.
- Deployable services must expose health checks and run from environment-agnostic container images.
- MCP server credentials must be stored outside the repo in local MCP config, CI secrets, or the provider's approved credential store.
- MCP tools must not mutate production resources unless an explicit task calls for it and the change path is documented.

## Test Plan

- Unit tests:
  - matching/scoring
  - hard filters
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
  - locked contact detail denial before accepted intro
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
- `docs/architecture/observability.md`
- `docs/architecture/deployment-google-cloud.md`
