# Admin Operations Runbook

## Summary

V1 admin stays inside the main product under `/admin`, but it is treated as a separate internal operations surface. Admins are staff-only identities stored in `public.admin_users`, not marketplace profiles.

The admin product model is automation-first. Clean profiles, manuscripts, documents, publisher changes, matching, discovery, and intro-request actions should move through the happy path automatically when deterministic checks pass. Admin work is the exception path for uncertain, risky, failed, reported, quarantined, or staff-overridden items.

For Step 9 ingestion, keep admin interference minimal. The system should automatically check uploaded samples and surface only actionable exceptions to staff. Authors should see simple recovery guidance for ordinary file problems and should correct those problems by replacing the sample.

## Operating Model

Automated checks produce three operational outcomes:

- `auto_approved`: the item passed required validity, safety, entitlement, and ingestion gates and can become product-eligible without manual staff approval.
- `needs_review`: the item is not clean enough for automatic eligibility, but it is not a hard block. Admins decide whether to approve, reject, quarantine, or leave it pending.
- `quarantined`: the item is blocked for severe or hard-failure signals such as malware, invalid file abuse, dangerous content, or security-sensitive behavior.

Product behavior is controlled separately from the moderation explanation:

- `eligibility_status`: `eligible`, `limited`, `blocked`, or `quarantined`.
- `review_outcome`: `auto_approved`, `needs_review`, `admin_approved`, `admin_rejected`, or `quarantined`.

Use this split for profiles, manuscripts, and documents. Publisher change requests use the same outcome model for the pending request; the already-live publisher profile keeps its previous eligible state until changes are accepted.

Auto-approved items do not appear in default admin queues. They remain searchable, visible in metrics, linked from reports/audit logs, and available for investigation.

## Admin Queues

The default admin dashboard should focus on exceptions:

- Needs Review: profiles, manuscripts, documents, or publisher change requests that automated checks could not safely approve.
- Quarantine: blocked documents/accounts/content that need staff or security action.
- Reports: user or staff reports about abuse, suspicious profiles, bad matches, payment concerns, or platform misuse.
- System Failures: ingestion, matching, PayTR, Resend, Cloud Tasks, quota, and idempotency failures that need retry or investigation.

The admin review queue API is bounded by default and rejects oversized limits.
Filters must be preserved while applying the bound, and queue ordering must stay
deterministic so staff do not see duplicate or drifting rows during repeated
refreshes.

Step 9 ingestion queue policy:

- Do not create admin exceptions for ordinary user-correctable file problems: empty extracted text, unsupported file type during the text-only phase, too-large extracted text, or corrupt/unreadable files.
- Create admin exceptions for suspicious scanner outcomes, quarantines, validation bypass signals such as file type mismatch, repeated system/provider failures after automatic retries, or unexpected runtime errors. These exception records must store only safe operational fields such as failure code, attempt counts, scanner result, job id, MIME type, and file size; never store manuscript text, signed URLs, private storage paths, or extracted chunks.
- Admin job health should show ingestion job state from `document_processing_jobs` without requiring staff to babysit normal queued/running work.
- Manual admin retry UI is deferred for the first Step 9 implementation. Automatic retries should handle transient failures where idempotency allows it.

Dashboard sections:

- Exception queue summary: needs review, quarantine, reports, and system failures.
- Automation health: auto-approval rate, ingestion success rate, match generation success, and false-positive proxy metrics from reports/overrides.
- Risk hotlist: newest and highest-risk exceptions requiring action.
- System health: failed jobs, PayTR/webhook failures, email delivery failures, and Cloud Tasks failures.
- Audit trail: latest admin overrides and high-risk automated decisions.

## Admin Actions

V1 admin actions should use a small safe verb set:

- approve a `needs_review` item
- reject a `needs_review` item with a required internal note
- quarantine an item
- restore from quarantine when safe
- suspend or hide an already eligible item
- resolve a report without changing the underlying entity
- retry failed system jobs where idempotency allows it

Admins do not directly edit user-submitted marketplace data in V1. Users correct marketplace data by editing and resubmitting. Admin notes are internal-only and should not be copied into user-facing notification text.

For document ingestion, user-facing language must stay non-technical. Do not expose terms such as ingestion, chunking, embeddings, parser, job, provider, GCS, Cloud Tasks, or pipeline to authors. Admin surfaces may use operational terms when they help staff diagnose system failures.

Destructive document cleanup should use tombstone and retention workflows. Immediate hard deletion belongs in an emergency runbook, not the default UI.

## Sentry And Audit Boundary

Sentry handles application exceptions, traces, release health, and user-impact debugging for the frontend, API, and AI service. Link Sentry issue IDs or event IDs from operational notes when helpful, but do not depend on Sentry as the durable audit ledger.

Postgres audit logs are the durable source for business decisions: automated eligibility outcomes, admin overrides, role/admin changes, document access grants, billing mutations, and sensitive product events.

## Admin Lifecycle

Local development and deployed environments intentionally use different admin
onboarding flows.

### Local development

Use a local-only seed command for repeatable developer access:

```sh
npm run admin:seed --workspace apps/api
```

The command must run only with `APP_CONFIG_MODE=local`. It creates or updates a
known local staff Auth user, grants `public.admin_users` access with a
`local_admin_seed` note, and prints the `/admin/login` URL plus the local-only
credentials. Local seeded admins may bypass MFA so normal development and smoke
testing do not depend on TOTP setup.

### Staging and production

1. Add the email to `FIRST_ADMIN_EMAIL_ALLOWLIST` if bootstrapping the first admin.
2. If the staff user does not exist in Supabase Auth, the bootstrap script invites the user by email.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is available in the API environment.
4. Run:

```sh
npm run bootstrap:first-admin --workspace apps/api -- <email>
```

5. The staff user accepts the invite or uses password recovery from the staff login page.
6. The staff user signs in at `/admin/login`.
7. The session must satisfy TOTP MFA at `/admin/mfa` before protected admin routes become usable.

The marketplace `/login` route is for authors and publishers. If a staff account
uses it by mistake, the app signs the user out and sends them to `/admin/login`
with a clear message. Admin access is never requested or created through public
UI.

## Admin Access States

- `no_access`: no matching `public.admin_users` membership.
- `mfa_required`: active admin membership exists, but the session has not satisfied MFA.
- `allowed`: active admin membership and MFA-satisfied session.
- `revoked`: the account has an admin row, but the row is no longer active.

## Emergency Actions

### Revoke a compromised admin

- Mark the `public.admin_users.status` row as revoked.
- Force the user to sign out from Supabase if your operational tooling supports it.
- Review `/admin/audit-logs` for suspicious activity.

### Verify MFA readiness

- Ask the staff user to sign in through `/admin/login` and open `/admin`.
- The admin access endpoint should report `allowed`.
- If the UI sends the user to `/admin/mfa`, the staff account has not satisfied MFA for that session.

### Incident review

- Start in `/admin/audit-logs`.
- Review related moderation decisions in `/admin/reviews`.
- Check `/admin/trust-safety`, `/admin/jobs`, `/admin/payments`, and linked Sentry issues/traces for adjacent signals.
