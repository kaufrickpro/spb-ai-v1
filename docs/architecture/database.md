# Database Architecture

## Summary

This document is the human-readable database source of truth for the publisher-author SaaS platform. The executable source of truth must live in Supabase SQL migrations under `supabase/migrations`.

The target V1 database supports:

- One account with exactly one role: author, publisher, or admin.
- Individual accounts only; no organizations, teams, or publisher imprints in v1.
- Multiple manuscripts per author.
- Publisher preference profiles for matching.
- Author-uploaded manuscript sample documents.
- Automated eligibility for clean users, manuscripts, and manuscript samples, with admin review reserved for exceptions and overrides.
- RAG-backed manuscript-to-publisher matching.
- Intro requests initiated by either side.
- Contact and sample-file unlock after an accepted intro request.
- PayTR subscription state, payment event audit, and monthly usage tracking.
- CSV publisher imports for testing and seed data only.

The current executable schema is a clean rebuild baseline. It includes the onboarding/profile slice, role-specific onboarding details, admin review/audit infrastructure, the Step 8 manuscript/document slice, and Step 9 ingestion storage foundations. Helper and privileged transition functions live in the private schema; public RPC wrappers exist only for intentional atomic transitions such as onboarding detail completion, document upload completion, and admin review decisions.

Out of scope for v1:

- Organization accounts.
- Publisher imprints.
- In-app chat.
- Marketplace payouts, contracts, escrow, royalties, or commission accounting.
- Public unclaimed publisher profiles from CSV imports.
- AI-generated fit reports, report jobs, PDF report exports, and Google ADK workflows.

## Implementation Location

Use this structure:

```txt
docs/architecture/database.md       # this design document
supabase/migrations/                # schema, constraints, indexes, triggers, RLS
supabase/seed.sql                   # starter genres, age categories, plans
scripts/seed/import-publishers.ts   # CSV import for test publisher data
packages/contracts/src/database.types.ts
```

Do not hand-edit generated Supabase types. Regenerate them from the live schema.

## Migration Strategy

Use narrow migrations that match the current vertical slice. The current clean rebuild migrations are:

```txt
supabase/migrations/20260504065904_baseline_step8_core.sql
supabase/migrations/20260504065907_step9_ingestion_foundation.sql
```

They create `public.profiles`, `public.author_profiles`, `public.publisher_profiles`, `public.admin_users`, `public.manuscripts`, `public.documents`, `public.admin_reviews`, `public.admin_audit_logs`, admin operations tables, `public.document_processing_jobs`, `public.document_chunks`, and `public.embedding_records`, plus supporting helper/trigger functions, constraints, indexes, and owner/admin RLS policies.

Step 9 reprocessing uses `public.replace_document_ingestion_outputs(...)` as a service-role-only RPC. It replaces one document's active `document_chunks` and chunk-scoped `embedding_records` in one database transaction, while preserving `public.document_processing_jobs` history and keeping original file bytes out of Postgres.

Do not create the full V1 schema upfront. Matching, intro requests, billing, and the broader discovery/runtime tables should still arrive in later vertical slices. Larger future domains may split schema and RLS into separate migrations when review clarity matters.

Every future schema change must be introduced with a new migration. Never make manual dashboard-only schema edits without backfilling a migration.

Supabase applies migrations by filename and does not replay an older migration
after it is recorded as applied. Editing an older migration can keep fresh
rebuilds accurate, but any schema change needed by an existing local, staging,
or production database must also be represented by a new forward migration. For
example, Step 9c keeps the earlier Step 9 job metadata migration accurate for
fresh rebuilds, while
`supabase/migrations/20260506120855_add_scanner_failed_processing_code.sql` is
the migration that existing remotes apply to accept `scanner_failed`.

## Extensions And Helpers

Enable:

Use `gen_random_uuid()` for primary keys.

Create a shared `set_updated_at()` trigger function and attach it to mutable tables:

- `profiles`
- `author_profiles`
- `publisher_profiles`
- `publisher_change_requests`
- `manuscripts`
- `documents`
- `intro_requests`
- `subscriptions`

Implemented helper functions:

- `private.is_admin()`: returns true when `auth.uid()` belongs to an active row in `public.admin_users`.
- `public.has_accepted_intro(manuscript_id uuid, publisher_id uuid)`: returns true when an accepted intro request exists for that manuscript and publisher.
- `public.current_profile_role()`: returns the current authenticated user's role.

