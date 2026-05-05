# Project Knowledge Base

## Purpose

This file is the local quick-reference knowledge base for the publisher-author SaaS marketplace. It summarizes the project intent, boundaries, architecture decisions, implementation rules, and unresolved questions. `AGENTS.md` is a short map; the detailed source of truth remains in `docs/architecture`, `docs/architecture/adr`, `docs/project-build-plan.md`, and `docs/agent-harness.md`.

## Current Status

- Last updated: 2026-05-04
- Current phase: Step 9 (AI Service Foundation) is starting from the ingestion job boundary. Step 8 upload remains the route surface; upload completion now feeds an async document checking flow instead of becoming a synchronous AI operation. Signup remains profile-first: users must complete the 3-step `/signup` wizard before a marketplace profile is created, and `/signup/complete` is only a compatibility redirect back to `/signup`.
- Recently fixed: user-scoped Supabase writes can no longer self-promote
  marketplace profile eligibility; profile creation and onboarding auto-approval
  now use trusted API service-role writes while owner RLS remains available for
  ordinary profile reads/updates.
- Recently changed: agent harness hardening moved long-lived instructions out of `AGENTS.md`, added `docs/agent-harness.md`, added `npm run check:harness`, and added a GitHub Actions CI workflow for TypeScript workspace checks plus AI service `uv` checks.
- Recently decided: remove the standalone onboarding journey from the active product flow. `/onboarding*` now exists only as a compatibility redirect to `/app/profile`.
- Recently decided: keep admin creation entirely outside the public UI, managed in Supabase/SQL through `public.admin_users`.
- Recently changed files: Supabase migrations were collapsed into `20260504065904_baseline_step8_core.sql` and `20260504065907_step9_ingestion_foundation.sql`; admin review creation now uses service-role paths; first-admin bootstrap can invite a missing Auth user before adding `public.admin_users`; and database docs were updated for the clean rebuild.
- Recently fixed: Google auth is again visible on login/signup, while misconfigured providers now fail inside the app instead of redirecting the browser to a confusing external page.
- Recently fixed: email/password users who complete the 3-step signup and confirm email now have the saved signup draft converted into a marketplace profile on `/auth/callback`, instead of being sent through the duplicate 2-step `/signup/complete` flow.
- Recently changed: the active `/signup/complete` page was removed; no-profile authenticated sessions now return to the main 3-step signup wizard, and social signup can no longer bypass the profile setup fields.
- Recently fixed: `/signup` no longer renders a blank page for authenticated sessions while admin/profile lookups are pending; `GuestGuard` now lets the signup wizard render immediately and leaves completed/admin redirects to `SignupPage`.
- Recently changed: `public.profiles.onboarding_status` was removed from the schema and API contract; signup completion is now represented by having a marketplace profile, with richer author/publisher details stored in role-specific tables.
- Recently fixed: auth docs now include an explicit production OAuth checklist so the team remembers to replace `http://localhost:5173` app URLs with the real domain before production auth testing.
- Recently fixed: `/app/profile` no longer treats missing author/publisher detail rows as a server error; basic post-signup profiles can load with `details: null` until richer onboarding is completed.
- Recently fixed: role-specific onboarding detail completion now uses one
  database RPC so the detail upsert and profile eligibility transition commit
  or roll back together.
