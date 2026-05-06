# Architecture Overview

## Product Summary

Smart Publishing Bridge is a bilingual Turkish/English SaaS marketplace for authors and publishers in Türkiye. Authors upload manuscript metadata and sample files. Publishers define acquisition preferences. The platform uses RAG-backed matching to recommend publishers for manuscripts and lets either side send an intro request. After an intro request is accepted, contact details and the manuscript sample are unlocked.

V1 is discovery-only. Do not implement contracts, escrow, royalties, commission accounting, organization accounts, publisher imprints, in-app chat, AI-generated fit reports, report jobs, PDF report exports, or Google ADK workflows.

## System Components

- `apps/web`: Vite + React single page application using React Router, TanStack Query, Tailwind CSS, route-independent i18n, and shadcn/ui patterns.
- `apps/api`: Fastify + Node.js TypeScript API for auth-aware product operations, PayTR, Resend email, signed uploads, subscriptions, admin, and job orchestration.
- `apps/ai-service`: FastAPI service for ingestion, text extraction, chunking, embeddings, and matching. Python dependencies are managed with `uv`.
- `packages/contracts`: first-slice Zod contracts, route contracts, OpenAPI emission, typed path/client helpers, and inferred TypeScript types.
- `supabase`: Auth, Postgres schema, migrations, RLS, and seed data.
- `infra/terraform`: Google Cloud infrastructure as code.
- `scripts/seed`: local and test data import scripts.

## Runtime Architecture

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

## V1 User Flows

- Author signs up, chooses author role, completes author profile, creates manuscript, uploads sample, and gets automated eligibility checks.
- Publisher signs up, chooses publisher role, completes acquisition preferences, and gets automated eligibility checks.
- Author runs publisher matching for an eligible processed manuscript.
- Publisher discovers eligible manuscripts through allowed matching/discovery flows.
- Either side sends an intro request tied to one manuscript and one publisher.
- Accepted intro request unlocks contact details and manuscript sample access.
- Admin handles exceptions, quarantines, reports, overrides, payment events, and AI/system jobs.

## Source Of Truth

- Architecture intent: `docs/architecture`.
- Database implementation: `supabase/migrations`.
- Shared API shapes: `packages/contracts`.
- Cloud infrastructure: `infra/terraform`.
- Service implementation: `apps/web`, `apps/api`, `apps/ai-service`.

## Current Scaffold Status

- Minimal runnable scaffold is in place.
- Web and API start together with `npm run dev`.
- API exposes `GET /health`, `GET /ready`, and test-mode `POST /api/v1/profiles`.
- Supabase has the first `profiles` migration with owner RLS.
- Next step is Cloud Supabase Auth/Postgres setup and real authenticated onboarding/profile persistence.

## Non-Goals For V1

- No direct messaging.
- No multi-seat publisher accounts.
- No publisher imprints.
- No marketplace payouts.
- No author-to-author or publisher-to-publisher networking.
- No unclaimed public publisher directory from CSV data.
- No AI-generated fit reports, report jobs, PDF report exports, or Google ADK workflows in V1.

## Open Questions

- Should public pages be SEO-heavy enough to justify SSR later, or is SPA-only acceptable for launch?
- What are the first production subscription prices and quota limits?
- Which admin users should exist at launch?
