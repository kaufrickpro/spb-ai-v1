# ADR 6: Use Resend For Transactional Email

## Status

Accepted

## Context

The platform needs reliable transactional email for onboarding, approval decisions, intro request updates, and billing/subscription events. Email sending must stay server-side and must not leak manuscript, payment, or locked contact data.

## Decision

Use Resend for transactional product email. The Node API and trusted async workers send email through Resend; the browser never calls Resend directly.

## Consequences

- Resend API keys and webhook secrets must live in Secret Manager or local ignored env files.
- Resend webhooks must be signature-verified before processing delivery events.
- Email sends tied to product events should be idempotent.
- Email templates must support Turkish and English from the start.
- Emails should avoid full manuscript text, document chunks, signed URLs, raw PayTR payloads, and unreleased contact details; sensitive details should be viewed in the authenticated app.
- The sender domain must be configured with SPF, DKIM, and DMARC.