- Recently finalized: V1 admin is now a lean same-domain exception and override console under `/admin` with needs-review, quarantine, reports, system failures, jobs, payments, audit logs, and settings.
- Recently decided: the product should use a fully automated happy path. Automated checks can make profiles, manuscripts, documents, discovery, matching, and intro requests eligible without manual admin approval when deterministic safety, validity, entitlement, and ingestion gates pass.
- Recently decided: admin review is no longer the default marketplace gate. Admin handles exceptions, uncertain/high-risk automated outcomes, reports, quarantines, system failures, and audited overrides.
- Recently decided: future schema work should split product availability from moderation explanation with `eligibility_status` (`eligible`, `limited`, `blocked`, `quarantined`) and `review_outcome` (`auto_approved`, `needs_review`, `admin_approved`, `admin_rejected`, `quarantined`) for profiles, manuscripts, and documents. Publisher change requests use the same outcome idea for the pending request while live publisher profiles keep their current eligible state.
- Recently finalized: admin access is still separate from marketplace profiles through `public.admin_users`, but the API/frontend now distinguish `no_access`, `mfa_required`, `allowed`, and `revoked` admin states.
- Recently decided: local dev admin setup uses a local-only seed command with known credentials and MFA bypass; staging/production use trusted invite/password recovery through `/admin/login` and require TOTP through `/admin/mfa`.
- Recently finalized: admin routes require MFA-satisfied sessions before protected admin pages or mutations can be used, except the local seeded admin path guarded by `APP_CONFIG_MODE=local` and `public.admin_users.note = 'local_admin_seed'`.
- Recently finalized: manuscript routes are author-only in the UI and API, local upload/download URLs are short-lived and tokenized, and clean manuscript/document creation now uses automated eligibility instead of creating default admin review work.
- Recently decided: Supabase Auth lifecycle emails must use custom SMTP, preferably Resend SMTP on a dedicated auth sender, before serious email/password signup testing or production auth testing. These auth emails are separate from the later API-owned product email adapter.
- Recently decided for Step 9: local may fake providers but must preserve production architecture. The browser calls the Node API, upload completion creates an idempotent `document_processing_jobs` row, and an internal AI service/worker processes the document asynchronously.
- Recently decided for Step 9: production stores private manuscript files in GCS while Supabase stores metadata, processing jobs, chunks, embedding references, audit data, and admin exceptions. Local development uses local storage and fake signed URLs as GCS-shaped adapters.
- Recently decided for Step 9: first ingestion implementation supports `text/plain` only, with PDF/DOCX/EPUB deferred behind parser interfaces. It uses deterministic paragraph-aware chunking, bounded Postgres chunks, and reference-only fake embedding records locally.
- Recently decided for Step 9: staging and production use Cloud Tasks plus private Cloud Run IAM/OIDC for AI service calls; local/dev uses a local processor and `AI_INTERNAL_TOKEN`; tests may use inline fakes where needed.
- Recently decided for Step 9: ordinary user-correctable file failures do not create admin work. Admin exceptions are reserved for suspicious scanner outcomes, quarantine, validation bypass signals, repeated system/provider failures, and unexpected runtime errors.
- Recently decided for Step 9: author UI must use simple language such as "Checking your sample", "Sample ready", and "We couldn't read this file"; do not expose ingestion, chunking, embedding, parser, job, GCS, Cloud Tasks, or provider terminology to users.
- Recently fixed: local signed upload targets now reject stale completed document tokens and enforce the pending document state, declared content type, declared byte size, and 25 MB limit before storing bytes.
- Recently fixed: replacement sample uploads no longer deactivate the current uploaded sample when only a signed URL is requested; the previous sample moves to `pending_delete` only after the replacement upload completes successfully.
- Recently fixed: the legacy admin profile decision endpoint now resolves a pending profile review and routes through the audited admin review decision workflow; repeated or non-pending profile decisions are rejected.
- Recently fixed: public auth callbacks and signup now keep staff identities out of marketplace flows; staff sessions that hit `/auth/callback` are signed out and sent to `/admin/login?reason=staff`, while `/signup` redirects `allowed`, `mfa_required`, and `revoked` staff states away from the wizard.
- Recently fixed: dashboard, admin feeds, legal routes, match/discovery placeholder routes, manuscript sample loading states, and upload controls now distinguish loading/error/empty states instead of rendering misleading fallbacks.
- Next recommended step: finish the Step 9 docs-first implementation, then implement the ingestion API/worker flow against `document_processing_jobs`, `document_chunks`, and `embedding_records` without reworking the Step 8 route surface.
- Known blockers: real GCS bucket configuration, ingestion worker plumbing, product name/domain, production prices and quotas, embedding model choice, account deletion flow, Resend auth SMTP sender/domain, Resend product email sender domain/from-address, Sentry alert routing, final production OAuth domain values, and remote GitHub branch protection are still open.

