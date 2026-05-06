# Supabase Migrations

SQL migration files in this directory are the executable database source of truth.

## Current Migration Set

- `20260504065904_baseline_step8_core.sql`: rebuilds the Step 8 schema from scratch with marketplace profiles, staff-only admins, role detail tables, manuscripts, documents, admin reviews, audit logs, and admin operations tables. Helper and trigger functions live in the private schema with pinned `search_path`; only the intentional public review-decision RPC remains exposed.
- `20260504065907_step9_ingestion_foundation.sql`: adds the Step 9 ingestion foundation: document processing jobs, document chunks, and external embedding references. Worker writes are service-role-only until the ingestion API slice lands.
- `20260504135804_remove_profile_onboarding_status.sql`: removes the obsolete `public.profiles.onboarding_status` column now that signup completion is represented by profile existence and role-specific detail rows.
- `20260504153409_admin_exception_console.sql`: extends admin review rows for exception queues, eligibility/review outcomes, risk signals, and the canonical audited review-decision RPC.
- `20260504191327_step9_job_metadata.sql`: adds Step 9 processing metadata and safe failure codes so local/dev and staging/production share the same async document-checking vocabulary.
- `20260505175711_complete_replacement_upload_atomically.sql`: makes sample replacement attach atomically so the existing uploaded sample is not deactivated until the replacement upload completes.
- `20260505182640_lock_profile_eligibility_columns.sql`: prevents user-scoped profile writes from changing marketplace eligibility/review state.
- `20260505182714_complete_profile_onboarding_details_atomically.sql`: commits role-specific onboarding details and profile eligibility transitions in one RPC.
- `20260505182851_constrain_admin_review_decisions_to_pending.sql`: constrains the audited review-decision RPC to pending review rows and pending profile lifecycle state.
- `20260505183011_complete_upload_queues_ingestion_job_atomically.sql`: updates upload completion so the trusted server RPC creates or reuses the ingestion job before attaching the uploaded document.
- `20260505210114_document_processing_admin_exception_policy.sql`: adds the document processing admin exception policy for suspicious scanner results, quarantine, validation bypass signals, repeated system/provider failures, and unexpected runtime errors.
- `20260506091532_step9_replace_document_ingestion_outputs.sql`: adds the service-role-only ingestion output replacement RPC for one active chunk/reference set per document.
- `20260506120855_add_scanner_failed_processing_code.sql`: adds `scanner_failed` to `documents.processing_failure_code` for already-applied databases.

## Application Guidance

This migration set intentionally replaces the earlier drifted migration history.
Rebuild local first, then rebuild the linked remote database so Supabase migration
history contains only these baseline versions.

Do not make dashboard-only schema edits. Add a migration first.

## Forward-Only Remote Apply

Supabase records applied migration filenames. Editing an older migration file is
useful only for fresh local or remote rebuilds from an empty database. It does
not update an already-applied remote database.

For a database that has already applied `20260504191327_step9_job_metadata.sql`,
the real remote change for `scanner_failed` is
`20260506120855_add_scanner_failed_processing_code.sql`. Apply that new
forward migration with the normal deployment flow, such as `npx supabase db push`,
or run that migration SQL in Supabase Studio if the environment is still being
managed manually.

After schema changes, run:

- `npx supabase migration list`
- `npx supabase db lint`
- `npx supabase db advisors`