Keep helper functions in the private schema when they do not need to be public RPCs, set a fixed `search_path`, and make them as small as possible.

## Enums

Create these enums:

```sql
user_role: author, publisher, admin
approval_status: pending, approved, rejected, suspended
manuscript_status: draft, submitted_for_review, approved, rejected, archived
document_type: manuscript_sample
processing_status: pending, processing, processed, failed
storage_status: uploaded, attached, pending_delete, deleted
embedding_source_type: manuscript, document_chunk, publisher_profile
match_direction: author_to_publisher, publisher_to_author
job_status: queued, running, succeeded, failed, cancelled
score_band: strong, moderate, weak
intro_request_status: pending, accepted, rejected, cancelled
notification_type: intro_requested, intro_accepted, intro_rejected, profile_approved, manuscript_approved, payment_updated
change_request_status: pending, approved, rejected
billing_period: monthly, annual
subscription_status: trialing, active, past_due, cancelled, expired
usage_type: intro_request_sent, upload_storage_bytes
review_target_type: profile, manuscript, document, publisher_change_request
eligibility_status: eligible, limited, blocked, quarantined
review_outcome: auto_approved, needs_review, admin_approved, admin_rejected, quarantined
```

The executable schema keeps older `approval_status` and `admin_review_status` fields as compatibility mirrors, but product behavior should use the split `eligibility_status` plus `review_outcome` model. New work must not add more manual-approval gate states.

## Core Identity

### `profiles`

Stores marketplace participant identity for author and publisher accounts.

Current implemented columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null unique references auth.users(id) on delete cascade`
- `role text not null check (role in ('author', 'publisher'))`
- `display_name text not null`
- `profile_photo_url text`
- `signup_intent text not null`
- `approval_status text not null default 'pending'` as a compatibility mirror
- `eligibility_status text not null default 'limited'`
- `review_outcome text not null default 'needs_review'`
- `locale text not null default 'tr'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Future profile/contact columns:

- `email text`
- `phone text`
- `website_url text`
- `social_links jsonb not null default '{}'::jsonb`
- `country text not null default 'TR'`
- `city text`
- `bio text`
- `approved_at timestamptz`
- `approved_by uuid references profiles(id)`

Rules:

- A normal user must choose exactly one role: `author` or `publisher`.
- Admin users must not be stored in `public.profiles`; they are tracked in `public.admin_users` through a trusted server-side/admin path.
- Profiles become discoverable automatically when profile checks pass and `eligibility_status = 'eligible'`.
- Profiles with `eligibility_status in ('limited', 'blocked', 'quarantined')` must not appear in discovery or matching.
- `review_outcome` records whether eligibility came from automation or an admin override.
- Contact fields are visible only to the owner, admins, or accepted intro counterparties.
- Profile rows are created through the Node API with a service-role Supabase
  client. Browser-authenticated users may update only ordinary owner profile
  fields; direct owner writes to `approval_status`, `eligibility_status`,
  `review_outcome`, or `eligibility_updated_at` are rejected by database guard
  rails so users cannot self-promote marketplace eligibility.
- Role-specific onboarding details and the profile eligibility transition are
  completed through one database RPC. If the eligibility update fails, the
  author/publisher detail upsert rolls back with it.

### `admin_users`

Stores trusted admin access separately from marketplace onboarding/profile state.

Current implemented columns:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `status text not null default 'active' check (status in ('active', 'revoked'))`
- `granted_by_user_id uuid references auth.users(id) on delete set null`
- `note text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- `public.admin_users` is mutually exclusive with `public.profiles` for the same `user_id`.
- Admin bootstrap and changes happen through trusted service-role paths only.
- Admin operational RLS checks should go through `private.is_admin()` instead of reading `public.profiles.role`.
- Authenticated application users need table-level `SELECT` on `public.admin_users` in addition to RLS so the API can verify whether the current JWT belongs to an active admin row.

Indexes:

- Current: `profiles_user_id_idx`, `profiles_role_idx`, `profiles_approval_status_idx`, `profiles_created_at_idx`
- Future: add compound discovery/contact indexes when those columns exist.

## Author Data

### `author_profiles`

Stores author-level metadata that is not specific to one manuscript.

Current implemented columns:

- `profile_id uuid primary key references profiles(id) on delete cascade`
- `biography text not null`
- `primary_genre text not null`
- `writing_languages text[] not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Future author detail columns:

- `pen_name text`
- `primary_genre_ids uuid[] not null default '{}'`
- `author_statement text`

Rules:

- `profile_id` must point to a profile with role `author`.
- Matching should primarily use manuscripts, not the author profile alone.

### `manuscripts`

Primary author-side metadata object in Step 8.

Current executable columns:

- `id uuid primary key default gen_random_uuid()`
- `author_id uuid not null references auth.users(id) on delete cascade`
- `title text not null`
- `genre text not null`
- `language text not null`
- `word_count integer`
- `synopsis text`
- `target_age_min integer`
- `target_age_max integer`
- `status text not null default 'draft'`
- `admin_review_status text not null default 'not_submitted'` as a compatibility mirror
- `eligibility_status text not null default 'limited'`
- `review_outcome text not null default 'needs_review'`
- `sample_document_id uuid references public.documents(id) on delete set null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- `author_id` is the authenticated author user id for the Step 8 slice.
- Manuscript records are author-owned and author-only in the Step 8 UI/API.
- Clean manuscript creation can become `eligible`/`auto_approved` automatically. Admin review rows are created only for exception outcomes.
- A manuscript becomes matching-eligible when the author profile, manuscript, active document, processing state, and entitlement checks all pass and the manuscript has `eligibility_status = 'eligible'`.

Indexes:

- `manuscripts(author_id)`
- `manuscripts(status)`
- `manuscripts(admin_review_status)`
- `manuscripts(created_at)`

## Publisher Data

### `publisher_profiles`

Stores publisher-side acquisition preferences. Publishers sign up themselves in v1.

Current implemented columns:

- `profile_id uuid primary key references profiles(id) on delete cascade`
- `focus_genres text[] not null`
- `preferred_languages text[] not null`
- `accepts_unsolicited boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Future publisher detail columns:

- `publisher_name text not null`
- `description text`
- `acquired_genre_ids uuid[] not null default '{}'`
- `excluded_genre_ids uuid[] not null default '{}'`
- `accepted_language_codes text[] not null default '{}'`
- `target_age_min integer`
- `target_age_max integer`
- `content_limits text`
- `submission_rules text`
- `accepted_formats text[] not null default '{}'`

Rules:

- `profile_id` must point to a profile with role `publisher`.
- Publisher profiles are discoverable when their profile has `eligibility_status = 'eligible'`.
- Publisher preference changes can be auto-approved when deterministic validation passes. Risky or uncertain changes become admin exceptions.

Indexes:

- `publisher_profiles(profile_id)`
- GIN indexes on `acquired_genre_ids`, `excluded_genre_ids`, and `accepted_language_codes`.

### `publisher_change_requests`

Stores publisher-requested edits. Clean changes can be auto-approved; risky or uncertain changes require admin review.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `publisher_id uuid not null references profiles(id) on delete cascade`
- `proposed_changes jsonb not null`
- `status change_request_status not null default 'pending'`
- `reviewed_by uuid references profiles(id)`
- `reviewed_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- Publisher can create change requests for their own profile.
- Automated checks can approve and apply clean changes.
- Admin can approve/reject/override exception changes.
- When accepted, server-side code applies `proposed_changes` to `publisher_profiles` and writes an audit log.

Indexes:

- `publisher_change_requests(publisher_id, status)`
- `publisher_change_requests(status, created_at desc)`

## Taxonomy

### `genres`

Controlled genre hierarchy for matching and filtering.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `parent_id uuid references genres(id)`
- `slug text unique not null`
- `name_tr text not null`
- `name_en text not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

Seed initial genres:

- `fiction`
- `literary-fiction`
- `romance`
- `thriller`
- `crime`
- `fantasy`
- `science-fiction`
- `horror`
- `historical-fiction`
- `children`
- `young-adult`
- `middle-grade`
- `picture-book`
- `non-fiction`
- `memoir`
- `biography`
- `history`
- `psychology`
- `business`
- `self-help`
- `academic`
- `poetry`

### `age_categories`

Controlled age bands for UI and filtering.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `slug text unique not null`
- `name_tr text not null`
- `name_en text not null`
- `min_age integer`
- `max_age integer`
- `created_at timestamptz not null default now()`

Seed initial categories:

- `children`
- `middle-grade`
- `young-adult`
- `adult`
- `all-ages`

## Documents And RAG Metadata