## Product Snapshot

The product is a bilingual Turkish/English SaaS marketplace for authors and publishers in Türkiye. Authors create profiles, add manuscript metadata, upload sample files, and request publisher matches. Publishers define acquisition preferences and discover eligible manuscripts through controlled discovery and matching flows.

V1 is discovery-only:

- No contracts.
- No escrow.
- No marketplace payouts.
- No royalties or commission accounting.
- No organization accounts, teams, publisher imprints, or in-app chat.
- No direct contact exposure until an intro request is accepted.

Core value:

- Structured author and publisher profiles.
- Document-aware RAG matching.
- Explainable fit and risk reasons.
- Request-based introductions.
- Subscription-gated intro requests, upload storage, directory visibility, and support level.
- Deterministic match detail views based on stored match explanations.

## Primary Users

- Authors: create profiles, manage manuscripts, upload sample documents, run publisher matching, send intro requests, and view match details.
- Publishers: create acquisition preference profiles, discover eligible manuscripts, send or receive intro requests, and view match details.
- Admins: review profiles, manuscripts, documents, publisher changes, jobs, payment events, and audit logs.

## System Architecture

Planned monorepo layout:

```txt
apps/web              Vite + React SPA using React Router, TanStack Query, Tailwind, i18n, and shadcn/ui patterns
apps/api              Fastify + Node.js TypeScript API
apps/ai-service       FastAPI AI service managed with uv
packages/contracts    First-slice Zod contracts, route contracts, OpenAPI emission, and inferred types
packages/ui           Shared app-level UI components, kept small until duplication appears
supabase/migrations   Schema, RLS, indexes, seed fixtures
infra/terraform       Google Cloud infrastructure
scripts/seed          Seed/import utilities
docs/architecture     Architecture docs and ADRs
```

Runtime flow:

```txt
Browser
  -> React SPA
  -> Node API on Cloud Run
      -> Supabase Auth/Postgres
      -> Google Cloud Storage signed upload/download URLs
      -> Cloud Tasks queues
      -> PayTR checkout/callback flows
      -> Resend transactional email
      -> FastAPI AI service on private Cloud Run
          -> document extraction/chunking
          -> Vertex AI embeddings and Vector Search
      -> Sentry error and performance telemetry
```

## Accepted Architecture Decisions

- Build minimal runnable vertical slices before broad production-shaped skeletons.
- First vertical slice is authenticated signup/profile creation.
- Use npm workspaces for TypeScript packages.
- Use `uv` for the Python AI service.
- Use Fastify for `apps/api`.
- Use Vite + React + React Router + TanStack Query for `apps/web`.
- Use Zod contracts-first in `packages/contracts`; keep the current package limited to health and signup/profile flows until the next vertical slice needs more.
- Supabase Auth and Postgres are the identity and application data platform.
- The frontend uses Supabase Auth for sessions, then sends access tokens to the Fastify API.
- Supabase Auth sends auth lifecycle emails through custom SMTP; Resend SMTP is the preferred provider for signup confirmation, password reset, invites, and future OTP/magic-link emails.
- Public social auth currently ships with Google only.
- Node.js TypeScript API and FastAPI AI service are separate services.
- Vertex AI Vector Search stores vector indexes; Postgres stores relational records and vector metadata.
- PayTR powers Türkiye SaaS subscriptions only.
- Sentry handles application error monitoring, tracing, release health, and source-map-backed debugging.
- Resend handles transactional product email from trusted server paths only.
- Staging and production deploy through container images on Google Cloud Run.

## Product Rules To Preserve

