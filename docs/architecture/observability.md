# Observability Architecture

## Summary

Observability should make product operations, payments, email delivery, and AI jobs debuggable without exposing sensitive manuscript, payment, or contact data.

Use Google Cloud Logging/Monitoring for platform logs, service metrics, uptime checks, and infrastructure alerts. Use Sentry for application exceptions, frontend/backend performance traces, release health, and user-impact debugging. Use Postgres audit logs for durable product decisions, automated eligibility outcomes, and admin overrides.

## Logging

Use structured JSON logs across services.

Required fields:

- `timestamp`
- `service`
- `environment`
- `request_id`
- `user_id` when available
- `job_id` when available
- `event`
- `status`
- `duration_ms`

Do not log:

- PayTR secrets
- Supabase service-role key
- Resend API keys and webhook secrets
- Sentry auth tokens
- full manuscript text
- signed URLs
- raw card/payment sensitive data
- unreleased contact details

Redaction must be centralized in shared logging/Sentry helpers for the API and AI service. Add tests with fixture payloads containing manuscript text, document chunks, signed URLs, contact details, PayTR payloads, Resend signatures, and service keys.

## Tracing

Propagate a request ID across:

- frontend request
- Node API
- Cloud Task
- FastAPI AI service
- database writes

Use this ID in logs and audit metadata.

## Sentry

Enable Sentry in:

- React frontend
- Node API
- FastAPI AI service

Configure by environment:

- Sentry projects: `spb-ai-web`, `spb-ai-api`, and `spb-ai-ai-service`
- environment tags: `staging` and `production`
- release names on every deployment: `web@<git-sha>`, `api@<git-sha>`, and `ai-service@<git-sha>`
- source maps uploaded for frontend releases without exposing source maps publicly
- PII scrubbing before events leave the app

Capture:

- unhandled exceptions
- API route errors
- frontend route/render errors
- failed Cloud Task handlers
- AI service ingestion and matching failures
- PayTR callback processing failures after secrets are redacted
- Resend email send/webhook processing failures after secrets and recipient-sensitive payloads are redacted
- admin console errors and failed override attempts after sensitive payloads are redacted

Do not capture:

- full manuscript text or document chunks
- signed URLs
- PayTR credentials or card-sensitive payloads
- Resend API keys or webhook signatures
- Supabase service-role keys

Sentry traces should use the same `request_id` where available, plus job identifiers for async work.

Sentry is not the audit ledger. Store Sentry issue IDs or event IDs in audit metadata when useful for investigation, but durable business history must remain in Postgres.

## Metrics

Track:

- API request count, latency, and error rate
- signup and onboarding completion
- automated eligibility pass/fail rates
- needs-review and quarantine rates
- admin override rate
- time in exception review
- upload failures
- ingestion job success/failure
- match run count and latency
- intro request acceptance rate
- PayTR callback failures
- Resend email send failures
- email bounce and complaint rates
- quota denial events

## Alerts

Initial alerts:

- API 5xx rate above threshold
- AI job failure spike
- PayTR callback verification failures
- Resend webhook verification failures
- transactional email delivery failure spike
- Cloud Tasks dead-letter growth
- GCS upload failures
- Supabase database connection errors

Initial Sentry alerts route to email. Add Slack routing later when the team has a shared Slack workspace. Google Cloud Monitoring remains responsible for infrastructure alerts and uptime signals.

## Release And CI Gates

Required gates:

- Pull request: lint, typecheck, unit tests, contract tests, and focused security tests for touched areas.
- Staging deploy: migrations, integration tests, E2E smoke tests, image scan, Terraform validation, and provider webhook fixture tests.
- Production deploy: manual approval, migration review, rollback plan, image promotion or rebuild from a tagged commit, and production smoke tests.

## Audit Logs

Store app-level audit logs in Postgres for:

- automated eligibility outcomes
- admin overrides, including approve/reject/quarantine/restore/suspend/hide
- publisher change acceptance/rejection
- payment/subscription mutations
- transactional email send attempts tied to sensitive events
- sensitive document access grants
- role/admin changes

Do not duplicate every debug log line into audit logs. Sentry and structured logs explain what failed at runtime; audit logs explain who or what changed product/business state and why.

## Open Questions

- What uptime target should production aim for at launch?
- What is the acceptable target latency for matching?