Only authors upload documents in v1. Documents are stored in private Google Cloud Storage. Postgres stores metadata, extracted text chunks, and vector index references.

### `documents`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `owner_id uuid not null references profiles(id) on delete cascade`
- `manuscript_id uuid not null references manuscripts(id) on delete cascade`
- `author_id uuid not null references auth.users(id) on delete cascade`
- `original_file_name text not null`
- `mime_type text not null`
- `file_size_bytes bigint not null`
- `upload_id text not null`
- `admin_review_status text not null default 'not_submitted'` as a compatibility mirror
- `eligibility_status text not null default 'limited'`
- `review_outcome text not null default 'needs_review'`
- `processing_status text not null default 'not_started'`
- `processing_failure_code text`
- `storage_status text not null default 'pending_upload'`
- `retention_expires_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- `author_id` must belong to the manuscript owner.
- Local development stores uploaded bytes under ignored local storage and uses short-lived fake signed URLs. Staging/production store uploaded bytes in private GCS and use API-issued short-lived signed URLs after authorization checks.
- Upload completion should queue asynchronous document checking through `document_processing_jobs`; it must not synchronously parse files inside the author request.
- Staging/production upload completion enqueues the durable `document_processing_jobs.id` to Cloud Tasks. The task payload is `{ job_id }` only; document bytes remain in private storage and service-role/GCS credentials stay server-side.
- Step 9 processing writes safe `processing_failure_code` values for user-facing recovery. Allowed values include `empty_extracted_text`, `unsupported_file_type`, `file_type_mismatch`, `extracted_text_too_large`, `chunk_limit_exceeded`, `download_failed`, `parser_failed`, `embedding_failed`, `scanner_suspicious`, `scanner_failed`, and `unexpected_processing_error`.
- Ordinary user-correctable failures such as empty text, unsupported file type during the text-only phase, too-large extracted text, or corrupt/unreadable files should not create default admin work.
- Suspicious scanner outcomes, quarantines, validation bypass signals such as file type mismatch, repeated system/provider failures such as exhausted `scanner_failed` retries, or unexpected runtime errors become admin exceptions.
- Successful Step 9 processing stores evidence for later eligibility. Step 10 owns full matching/discovery eligibility.
- Private file access is granted through signed URLs generated by the API.
- A publisher can access a manuscript sample only after an accepted intro request for that manuscript.

Indexes:

- `documents(manuscript_id)`
- `documents(author_id)`
- `documents(storage_status)`
- `documents(processing_status)`
- `documents(admin_review_status)`
- Unique partial index: `unique(manuscript_id) where storage_status = 'uploaded'`

### `document_chunks`

Stores extracted text for RAG citations and auditability.

Store bounded extracted chunks only. Do not store original file bytes or large vector arrays in Postgres. The active V1 representation is one chunk set per document; re-ingestion replaces active chunks and embedding records while preserving processing job history.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `document_id uuid not null references documents(id) on delete cascade`
- `chunk_index integer not null`
- `content text not null`
- `summary text`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Constraints:

- `unique(document_id, chunk_index)`

Indexes:

- `document_chunks(document_id, chunk_index)`

### `embedding_records`

Stores references to embeddings managed in Vertex AI Vector Search.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `source_type embedding_source_type not null`
- `source_id uuid not null`
- `vector_index_name text not null`
- `vector_datapoint_id text not null`
- `embedding_model text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Rules:

- Do not store large vector arrays in Postgres for v1.
- Use `source_type` and `source_id` to link back to manuscripts, chunks, or publisher profiles.
- Step 9 writes chunk-level embedding references only. Local/dev writes deterministic fake references; staging/production wires Vertex AI Vector Search behind config.

Indexes:

- `embedding_records(source_type, source_id)`
- `embedding_records(vector_index_name, vector_datapoint_id)`

### `document_processing_jobs`

Stores asynchronous ingestion attempts and retry state.

Additional Step 9 column:

- `metadata jsonb not null default '{}'::jsonb`

Rules:

- Use a versioned storage-aware `idempotency_key` so re-running the same document/upload/pipeline does not create duplicate jobs.
- Automatic retry attempts reuse the same row and increment `attempt_count`.
- Scanner metadata stored in `metadata` must be allowlisted and bounded. Safe scanner fields are `scanner`, `scanner_result`, `scanner_version`, `scanner_signature`, and `scanner_error_type`; do not store raw provider payloads, manuscript text, chunks, filenames, storage paths, signed URLs, author IDs, tokens, or service credentials.
- Manual admin retry UI is deferred. If added later, manual retry should create a new job row for audit clarity.
- `metadata` stores safe machine-readable details such as ingestion version, parser, chunker, scanner status, extracted character count, chunk count, failure code, and failure category.
- Persist safe classified errors only. Raw parser/provider exceptions belong in redacted logs or Sentry, not in author-facing fields.

## Matching

Match runs are unlimited from a billing-quota perspective but must be rate-limited by the API.

### `match_runs`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `requested_by uuid not null references profiles(id)`
- `manuscript_id uuid not null references manuscripts(id) on delete cascade`
- `direction match_direction not null`
- `status job_status not null default 'queued'`
- `idempotency_key text`
- `matching_algorithm_version text not null`
- `filter_version text not null`
- `embedding_model text not null`
- `started_at timestamptz`
- `completed_at timestamptz`
- `created_at timestamptz not null default now()`

Rules:

- Author-to-publisher runs are requested by the manuscript owner.
- Publisher-to-author runs are requested by a publisher against an eligible discoverable manuscript.
- All match runs are tied to a specific manuscript.

Indexes:

- `match_runs(requested_by, status, created_at desc)`
- `match_runs(manuscript_id, status, created_at desc)`
- Unique partial index on `idempotency_key` where `status in ('queued', 'running')`.

### `match_candidates`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `match_run_id uuid not null references match_runs(id) on delete cascade`
- `manuscript_id uuid not null references manuscripts(id) on delete cascade`
- `publisher_id uuid not null references profiles(id)`
- `score numeric not null`
- `score_band score_band not null`
- `fit_reasons text[] not null default '{}'`
- `risk_reasons text[] not null default '{}'`
- `shared_genre_ids uuid[] not null default '{}'`
- `source_snippets jsonb not null default '[]'::jsonb`
- `explanation_version text not null`
- `rank integer not null`
- `created_at timestamptz not null default now()`

Rules:

- Store explainability alongside every candidate.
- `publisher_id` must point to a publisher profile.
- Do not use subscription plan as a hidden relevance boost.

Indexes:

- `match_candidates(match_run_id, rank)`
- `match_candidates(manuscript_id, publisher_id, score desc)`
- `match_candidates(publisher_id, score desc)`

## Intro Requests And Contact Unlocks

There is no in-app chat in v1.

### `intro_requests`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `manuscript_id uuid not null references manuscripts(id) on delete cascade`
- `author_id uuid not null references profiles(id)`
- `publisher_id uuid not null references profiles(id)`
- `requested_by uuid not null references profiles(id)`
- `status intro_request_status not null default 'pending'`
- `message text`
- `responded_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Rules:

- Either the author or publisher can initiate.
- `author_id` must own the manuscript.
- `publisher_id` must be a publisher.
- Accepted intro requests unlock:
  - email,
  - phone,
  - website URL,
  - social links,
  - manuscript sample file for the publisher.
- Add a unique partial index to prevent duplicate pending requests for the same manuscript/publisher pair.

Indexes:

- `intro_requests(author_id, status, created_at desc)`
- `intro_requests(publisher_id, status, created_at desc)`
- `intro_requests(manuscript_id, publisher_id, status)`
- `unique(manuscript_id, publisher_id) where status = 'pending'`

### `notifications`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `recipient_id uuid not null references profiles(id) on delete cascade`
- `type notification_type not null`
- `payload jsonb not null default '{}'::jsonb`
- `read_at timestamptz`
- `created_at timestamptz not null default now()`

Indexes:

- `notifications(recipient_id, read_at, created_at desc)`

## Billing And Usage

### `plans`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `slug text unique not null`
- `name_tr text not null`
- `name_en text not null`
- `price_try_cents integer not null`
- `billing_period billing_period not null`
- `limits jsonb not null`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`

Seed starter plans:

- `free`
- `author-pro-monthly`
- `publisher-pro-monthly`
- `pilot-admin-comp`

Plan limits JSON should include:

- `intro_requests_per_month`
- `upload_storage_mb`
- `directory_visibility`

Match runs are rate-limited but not billed as monthly quota.