- Launch language support is Turkish and English.
- Every normal user has exactly one role: author or publisher.
- Admin creation must happen through a trusted process.
- Profiles, manuscripts, and documents can become eligible automatically when required checks pass.
- Manuscripts need valid metadata, an eligible processed sample document, successful ingestion, and `eligibility_status = 'eligible'` before full discovery, matching, and intro request actions.
- Manual admin review is reserved for `needs_review`, `quarantined`, reported, failed, or staff-overridden items.
- Intro requests are request-based; contact details and manuscript samples unlock only after acceptance.
- Paid plans must not secretly boost relevance scores.
- Match runs are rate-limited for abuse prevention, not monthly subscription-quota gated.
- Intro request quota is consumed when the request is sent.

## Locked Risk Decisions

- Auth: Supabase Auth handles sessions; the Node API owns app profiles, signup/profile completion, role selection, eligibility/review state, and first-admin bootstrap.
- First admin: create through an idempotent trusted script with service-role credentials and configured email allowlist.
- Admin identity: store admin access in `public.admin_users`, not `public.profiles`, so admin accounts do not enter marketplace signup/profile completion.
- RLS: write acceptance tests for owner access, cross-user denial, discovery hiding, accepted-intro unlocks, admin access, and payment-event protection.
- Discovery: V1 filters are role/type, eligibility status, genre, language, target age, city/country, accepts unsolicited, processing status, and created date.
- Matching auditability: store `matching_algorithm_version`, `filter_version`, `embedding_model`, and `explanation_version`.
- Idempotency: use provider event IDs, unique pending intro constraints, match request keys, document processing state, and usage source event keys.
- Quotas: consume quota transactionally with the action that creates usage.
- Files: use explicit lifecycle states, retention timestamps, tombstones, and scheduled cleanup for orphan/deleted GCS objects.
- Admins: V1 has one admin role, but code should use helper functions and access-status helpers so future admin scopes are possible.
- Admin operations: default queues show exceptions only. Auto-approved items stay searchable, auditable, metric-visible, and linkable from reports/audit logs, but they do not create default staff work.
- Admin UI gating: admin API routes must remain server-enforced, and admin frontend routes/navigation must also be explicitly gated client-side so non-admin users cannot enter or see admin surfaces.
- Admin auth: separate staff accounts only. Do not allow the same identity to become both a marketplace participant and an admin.
- Admin MFA: an admin membership alone is not sufficient for protected admin routes; the current session must also satisfy MFA.
- Config: all services validate typed config at startup and fail fast on missing values or mismatched provider modes. The API config no longer requires `supabaseJwtSecret`; Supabase mode only requires `supabaseUrl` (used to derive the JWKS endpoint).
- JWT verification: use JWKS (`jose` library) in the API auth middleware, not the legacy symmetric JWT secret. Require issuer `${SUPABASE_URL}/auth/v1` and audience `authenticated`.
- OAuth deployment rule: app callback URLs are environment-specific. Development uses `http://localhost:5173/auth/callback`; production must switch to `https://your-domain/auth/callback` in frontend config, backend config, and Supabase Auth URL Configuration before release testing.
- AI limits: start with 25 MB files, 250,000 extracted characters, 300 chunks, 25 candidates, 5-minute ingestion timeout, and 60-second matching timeout.
- Rate limits: start with 10 match runs per user/hour, 3 match runs per manuscript/hour, 20 upload signed URLs per user/hour, 10 intro requests per user/day, and 10 auth-sensitive attempts per IP/10 minutes.
- Retention: orphan uploads 24 hours, rejected samples 30 days, requested file deletion within 7 days, audit tombstones 2 years.
- Redaction: logging and Sentry sanitization must be centralized and tested with sensitive fixtures.
- Prerendering: only public static pages are prerendered; authenticated and user-specific pages stay client-rendered.
- CI/CD: PR, staging, and production gates are mandatory before launch.

## Frontend Knowledge

Frontend should feel like a focused SaaS workspace: calm, dense, readable, and useful for repeated operations.

The product shell should still read as one multi-function platform, not as a disconnected set of auth and onboarding screens.

Primary route groups:

- Public: `/`, `/features`, `/pricing`, `/publishers`, `/authors`, `/editorial`, `/works`, `/login`, `/signup`, `/auth/callback`, `/forgot-password`, `/terms`, `/privacy`, `/kvkk`, `/cookies`
- App: `/onboarding` (compatibility redirect), `/app/dashboard`, `/app/manuscripts`, `/app/matches`, `/app/matches/:matchRunId/candidates/:candidateId`, `/app/discover/authors`, `/app/discover/publishers`, `/app/requests`, `/app/profile`, `/app/billing`, `/app/settings`
- Admin: `/admin`, `/admin/reviews`, `/admin/trust-safety`, `/admin/jobs`, `/admin/payments`, `/admin/audit-logs`, `/admin/settings`

UX rules:

- Use shadcn/ui and Tailwind consistently.
- Use route-independent i18n keys from the start.
- Keep business logic out of React components.
- Keep a consistent top-level header across public pages and pre-profile-completion authenticated pages.
- Prefer tables, filters, tabs, dialogs, forms, and dense detail pages.
- Avoid decorative UI that reduces scannability.
- Do not expose raw contact details until accepted intro unlock.
- Do not put Resend API keys or server email logic in the frontend.
- Configure Sentry with environment/release tags and scrub sensitive fields.

Code organization rule:

- Keep package entrypoints like `src/index.ts` as re-export barrels only. Implement contracts, clients, UI pieces, and service logic in small domain-specific modules.

Match cards must show:

- score band
- fit reasons
- risk or mismatch reasons
- shared genres
- source snippets
- intro CTA
- match detail CTA

## Admin Dashboard Knowledge

The admin area should be a lean operations console, not a marketing or analytics landing page.

Recommended dashboard sections:

- Exception queue summary: needs review, quarantine, reports, and system failures.
- Automation health: auto-approval rate, ingestion success rate, match generation success, and false-positive proxy metrics from reports/overrides.
- Risk hotlist: newest and highest-risk exceptions that need action.
- System health: ingestion, match runs, Cloud Tasks failures, PayTR callbacks, failed hash verification, subscriptions, payment events, and email delivery failures.
- Audit trail: latest admin overrides and high-risk automated decisions.

Recommended admin routes:

```txt
/admin
/admin/reviews
/admin/trust-safety
/admin/jobs
/admin/payments
/admin/audit-logs
/admin/settings
```

Useful admin pattern:

- A review detail drawer that shows entity summary, submitted fields, risk warnings, eligibility status, review outcome, related jobs/events, audit history, and safe override actions.

## API Knowledge

The Node API is the trusted product backend. The browser must not call Supabase service-role APIs, Google privileged APIs, PayTR secrets, Resend APIs, or the AI service directly.

Use:

- REST under `/api/v1`.
- Fastify route modules and app factories for testability.
- TypeScript strict mode.
- Zod contracts from `packages/contracts`.
- Consistent JSON errors.
- Supabase Auth JWTs for end-user auth, verified in the API using JWKS (not the legacy JWT secret). JWKS endpoint: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Use the `jose` library (`createRemoteJWKSet` + `jwtVerify`) in the auth middleware, requiring issuer `${SUPABASE_URL}/auth/v1` and audience `authenticated`.
- Service-role Supabase access only inside trusted server code.

Shared contract layer status:

- `packages/contracts/src/index.ts` is a re-export barrel.
- Common IDs, role/status enums, error envelope, and health response live in `common.ts`.
- Profile/onboarding schemas live in `profiles.ts`.
- First-slice route contracts live in `routes.ts`; typed path building and response-validating client helpers live in `client.ts`.
- OpenAPI document emission lives in `openapi.ts`; `npm run build --workspace packages/contracts` compiles the package and regenerates `packages/contracts/openapi.json`.
- Contract tests cover the error envelope, health payloads, no client-created admin profiles, profile response validation, first-slice route contracts, typed API client request/response validation, and OpenAPI path emission.

