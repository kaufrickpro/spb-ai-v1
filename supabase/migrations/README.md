# Supabase Migrations

SQL migration files in this directory are the executable database source of truth.

## Current Migration Set

- `20260504065904_baseline_step8_core.sql`: rebuilds the Step 8 schema from scratch with marketplace profiles, staff-only admins, role detail tables, manuscripts, documents, admin reviews, audit logs, and admin operations tables. Helper and trigger functions live in the private schema with pinned `search_path`; only the intentional public review-decision RPC remains exposed.
- `20260504065907_step9_ingestion_foundation.sql`: adds the Step 9 ingestion foundation: document processing jobs, document chunks, and external embedding references. Worker writes are service-role-only until the ingestion API slice lands.
- `20260504135804_remove_profile_onboarding_status.sql`: removes the obsolete `public.profiles.onboarding_status` column now that signup completion is represented by profile existence and role-specific detail rows.
- `20260504153409_admin_exception_console.sql`: extends admin review rows for exception queues, eligibility/review outcomes, risk signals, and the canonical audited review-decision RPC.
- `20260504191327_step9_job_metadata.sql`: adds Step 9 processing metadata and safe failure codes so local/dev and staging/production share the same async document-checking vocabulary.
- `20260505182851_constrain_admin_review_decisions_to_pending.sql`: constrains the audited review-decision RPC to pending review rows and pending profile lifecycle state.
- `20260505183011_complete_upload_queues_ingestion_job_atomically.sql`: updates upload completion so the trusted server RPC creates or reuses the ingestion job before attaching the uploaded document.

## Application Guidance

This migration set intentionally replaces the earlier drifted migration history.
Rebuild local first, then rebuild the linked remote database so Supabase migration
history contains only these baseline versions.

Do not make dashboard-only schema edits. Add a migration first.

After schema changes, run:

- `npx supabase migration list`
- `npx supabase db lint`
- `npx supabase db advisors`
