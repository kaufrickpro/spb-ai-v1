# Auth, Security, And RLS Architecture

## Summary

Supabase Auth is the identity provider. Supabase Postgres Row Level Security protects client-accessible data. The Node API handles privileged operations, signed file URLs, PayTR secrets, Resend email sending, Cloud Tasks, and admin workflows.

## Identity Model

- `auth.users` stores authentication identities.
- `public.profiles` stores marketplace participants only: `author` or `publisher`.
- `public.admin_users` stores trusted admin access separately from onboarding/profile data.
- Every user has one account role: `author`, `publisher`, or `admin`.
- Normal users choose author or publisher during the 3-step signup wizard before marketplace profile creation.
- Admin creation must be done through a trusted process.

Auth ownership:

- The browser may use Supabase Auth for email/password signup, Google social auth, login, session refresh, and password reset.
- The Node API owns marketplace profile creation, saved signup intent, onboarding completion, eligibility state, automated review outcomes, and admin bootstrapping.
- Client-side code must not directly insert or update privileged profile fields.
- Admin access must be granted through trusted Supabase or SQL operations against `public.admin_users`, not through any public UI path.
- Admin accounts must not complete the public onboarding flow or create `public.profiles` rows.
- Admin accounts are separate staff identities. V1 does not support one identity being both a marketplace participant and an admin.
- Staff users sign in through `/admin/login`. The marketplace `/login` route is for author and publisher accounts and redirects staff accounts to the staff entry point.
- Admin sessions must satisfy TOTP MFA before protected admin routes are usable in staging and production. Membership alone is not enough.
- Local development may seed a known local-only admin account with `public.admin_users.note = 'local_admin_seed'`; only this local seeded admin path may bypass MFA, and only when `APP_CONFIG_MODE=local`.

## Auth Email Delivery

Supabase Auth owns auth lifecycle emails:

- signup confirmation
- password reset
- magic link or OTP email if enabled later
- invite email from Supabase Auth admin flows

These emails must use Supabase custom SMTP before serious signup testing or production auth testing. The default Supabase sender is only for demos and has a very low project-wide rate limit.

Preferred SMTP provider:

- Resend SMTP
- host: `smtp.resend.com`
- port: `465`
- username: `resend`
- sender: `no-reply@auth.your-domain.com` or the environment-specific verified auth sender

Rules:

- Use a dedicated auth sending domain or subdomain, separate from marketing email.
- Keep the Resend API key only in Supabase SMTP settings or secret storage; never expose it in frontend env vars or committed files.
- Keep Supabase Auth templates focused on auth actions only. Do not include manuscript text, document chunks, signed URLs, raw PayTR payloads, unreleased contact details, or other sensitive product data.
- Product notifications still belong to the Node API's Resend adapter when the notifications slice is implemented.
- Product UI should not mention Supabase by name. Developer docs, CLI output, and runbooks may mention Supabase Auth when explaining invite, SMTP, and password recovery behavior.

OAuth environment rule:

- The app callback URL is environment-specific and must switch from `http://localhost:5173/auth/callback` in development to `https://your-domain/auth/callback` in production.
- Supabase Auth `Site URL` and allowed redirect URLs must follow the same environment-specific app domain.
- Provider callbacks such as Google should continue to point to the Supabase project callback URL, for example `https://ipqmdjsxedffetotemil.supabase.co/auth/v1/callback`, unless the Supabase project itself changes.

## Eligibility And Review Model

V1 uses an automation-first eligibility model. Manual admin review is not the default gate for marketplace value.

Automated checks can mark profiles, manuscripts, documents, discovery, matching, and intro request flows eligible when required validity, safety, entitlement, and ingestion gates pass.

Use two related concepts:

- `eligibility_status`: controls product behavior. Allowed values are `eligible`, `limited`, `blocked`, and `quarantined`.
- `review_outcome`: explains how the item reached that state. Allowed values are `auto_approved`, `needs_review`, `admin_approved`, `admin_rejected`, and `quarantined`.

Profiles, manuscripts, and documents use both concepts. Publisher change requests use the review outcome concept for the pending change; the existing live publisher profile remains eligible or limited based on its current state until the change is accepted.

Manual admin review is required only for:

- `needs_review` automated outcomes
- quarantined items
- reports
- failed ingestion/matching/payment/email/system jobs that need human action
- staff overrides of previously eligible or blocked items

Items in `needs_review` remain limited. Users can keep safe workspace access, but marketplace exposure and intro actions wait until the issue is cleared. Quarantined documents or accounts are blocked from user preview, matching, discovery, and download access except for admin/security review paths.

## Contact Unlock

Contact details are sensitive:

- email
- phone
- website URL
- social links

They are visible to:

- the owner
- admins
- the accepted intro counterparty

For implementation simplicity and safety, expose unlocked contact details through the Node API instead of direct browser table reads if RLS becomes complex.

## File Access

Manuscript samples live in private Google Cloud Storage.

Access rules:

- author owner can access own files
- admins can access for review
- publisher can access sample only after accepted intro request
- In Step 8 local mode, upload/download URLs are short-lived tokenized API URLs backed by ignored local storage. They are public signed targets, not bearer-authenticated API calls.

The browser should receive short-lived signed URLs from the Node API. Do not make GCS buckets public.

## RLS Principles

- Enable RLS on all app tables.
- Default deny unless policy explicitly grants access.
- Users can read/update own non-sensitive profile fields.
- Admins can access operational tables.
- Server-side service-role code handles privileged mutations.
- Payment events are not browser-readable.
- Audit logs are admin-only.
- Manuscript workspace routes and navigation must stay author-only in the frontend, even though the API/RLS remain the real enforcement.

RLS acceptance tests are required before exposing client-readable tables:

- owner can read/update allowed own fields
- cross-user profile/document access is denied
- limited, blocked, or quarantined profiles/manuscripts are hidden from discovery
- accepted intro unlocks only the intended contact/sample access
- admin access works only for active `public.admin_users` rows
- admin access state is distinguished as `no_access`, `mfa_required`, `allowed`, or `revoked`
- payment events remain server/admin-only

## Secrets

Never commit:

- Supabase service-role key
- PayTR merchant key or salt
- Resend API keys and webhook secrets
- Sentry auth tokens
- Google service account keys
- production database URLs
- private webhook secrets

Sentry DSNs can be present in frontend configuration when required by the SDK, but Sentry auth tokens and private project configuration must stay server-side or in CI secrets.

Use:

- local ignored env files for development
- Google Secret Manager for deployed services

## Compliance Notes

Build for KVKK expectations:

- clear consent capture
- privacy policy
- cookie policy
- data export/delete workflow
- retention policy for manuscript files
- audit logs for sensitive admin actions

## Admin Boundaries

V1 has one admin role in the product UI, but code should route admin checks through helper functions instead of scattering role comparisons. Today that means `private.is_admin()` backed by `public.admin_users`, which keeps future reviewer/billing/super-admin scopes possible without rewriting every admin route.

V1 admin remains same-domain under `/admin`, but it is treated as a separate security boundary:

- dedicated `public.admin_users` membership
- dedicated `/admin/login` staff entry point with email/password only
- `/admin/mfa` for TOTP enrollment and verification
- server-enforced `/api/v1/admin/*` authorization
- MFA-gated admin session access
- mandatory audit logging for admin mutations
- required rejection or decision notes for sensitive moderation actions

Admin audit logs are the durable record for product decisions and overrides. Sentry handles runtime exceptions, traces, release health, and user-impact debugging; it can be linked from investigations but must not replace Postgres audit history.

## Open Questions

- Should users be able to delete accounts themselves in v1, or request deletion through support?