Important modules:

- auth
- profiles
- manuscripts
- documents
- matching
- intro-requests
- billing
- admin
- notifications

Important libraries:

- supabase
- paytr
- resend
- sentry
- cloud-tasks
- storage
- ai-service

Idempotency is required for:

- PayTR callbacks.
- Resend event handling where tied to product state.
- Cloud Task handlers.
- document ingestion starts.
- match generation.
- usage ledger writes.

## AI And RAG Knowledge

The AI service owns ingestion, chunking, embeddings, retrieval, and matching. The browser never calls it directly.

Runtime readiness is app-factory based: `create_app(...)` loads typed config and attaches a runtime Adapter. `/health` reports process health, while `/ready` reports whether the configured local or Vertex runtime Adapter can accept work.

Document ingestion supports first:

- digital PDF
- DOCX
- EPUB
- text files

OCR/Document AI is deferred unless explicitly requested.

Matching flow:

1. Validate manuscript and publisher eligibility.
2. Retrieve candidate publishers from Vertex AI Vector Search.
3. Apply hard filters for genre, excluded genres, language, target age, accepted formats, and structured content limits.
4. Re-rank with business rules.
5. Generate fit reasons, risk reasons, source snippets, and score band.
6. Store match runs and candidates.

Persist version metadata on match outputs:

- matching algorithm version
- filter version
- embedding model
- explanation version

Match details must include:

- score band
- strong fit reasons
- weak fit or mismatch reasons
- shared genres
- source snippets
- publisher preference context
- manuscript metadata comparison

AI-generated fit reports, report agents, PDF exports, and Google ADK workflows are deferred to V1.5.

## Data Knowledge

Core data domains:

- individual author, publisher, and admin profiles
- author and publisher profile details
- manuscripts
- documents, chunks, and embedding records
- match runs and match candidates
- saved matches and intro requests
- plans, subscriptions, payment events, and usage ledger
- admin reviews and audit logs
- notifications

RLS is mandatory for all client-accessible tables.

Every migration must consider:

- Row Level Security.
- Indexes for `user_id`, `profile_id`, `status`, and timestamp columns.
- Auditability for sensitive actions.
- KVKK deletion/export requirements.

The executable database source of truth must live in `supabase/migrations`.

Current implemented database migrations:

- `supabase/migrations/20260504065904_baseline_step8_core.sql` rebuilds marketplace profiles, admin access, role details, manuscripts, documents, reviews, audit logs, and admin operation tables.
- `supabase/migrations/20260504065907_step9_ingestion_foundation.sql` adds document processing jobs, chunks, and embedding references.
- Admin helpers now live in the private schema, with `public.apply_admin_review_decision(...)` kept as the intentional authenticated RPC.
- Defer matching, intro requests, and billing tables until their vertical slices.

## Billing Knowledge

PayTR is used for SaaS subscriptions only.

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

Never store card data. PayTR callbacks must be hash-verified, stored for audit, idempotent, and replay-safe.

Quota-consuming actions must be transactionally written with usage ledger rows. Usage rows need a source event key or equivalent uniqueness guard to prevent duplicate consumption.

## Email Knowledge

Resend is used for transactional email only.

Initial email events:

- profile eligibility/exception decision
- manuscript eligibility/exception decision
- intro request received
- intro request accepted or rejected
- payment/subscription update

Email rules:

- Send from the API or trusted async workers.
- Browser must never call Resend directly.
- Verify Resend webhook signatures before processing delivery events.
- Use Turkish and English templates.
- Do not include full manuscript text, document chunks, signed URLs, raw PayTR payloads, or unreleased contact details.
- Prefer emails that bring users back into the authenticated app for sensitive details.

## Observability Knowledge

Use Google Cloud Logging/Monitoring for platform logs, service metrics, uptime checks, and infrastructure alerts.

Use Sentry for:

- frontend route/render errors
- API route errors
- unhandled exceptions
- failed Cloud Task handlers
- AI service ingestion/matching failures
- PayTR callback processing failures after redaction
- Resend email/webhook failures after redaction
- release health and performance tracing

