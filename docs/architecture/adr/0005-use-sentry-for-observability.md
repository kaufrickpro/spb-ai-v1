# ADR 5: Use Sentry For Application Observability

## Status

Accepted

## Context

The platform needs fast debugging across the React frontend, Node API, FastAPI AI service, Cloud Task handlers, PayTR callbacks, and matching jobs. Google Cloud Logging and Monitoring cover platform logs and infrastructure metrics, but application exceptions, release health, and user-impact tracing need a dedicated tool.

## Decision

Use Sentry for application error monitoring, performance tracing, release health, and frontend source-map-backed debugging. Keep Google Cloud Logging and Monitoring for structured logs, service metrics, uptime checks, and infrastructure alerts.

## Consequences

- Sentry must be configured per environment with release/version tags.
- Frontend source maps may be uploaded to Sentry during CI, but should not be served publicly.
- Events must scrub manuscript text, document chunks, signed URLs, PayTR-sensitive payloads, Resend secrets, Supabase service-role keys, and unreleased contact details.
- Sentry auth tokens must live in CI or Secret Manager, not frontend code.