### `subscriptions`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `profile_id uuid not null references profiles(id) on delete cascade`
- `plan_id uuid not null references plans(id)`
- `status subscription_status not null`
- `paytr_customer_id text`
- `paytr_subscription_ref text`
- `current_period_start timestamptz`
- `current_period_end timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `subscriptions(profile_id, status)`
- `subscriptions(paytr_customer_id)`
- `subscriptions(paytr_subscription_ref)`

### `payment_events`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `profile_id uuid references profiles(id)`
- `subscription_id uuid references subscriptions(id)`
- `provider text not null default 'paytr'`
- `provider_event_id text unique`
- `event_type text not null`
- `payload jsonb not null`
- `hash_verified boolean not null default false`
- `processed_at timestamptz`
- `created_at timestamptz not null default now()`

Rules:

- Store every PayTR callback.
- Verify callback hash before mutating subscription state.
- Processing must be idempotent by `provider_event_id`.
- Never store card data.

Indexes:

- `payment_events(profile_id, created_at desc)`
- `payment_events(subscription_id, created_at desc)`
- `payment_events(provider, event_type, created_at desc)`

### `usage_ledger`

Append-only monthly usage events.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `profile_id uuid not null references profiles(id) on delete cascade`
- `subscription_id uuid references subscriptions(id)`
- `usage_type usage_type not null`
- `quantity integer not null default 1`
- `period_start date not null`
- `period_end date not null`
- `source_id uuid`
- `source_event_key text`
- `created_at timestamptz not null default now()`

Rules:

- Intro requests can add usage when sent.
- Storage usage can be tracked as bytes.
- Do not update existing usage rows; append corrections if needed.
- Use `source_event_key` or a scoped unique `source_id` to prevent duplicate quota consumption.

Indexes:

- `usage_ledger(profile_id, usage_type, period_start, period_end)`
- `usage_ledger(source_id)`
- `usage_ledger(source_event_key)`

## File Lifecycle

Document files move through explicit storage lifecycle states:

- uploaded
- attached
- pending_delete
- deleted

Implementation rules:

- GCS is private and is the binary source of truth.
- Postgres `documents` rows are the metadata and access-control source of truth.
- Rejected files receive a `retention_until` timestamp before deletion.
- Deleted files keep tombstone metadata needed for audit and KVKK fulfillment.
- A scheduled cleanup job deletes GCS objects for `pending_delete` documents after retention expires.
- Orphan uploads that were never attached to a manuscript are cleaned up on a short retention window.

Initial retention windows:

- Orphan uploads: 24 hours.
- Rejected manuscript samples: 30 days.
- User-requested file deletion: mark `pending_delete` immediately, delete GCS object within 7 days unless a legal/admin hold is applied.
- Audit tombstones: retain minimal non-content metadata for 2 years unless legal requirements change.

## Admin And Audit

### `admin_reviews`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `target_type review_target_type not null`
- `target_id uuid not null`
- `reviewer_id uuid references profiles(id)`
- `status approval_status not null`
- `notes text`
- `created_at timestamptz not null default now()`

Rules:

- Used for exception review, quarantine review, reports, and admin override history for profiles, manuscripts, documents, and publisher change requests.
- Auto-approved items should not create default queue work, but their automated outcome should remain audit-visible.
- Admin decisions must write required internal notes for rejection, quarantine, restore, suspend/hide, and other sensitive overrides.

Indexes:

- `admin_reviews(target_type, target_id, created_at desc)`
- `admin_reviews(reviewer_id, created_at desc)`

### `audit_logs`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `actor_id uuid references profiles(id)`
- `action text not null`
- `target_type text`
- `target_id uuid`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Rules:

- Write audit logs for automated eligibility outcomes, admin overrides, profile changes, billing mutations, document access grants, and admin actions.
- Do not store raw secrets or full PayTR sensitive payloads beyond what is operationally required.
- Sentry stores runtime exceptions, traces, and release-health context; Postgres audit logs remain the durable business/compliance record.

Indexes:

- `audit_logs(actor_id, created_at desc)`
- `audit_logs(target_type, target_id, created_at desc)`
- `audit_logs(action, created_at desc)`

## RLS Policy Plan

Enable RLS on every app table.

### Admin Access

Admins can read and update operational data.

Use `private.is_admin()` for admin policies.

### Profiles

Policies:

- Users can read their own full profile.
- Users can update limited fields on their own profile, but not `role`, eligibility/review outcome fields, `approved_at`, or `approved_by`.
- Eligible author and publisher profile summaries can be read for discovery, excluding locked contact details.
- Admins can read/update all profiles.

Contact detail unlock:

- Owner can read own contact details.
- Admins can read contact details.
- Opposite party can read contact details only when an accepted intro request exists.

If this is hard to express cleanly in table RLS, expose contact details through a secure RPC or server-side API endpoint instead of direct table reads.

### Author Data

Policies:

- Authors can manage their own `author_profiles`, `manuscripts`, and `documents`.
- Authors cannot directly set eligibility/review outcome fields on their own manuscripts or documents.
- Publishers can read eligible manuscript metadata only when the manuscript is discoverable through matching or accepted intro flow.
- Publishers can access sample document metadata and signed download only after an accepted intro request.
- Admins can read/update all author data.

### Publisher Data

Policies:

- Publishers can read their own full `publisher_profiles`.
- Eligible publisher profiles are readable by authors for discovery/matching.
- Publishers submit changes through `publisher_change_requests`.
- Automated checks or admins approve/reject and apply publisher changes.

### Matching

Policies:

- Authors can read match runs/candidates for their own manuscripts.
- Publishers can read match runs/candidates they requested.
- Admins can read all match data.
- Writes to `match_runs` and `match_candidates` should be through server-side API/service role paths, not direct browser writes.

### Intro Requests

Policies:

- Author and publisher participants can read intro requests involving them.
- Either participant can create a request when profile/manuscript eligibility checks pass.
- Only the request recipient can accept/reject.
- Admins can read all intro requests.

### Billing

Policies:

- Users can read their own subscription and usage summaries.
- Payment events are server/admin readable only.
- Subscription mutation happens only through server-side billing handlers.

## Seed Data

`supabase/seed.sql` should include:

- Genre taxonomy.
- Age categories.
- Starter plans.
- Optional local development admin user references only if compatible with local Supabase setup.

Publisher CSV seed data should not live in `seed.sql` unless it is small and stable. Prefer `scripts/seed/import-publishers.ts`.

## CSV Publisher Import

The CSV import script should:

- Read a source CSV provided by the project owner.
- Normalize source columns into the schema.
- Map genre names to `genres.slug`.
- Normalize languages to language codes such as `tr` and `en`.
- Normalize accepted formats to controlled text values.
- Create test `profiles` with role `publisher`.
- Create matching `publisher_profiles`.
- Mark seeded test publishers as approved only in local/dev environments.

The database schema should not be bent to fit the CSV. Transform the CSV to fit the database.

## Type Generation

Generate database types after migrations are applied:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/contracts/src/database.types.ts
```