Never log or capture:

- PayTR secrets
- Supabase service-role keys
- Resend API keys or webhook secrets
- Sentry auth tokens
- full manuscript text
- document chunks
- signed URLs
- raw card/payment sensitive data
- unreleased contact details

Propagate `request_id` across frontend, API, Cloud Tasks, AI service, and database writes.

## Container Knowledge

Containers are required for staging and production because Cloud Run deploys container images. They are recommended for CI and integration testing, but daily local development can use direct commands like `npm run dev` and `uv run uvicorn app.main:app --reload` for faster feedback.

Container usage levels:

- Production: immutable images for `apps/web`, `apps/api`, and `apps/ai-service`, published to Artifact Registry and deployed to Cloud Run.
- CI: build, test, scan, tag, and push the same images that will be deployed.
- Local development: optional Docker Compose for onboarding and integration tests; direct local commands remain supported.

Container rules:

- Add one production Dockerfile per deployable service.
- Use multi-stage builds to keep runtime images small.
- Run as non-root users where practical.
- Do not bake secrets, `.env` files, service account keys, local credentials, manuscripts, or private source maps into images.
- Keep images environment-agnostic and inject runtime config through environment variables and Secret Manager.
- Add `.dockerignore` files to exclude dependencies, build outputs, caches, credentials, local uploads, and test artifacts.
- Expose health checks: API `/health` and `/ready`, AI service `/health` and `/ready`, and a static web health route or file.
- Tag images with git SHA, service name, and release/environment identifiers.
- Align Sentry release names with deployed image versions.

## MCP Tooling Knowledge

MCP servers are agent/developer tooling only. They are not production runtime dependencies and are not deployed with the app.

Expected MCP servers:

- Context7 MCP for current framework and provider documentation.
- Supabase MCP for schema, RLS, migration, and generated type inspection.
- GitHub MCP for issues, PRs, CI status, review context, and releases after the repo is hosted.
- Browser/Playwright MCP for UI verification, screenshots, responsive checks, and authenticated smoke tests.
- Sentry MCP for issue, trace, release, and alert inspection after Sentry is configured.
- Google Cloud MCP, where available, for read-only inspection of Cloud Run, Cloud Tasks, GCS, Secret Manager, IAM, logs, and monitoring.

Provider notes:

- PayTR does not require a dedicated MCP server; use official docs, typed adapters, webhook fixtures, and tests.
- Resend does not require a dedicated MCP server unless a reliable one becomes available; use official docs, typed adapters, webhook fixtures, and tests.
- Vertex AI can use Google Cloud MCP for inspection, but Terraform, Google Cloud SDK, and typed service adapters remain the executable integration path.

MCP security:

- Store MCP credentials outside the repo.
- Prefer read-only MCP access for production resources.
- Do not expose manuscript text, document chunks, signed URLs, raw payment payloads, or unreleased contact details through MCP prompts or tool calls.

## Security And Compliance Knowledge

Sensitive data:

- contact details
- manuscript samples
- document chunks
- signed URLs
- payment events
- secrets and service keys

File lifecycle:

- uploaded
- attached
- approved
- rejected
- archived
- pending_delete
- deleted

Rejected and deleted files keep tombstone metadata for audit/KVKK and are cleaned from GCS by scheduled cleanup after retention expires.

Initial retention windows:

- orphan uploads: 24 hours
- rejected samples: 30 days
- user-requested file deletion: within 7 days unless legal/admin hold applies
- audit tombstones: 2 years

Security posture:

- Default-deny RLS.
- Private GCS buckets.
- Short-lived signed URLs from the API.
- Least-privilege IAM.
- No service-role keys in frontend code.
- Secrets in Google Secret Manager or local ignored env files.
- Admin actions must write audit logs.
- Build KVKK support for consent, privacy, cookies, retention, export, and deletion.

## TDD And Validation Knowledge

