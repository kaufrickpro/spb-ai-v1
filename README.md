# Publisher-Author SaaS Marketplace

Minimal runnable scaffold for a V1 discovery-focused SaaS marketplace for authors and publishers in Türkiye.

The current goal is not a complete marketplace skeleton. It is a small, working foundation for the first vertical slice: authenticated signup and profile creation, inside a platform-shaped web experience that will grow into multiple user-facing functions.

## Current Stack

- `apps/web`: Vite + React + TypeScript, React Router, TanStack Query, Tailwind CSS, `react-i18next`
- `apps/api`: Fastify + TypeScript, strict mode, Zod config validation, shared contracts
- `apps/ai-service`: FastAPI + Pydantic, module boundaries for ingestion, retrieval, and matching
- `packages/contracts`: first-slice Zod contracts, route contracts, OpenAPI emission, typed path/client helpers, and inferred TypeScript types
- `packages/ui`: shared UI package, kept small until real duplication appears
- `supabase/migrations`: executable Supabase schema/RLS migrations
- `infra/terraform`: future Google Cloud infrastructure
- `docs/`: architecture, build plan, and operational notes

## Current Slice

Implemented now:

- Web app foundation with React Router, TanStack Query, and Turkish/English i18n.
- Public home route at `/` and shared logged-out header/navigation.
- Public auth entry pages for login, signup, social auth callback, and email confirmation.
- Three-step signup flow for email/password accounts: account, profile basics, and usage intent.
- Google auth entry points for signup/login, plus a short completion flow for social users who still need a marketplace profile.
- Basic `/app/profile` placeholder that shows the saved marketplace profile after signup.
- API health status panel backed by the shared contracts client.
- Fastify health routes: `GET /health`, `GET /ready`.
- Test-mode onboarding routes: `POST /api/v1/profiles`, `GET /api/v1/profiles/me`, and `POST /api/v1/profiles/me/onboarding-details`.
- Trusted first-admin bootstrap script at `npm run bootstrap:first-admin --workspace apps/api -- <email>`.
- Lean admin operations console at `/admin` with dedicated pages for reviews, trust/safety, jobs, payments, audit logs, and admin settings.
- Admin access is same-domain but separate from marketplace profiles: staff access is stored in `public.admin_users`, not `public.profiles`.
- Admin access is MFA-gated in the API and frontend. `GET /api/v1/admin/access` now returns an access status instead of a bare boolean.
- Admin review routes remain under `/api/v1/admin/*`, including `GET /api/v1/admin/reviews`, `GET /api/v1/admin/reviews/:reviewId`, `POST /api/v1/admin/reviews/:reviewId/decision`, and the read-only jobs/payments/trust/audit endpoints.
- Author-only manuscript workspace routes at `/app/manuscripts` and `/app/manuscripts/:id`.
- Manuscript metadata CRUD plus local sample upload/download flow through `GET/POST/PATCH /api/v1/manuscripts`, `POST /api/v1/uploads/signed-url`, `PUT /api/v1/uploads/local/:uploadToken`, `POST /api/v1/documents/:id/complete-upload`, and `GET /api/v1/documents/:id/download-url`.
- Local fake signed upload/download URLs backed by ignored `local-uploads/` storage in Step 8 local mode.
- Manuscript and document moderation records now feed the Step 7 admin console, and admin decisions update the linked lifecycle fields.
- Zod contracts for health, base profile creation requests, role-specific onboarding details, and profile responses.
- Supabase `profiles`, `author_profiles`, `publisher_profiles`, `manuscripts`, and `documents` migrations with owner/admin RLS, including signup metadata for photo URL and usage intent.
- AI service health routes and typed local/Vertex provider mode config.
- Root `npm run dev` command that starts web and API together.

Deferred until their vertical slices:

- Full Supabase Auth wiring.
- Real GCS-backed storage, AI ingestion, matching, billing, email, and production infrastructure.
- Full future-domain contracts for documents, matching, billing, admin, and email.

## Product Shell Direction

The product should be treated as one platform with multiple functions, not as a narrow onboarding-only flow.

- Keep a consistent top-level header across public pages and pre-onboarding authenticated flows.
- Logged-out header should carry brand, primary product sections, and clear `Giriş Yap` / `Kaydol` actions.
- Signup and profile completion should live inside the same overall site shell, even if the page body stays more focused and guided.
- After login, prefer evolving the right side of the header into authenticated actions instead of swapping to a completely different visual language.

## Prerequisites

- Node.js 20+ and npm 10+
- Python 3.11+
- Supabase CLI for the next local database/auth step
- `uv` for AI service dependency management
- Docker + Docker Compose later for integration workflows

## Quickstart

Install Node dependencies:

```sh
npm install
```

Copy local env examples:

```sh
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
cp apps/ai-service/.env.example apps/ai-service/.env
```

Start web and API:

```sh
npm run dev
```

Default local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

Run the AI service after installing Python dependencies:

```sh
cd apps/ai-service
uv sync --extra dev
uv run uvicorn app.main:app --reload
```

## Supabase Next Step

Set up local Supabase before building real auth/signup:

```sh
supabase start
supabase db reset
```

Then copy the local Supabase URL and anon key into:

- `apps/web/.env`
- `apps/api/.env`

Keep service-role credentials server-side only.

To test Google or Facebook locally, also add the corresponding provider credentials to the root `.env`, enable them in `supabase/config.toml`, and restart the local Supabase stack so the auth callback at `http://127.0.0.1:54321/auth/v1/callback` is active. The UI now only shows social buttons when the active Supabase project reports that the provider is enabled, and OAuth starts in no-redirect mode first so misconfigured providers fail inside the app instead of sending the browser away.

