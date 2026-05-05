# ADR 7: Simplify V1 And Lock Risk Guardrails

## Status

Accepted

## Context

The original V1 plan included report generation, PDF export, Google ADK workflows, broad async job handling, and several under-specified operational details. Those areas add cost, latency, security, quota, and testing risk before the core marketplace loop has been proven.

## Decision

Simplify V1 to the core discovery loop: profiles, manuscripts, private uploads, automated eligibility checks, exception-based admin operations, RAG-backed matching, match details, intro requests, contact/sample unlock, subscriptions, PayTR, Resend, and Sentry.

Defer AI-generated fit reports, report jobs, PDF exports, Google ADK workflows, report quotas, and report-ready emails to V1.5.

Lock conservative implementation guardrails for V1:

- API-owned app profile/onboarding state after Supabase Auth session creation.
- Idempotent trusted first-admin bootstrap.
- RLS acceptance tests before exposing client-readable tables.
- Fixed V1 discovery filters.
- Versioned matching outputs.
- Automation-first eligibility for clean profiles, manuscripts, documents, discovery, matching, and intro requests.
- Exception-based admin review for `needs_review`, quarantined, reported, failed, or staff-overridden items.
- Transactional quota consumption with idempotency keys.
- Explicit file lifecycle and cleanup.
- Typed config validation at service startup.
- Centralized sensitive-data redaction.
- CI/CD gates for PR, staging, and production.

## Consequences

- V1 ships a smaller, safer marketplace loop.
- Match detail pages preserve AI explainability without report infrastructure.
- Reports can be added later using already-structured match explanation data.
- Implementation has fewer hidden race conditions, leakage paths, and provider dependencies.