Use TDD for behavior changes, bug fixes, and security- or billing-sensitive logic:

1. Write or update a failing test.
2. Implement the smallest passing change.
3. Refactor after relevant tests pass.

Do not skip tests for:

- matching/scoring
- quota enforcement
- PayTR hash validation
- Resend webhook verification
- RLS/security-sensitive behavior
- signed URL access

Expected validation commands are listed in `AGENTS.md`.

Also validate container-related changes with:

- container image builds for `apps/web`, `apps/api`, and `apps/ai-service`
- Docker Compose integration smoke tests when compose or Dockerfiles change
- image scanning in CI before pushing to Artifact Registry
- MCP smoke checks before tasks that depend on MCP tooling

## Junior-Friendly Development Knowledge

Use a workflow that makes mistakes cheap and visible:

- Work in small vertical slices: schema/contract, API, UI, tests, then polish.
- Keep one branch focused on one behavior or screen.
- Start behavior changes with a failing test when practical.
- Run the narrowest relevant validation command before broader checks.
- Prefer typed contracts, enums, schemas, and helper functions over copied strings.
- Keep business logic out of React components; use hooks/clients for data fetching and API/service modules for product rules.
- Use local stubs first for PayTR, Resend, GCS, Cloud Tasks, Sentry, and Vertex AI.
- Write setup notes when something is confusing; promote repeated notes into `docs/`.
- Add empty, loading, error, and permission-denied states during the first implementation.
- Do not commit secrets, real credentials, generated local files, logs, or uploaded manuscripts.
- When stuck, reduce the issue to one failing test, one route, one component, or one database policy.
- Before opening a PR, include what changed, how it was tested, screenshots for UI changes, and skipped checks.
- Prefer readable code over clever abstractions; add abstractions only after duplication is obvious and stable.

Blessed local development path:

1. Install dependencies.
2. Copy env examples.
3. Start web and API with `npm run dev`.
4. Connect Cloud Supabase before real auth work.
5. Apply migrations in Supabase Studio.
6. Start AI service separately with `uv run uvicorn app.main:app --reload` when touching AI code.
7. Run smoke tests.

## Design System Direction

Recommended direction: Editorial Operations Workspace.

The UI should combine:

- publishing/editorial concepts: manuscripts, genres, language, age range, synopsis, source snippets
- SaaS operations patterns: tables, filters, statuses, quotas, audit logs
- AI trust patterns: explainability, citations, risks, confidence bands
- marketplace patterns: profiles, requests, unlocks, saved matches

Build the design system around:

- layout shell
- navigation
- filter bars
- data tables
- status badges
- score band badges
- quota meters
- profile summaries
- manuscript cards
- match candidate cards
- source snippets
- intro request dialogs
- match detail panels
- admin review panels
- audit log tables

## Deferred To V1.5

- AI-generated fit reports.
- Report jobs and report admin screens.
- PDF report exports.
- Google ADK report workflows.
- Report quotas and report-ready emails.

## Open Questions

- What is the product name and domain?
- Should Turkish be the default UI language?
- Should public pages prioritize SEO or remain SPA-rendered for launch?
- What are the first production subscription prices and quota limits?
- Which embedding model should be used for Turkish and English content?
- Should users be able to delete accounts themselves in v1, or request deletion through support?
- What sender domain and from-address should Resend use?
- Do you want Sentry alerts routed to Slack/email, or Google Cloud console alerts only?

## Source Documents

- `AGENTS.md`
- `docs/project-build-plan.md`
- `docs/mcp-tooling.md`
- `docs/architecture/overview.md`
- `docs/architecture/frontend.md`
- `docs/architecture/api.md`
- `docs/architecture/database.md`
- `docs/architecture/ai-rag-pipeline.md`
- `docs/architecture/auth-security-rls.md`
- `docs/architecture/payments-paytr.md`
- `docs/architecture/observability.md`
- `docs/architecture/deployment-google-cloud.md`
- `docs/architecture/adr`