## OAuth Configuration

For the current hosted Supabase setup used by the frontend:

- local app URL: `http://localhost:5173`
- local app callback URL: `http://localhost:5173/auth/callback`
- hosted Supabase OAuth callback URL: `https://ipqmdjsxedffetotemil.supabase.co/auth/v1/callback`

Google Cloud Console should use:

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `https://ipqmdjsxedffetotemil.supabase.co/auth/v1/callback`

Supabase Auth URL Configuration should use:

- Site URL: `http://localhost:5173`
- Additional redirect URL: `http://localhost:5173/auth/callback`

## Supabase Auth Email SMTP

Email/password signup, password reset, and invite emails are sent by Supabase Auth, not by the app API. The default Supabase email sender is only for demos and has a very low project-wide rate limit, so configure custom SMTP before serious signup testing or production auth testing.

Preferred provider for this project: Resend SMTP.

1. Verify a dedicated auth sending domain in Resend, for example `auth.your-domain.com`.
2. Create a Resend API key named `supabase-auth-smtp`.
3. In Supabase Dashboard, open `Authentication` -> `Emails` -> `SMTP Settings`.
4. Enable custom SMTP and use:

```txt
Sender email: no-reply@auth.your-domain.com
Sender name: Publisher Author Marketplace
Host: smtp.resend.com
Port: 465
Username: resend
Password: <Resend API key>
```

5. Keep the Resend API key out of repo files, frontend env vars, logs, and screenshots.
6. After saving, test a fresh email/password signup and confirm the message appears in Resend email logs and has no Supabase Auth SMTP handoff error.

Supabase Auth emails may use Resend SMTP directly through Supabase. Product emails such as profile decisions, manuscript decisions, intro request updates, and subscription notices still belong to the later API-owned Resend adapter.

## Local Admin Flow

- Admin accounts are staff-only accounts and must not create marketplace profiles.
- Local development uses a repeatable seed command with known local-only credentials:

```sh
npm run admin:seed --workspace apps/api
```

- By default this creates or updates `admin@example.com` with password `local-admin-password`, grants `public.admin_users`, and sends you to `/admin/login`.
- The seed command refuses to run unless `APP_CONFIG_MODE=local`; local seeded admins bypass MFA for development only.
- Staging/production first-admin bootstrap still requires:
  - a real Supabase auth user
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `FIRST_ADMIN_EMAIL_ALLOWLIST`
- Bootstrap command:

```sh
npm run bootstrap:first-admin --workspace apps/api -- <email>
```

- After bootstrap, the staff user accepts the invite or uses password recovery, signs in through `/admin/login`, completes TOTP MFA at `/admin/mfa`, and reaches `/admin`.
- The marketplace `/login` route is for author and publisher accounts. Staff accounts are sent to `/admin/login`.
- The admin surface now distinguishes:
  - `no_access`
  - `mfa_required`
  - `allowed`
  - `revoked`
- MFA is required before protected admin routes become usable outside the local seed path.
- The admin workspace is intentionally lean for V1:
  - Dashboard
  - Reviews
  - Trust & Safety
  - Jobs
  - Payments
  - Audit Logs
  - Settings

## Production OAuth Checklist

Before a production build or production auth test, replace every localhost OAuth URL with the real public domain.

Required production changes:

- Set frontend base URLs and backend `WEB_APP_URL` to `https://your-domain`
- Change Supabase Auth `Site URL` to `https://your-domain`
- Change Supabase Auth allowed redirect URL to `https://your-domain/auth/callback`
- Change Google Cloud `Authorized JavaScript origin` to `https://your-domain`
- Change Google Cloud `Authorized redirect URI` only if the Supabase project changes. If production still uses the same hosted Supabase project, keep the callback at `https://ipqmdjsxedffetotemil.supabase.co/auth/v1/callback`

Important distinction:

- App callback URL changes between local and production
- Supabase provider callback URL is the Supabase project callback, not the app domain callback

Do not ship with:

- `http://localhost:5173` in Supabase URL Configuration
- `http://localhost:5173/auth/callback` in production redirect settings
- `http://localhost:5173` as a Google Authorized JavaScript origin

## Validation Commands

Root:

- `npm run check:harness`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run format:check`

Frontend:

- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web`
- `npm run build --workspace apps/web`

API:

- `npm run lint --workspace apps/api`
- `npm run typecheck --workspace apps/api`
- `npm run test --workspace apps/api`
- `npm run build --workspace apps/api`

Contracts:

- `npm run lint --workspace packages/contracts`
- `npm run typecheck --workspace packages/contracts`
- `npm run test --workspace packages/contracts`
- `npm run build --workspace packages/contracts`

AI service:

- `cd apps/ai-service && uv run ruff check .`
- `cd apps/ai-service && uv run mypy .`
- `cd apps/ai-service && uv run pytest`

Database and infrastructure, when configured:

- `supabase db lint`
- `supabase db reset`
- `terraform -chdir=infra/terraform fmt -check`
- `terraform -chdir=infra/terraform validate`

## MCP Tooling

MCP server setup and fallback guidance is documented in `docs/mcp-tooling.md`.

## Agent Harness

Agent entry instructions are intentionally short in `AGENTS.md`. Durable agent workflow, source-of-truth, documentation, and validation guidance lives in `docs/agent-harness.md`.

## Docker

Docker Compose is intentionally deferred. Daily local coding uses direct local commands first; Compose should be added when integration workflows need it.