For local development, use the local Supabase type generation flow when available.

Rules:

- Do not hand-edit `database.types.ts`.
- Import generated DB types in the API and frontend.
- Define public API payload contracts separately with Zod in `packages/contracts`. Keep contracts limited to the current vertical slice, with OpenAPI generated from those active route contracts.

## Acceptance Tests

Database implementation is not complete until these scenarios pass:

- A user cannot become both author and publisher.
- Limited, blocked, or quarantined profiles do not appear in discovery or matching.
- Authors can create multiple manuscripts.
- Authors can upload and manage only their own manuscript samples.
- A manuscript without an eligible processed sample is not eligible for full matching/discovery/intro actions.
- Publishers can read eligible publisher data and eligible manuscript metadata according to RLS/API rules.
- Accepted intro requests unlock contact details and sample-file access.
- Duplicate pending intro requests for the same manuscript/publisher pair are blocked.
- Match runs are rate-limited in the API but do not consume monthly quota.
- PayTR events are idempotent and stored with hash verification status.
- Publisher CSV data imports into normalized `profiles` and `publisher_profiles`.
- Automated eligibility transitions and admin override decisions write audit logs. Admin review decisions should continue to use a transaction/RPC pattern like `public.apply_admin_review_decision(...)` so review rows, target lifecycle fields, and audit logs change together. The RPC only applies decisions to pending review rows, and profile targets must still be in `limited`/`needs_review` state when decided.

## Open Implementation Notes

- Use API/service-role code for complex contact unlocks and signed file URLs. Do not rely on direct browser access for sensitive document downloads.
- Keep `profiles.email` synchronized with Supabase Auth at signup and email-change events.
- Consider creating read-only SQL views later for discovery cards if RLS policies become too complex on base tables.
- Consider adding full-text search indexes after the first UI search requirements are implemented.
