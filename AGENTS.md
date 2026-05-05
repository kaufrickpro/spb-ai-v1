# AGENTS.md

This file is the agent map for the publisher-author SaaS marketplace. Keep it short. Durable product, architecture, security, and workflow rules live in `docs/`.

## Start Here

At the start of each new chat, read the project docs that match the task:

- Current state and next step: `docs/project-knowledge-base.md`
- Build sequence and slice boundaries: `docs/project-build-plan.md`
- Agent harness rules: `docs/agent-harness.md`
- Architecture overview: `docs/architecture/overview.md`
- API rules: `docs/architecture/api.md`
- Frontend rules: `docs/architecture/frontend.md`
- Auth, admin access, and RLS: `docs/architecture/auth-security-rls.md`
- Database and migrations: `docs/architecture/database.md`
- Admin operations: `docs/architecture/admin-operations.md`
- AI and RAG: `docs/architecture/ai-rag-pipeline.md`
- Payments: `docs/architecture/payments-paytr.md`
- Observability: `docs/architecture/observability.md`
- Deployment: `docs/architecture/deployment-google-cloud.md`
- ADR index: `docs/architecture/adr/README.md`
- MCP/tooling setup: `docs/mcp-tooling.md`

## Project Boundary

This is a Google Cloud native SaaS marketplace for publishers and authors in Türkiye. V1 is discovery-only.

Do not implement contracts, escrow, marketplace payouts, royalties, commission accounting, organization accounts, teams, publisher imprints, in-app chat, AI-generated fit reports, report jobs, PDF report exports, or Google ADK workflows unless explicitly requested.

## Current Architecture

- `apps/web`: Vite, React, TypeScript, React Router, TanStack Query, Tailwind CSS, shadcn/ui patterns, and route-independent i18n keys.
- `apps/api`: Fastify and strict TypeScript for auth enforcement, product APIs, uploads, admin, subscriptions, PayTR, and orchestration.
- `apps/ai-service`: FastAPI and Pydantic for ingestion, embeddings, retrieval, and matching. Use `uv`.
- `packages/contracts`: Zod contracts, route contracts, OpenAPI emission, typed path/client helpers, and inferred types.
- `packages/ui`: small shared UI package. Add only when duplication is real.
- `supabase/migrations`: schema, RLS policies, indexes, and seed fixtures.
- `infra/terraform`: Cloud Run, IAM, Cloud Tasks, GCS, Secret Manager, DNS, and monitoring.
- `docs/architecture`: source-of-truth architecture docs and ADRs.

## Non-Negotiables

- Build minimal runnable vertical slices before broad production skeletons.
- Supabase Auth handles sessions. The Node API owns app profiles, signup/profile completion, role selection, approval state, and first-admin bootstrap.
- The frontend may use Supabase Auth directly, then sends the access token to the Fastify API.
- Service-role Supabase keys, PayTR secrets, Resend keys, Sentry auth tokens, and Google service account keys must never reach frontend code or committed files.
- Admin users are staff-only and stored separately from marketplace profiles in `public.admin_users`.
- Admin surfaces must be guarded both server-side and client-side, with negative tests for bug fixes.
- Private document files require signed URLs, type validation, size limits, access checks, lifecycle states, retention timestamps, tombstones, and cleanup.
- PayTR is for SaaS subscriptions only. Never store card data.
- Resend is for transactional email only. Never email manuscript text, signed URLs, PayTR-sensitive payloads, or unreleased contact details.
- Matching must be explainable and auditable. Paid plans must not secretly boost relevance scores.
- Quota-consuming actions must be transactional and idempotent.

## Workflow

- Inspect existing files before editing.
- Keep changes scoped to the requested work.
- Use TDD for behavior changes, bug fixes, and security- or billing-sensitive logic.
- Run the narrowest relevant validation before finishing.
- Before finishing, explicitly label completion as fully implemented, partially implemented, scaffolded only, or blocked. If anything is not end-to-end complete, say what remains.
- Update the appropriate docs after finishing a step.
- Use `rg` or `rg --files` for search.
- Use `apply_patch` for manual edits.
- Do not overwrite user changes or run destructive git commands unless explicitly requested.

## Validation

Use the narrowest command that validates the change:

- Root TypeScript workspaces: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run format:check`
- Harness consistency: `npm run check:harness`
- Frontend: `npm run test --workspace apps/web`, `npm run build --workspace apps/web`
- API: `npm run test --workspace apps/api`, `npm run build --workspace apps/api`
- Contracts: `npm run test --workspace packages/contracts`, `npm run build --workspace packages/contracts`
- AI service: `cd apps/ai-service && uv run ruff check .`, `cd apps/ai-service && uv run mypy .`, `cd apps/ai-service && uv run pytest`
- Database: `supabase db lint`, `supabase db reset` when safe
- Terraform: `terraform -chdir=infra/terraform fmt -check`, `terraform -chdir=infra/terraform validate`

If a command cannot be run because setup is missing, report the gap instead of inventing a substitute.
