# Google Cloud Deployment Architecture

## Summary

The platform is Google Cloud native and should be deployed close to Türkiye, with Frankfurt-aligned regions as the default target where service support allows.

## Deployable Services

- `web`: React SPA served from Cloud Run.
- `api`: Fastify + Node.js TypeScript API on Cloud Run.
- `ai-service`: private FastAPI service on Cloud Run.

## Managed Services

- Supabase Auth/Postgres.
- Google Cloud Run.
- Google Cloud Tasks.
- Google Cloud Storage.
- Secret Manager.
- Vertex AI Vector Search.
- Cloud Logging and Monitoring.
- Sentry for application error monitoring and performance tracing.
- Resend for Supabase Auth SMTP and API-owned transactional product email.
- Domain/DNS through the chosen DNS provider and Cloud Run domain mapping or load balancer.

## Network And Access

- `web` is public.
- `api` is public but auth-protected for private routes.
- `ai-service` is private and callable only by trusted service accounts.
- Cloud Tasks invokes trusted endpoints with service account auth.
- GCS buckets are private.

## Environment Strategy

Use at least:

- local
- staging
- production

Environment domains:

- production: `https://spb-ai.dev`
- production `www`: redirect `https://www.spb-ai.dev` to `https://spb-ai.dev`
- staging: `https://staging.spb-ai.dev`

## Production Setup Decision Register

| Blocker                         | Owner   | Decision                                                                                                                                                                                                              | Secret Location                                                                                     | Status  |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| Product name                    | Mustafa | Smart Publishing Bridge                                                                                                                                                                                               | N/A                                                                                                 | Decided |
| Production domain               | Mustafa | Canonical production URL is `https://spb-ai.dev`; redirect `https://www.spb-ai.dev` to the apex domain.                                                                                                               | N/A                                                                                                 | Decided |
| Staging domain                  | Mustafa | Use `https://staging.spb-ai.dev`.                                                                                                                                                                                     | N/A                                                                                                 | Decided |
| Production app callback URLs    | Mustafa | Production app URL `https://spb-ai.dev`; production auth callback `https://spb-ai.dev/auth/callback`; staging app URL `https://staging.spb-ai.dev`; staging auth callback `https://staging.spb-ai.dev/auth/callback`. | N/A                                                                                                 | Decided |
| GCS bucket naming/configuration | Mustafa | Use separate private manuscript buckets: production `spb-ai-prod-manuscripts`; staging `spb-ai-staging-manuscripts`.                                                                                                  | GCP IAM/service credentials in Secret Manager, not docs or GitHub issues.                           | Decided |
| GCS object access policy        | Mustafa | No public reads or object listing. All manuscript upload/download access goes through API authorization checks and short-lived signed URLs.                                                                           | GCP IAM/service credentials in Secret Manager, not docs or GitHub issues.                           | Decided |
| Supabase Auth SMTP sender       | Mustafa | Use Resend SMTP with production sender `no-reply@auth.spb-ai.dev` and staging sender `no-reply@auth.staging.spb-ai.dev`.                                                                                              | Resend SMTP/API credentials in Supabase SMTP settings or Secret Manager, not docs or GitHub issues. | Decided |
| API-owned product email sender  | Mustafa | Use Resend product senders: production `support@mail.spb-ai.dev`; staging `support@mail.staging.spb-ai.dev`.                                                                                                          | Resend API keys and webhook secrets in Secret Manager, not docs or GitHub issues.                   | Decided |
| Sentry project/alert routing    | Mustafa | Use projects `spb-ai-web`, `spb-ai-api`, and `spb-ai-ai-service`; tag environments as `staging` and `production`; route initial alerts to email and add Slack later.                                                  | Sentry auth tokens in CI secrets or Secret Manager; DSNs in env config as appropriate.              | Decided |
| Sentry release naming           | Mustafa | Use `web@<git-sha>`, `api@<git-sha>`, and `ai-service@<git-sha>`.                                                                                                                                                     | Sentry release/source-map upload token in CI secrets only.                                          | Decided |
| GitHub `main` branch protection | Mustafa | Require PRs, passing CI, up-to-date branch before merge, at least one approval, resolved conversations, no force pushes, and no direct pushes.                                                                        | GitHub admin credentials and PATs outside the repo.                                                 | Decided |
| Document scanner launch posture | Mustafa | Local uses `DOCUMENT_SCANNER_MODE=local_fake` and produces `scanner_result=not_scanned`. Staging/production must set `DOCUMENT_SCANNER_MODE=real` plus `DOCUMENT_SCANNER_PROVIDER`, or set a named `DOCUMENT_SCANNER_LAUNCH_DECISION_ID` before real user documents are accepted. | Scanner provider credentials and launch-decision records stay outside committed files.              | Open    |

Each environment should have separate:

- Supabase project or schema strategy
- GCS buckets
- Cloud Run services
- Cloud Tasks queues
- Secret Manager secrets
- PayTR credentials
- Resend API keys, SMTP auth sender domains, product email sender domains, and webhook secrets
- Sentry DSNs and auth tokens
- Vertex AI indexes

## Terraform Layout

```txt
infra/terraform/
  main.tf
  variables.tf
  outputs.tf
  cloud-run.tf
  cloud-tasks.tf
  storage.tf
  secrets.tf
  iam.tf
  monitoring.tf
```

## Configuration

Required service config:

- Supabase URL and anon key.
- Supabase JWT verification config for the API.
- Supabase service-role key for API and AI service only.
- PayTR merchant credentials for API only.
- GCS bucket names.
- Cloud Tasks queue names.
- AI service URL.
- Vertex AI project, region, index, and endpoint identifiers.
- Document scanner mode/provider, or an explicit scanner launch decision ID for staging/production.
- Sentry DSNs for frontend, API, and AI service.
- Sentry auth token for release/source-map upload in CI only.
- Supabase Auth custom SMTP configuration, preferably Resend SMTP, for signup confirmation, password reset, invites, and future OTP/magic-link emails.
- Resend API key, sender domain, and webhook secret for API-owned product emails.

Environment-specific values:

- production app URL: `https://spb-ai.dev`
- production auth callback: `https://spb-ai.dev/auth/callback`
- staging app URL: `https://staging.spb-ai.dev`
- staging auth callback: `https://staging.spb-ai.dev/auth/callback`
- production manuscript bucket: `spb-ai-prod-manuscripts`
- staging manuscript bucket: `spb-ai-staging-manuscripts`

Configuration rules:

- Each service validates typed configuration at startup and fails fast on missing required values.
- Provider mode must match environment, for example PayTR sandbox in staging and PayTR production in production.
- Frontend-exposed config must be explicitly allowlisted.
- Server-only secrets must come from Secret Manager in deployed environments.

Email domain configuration:

- Configure SPF, DKIM, and DMARC for each Resend sender domain.
- Use dedicated auth senders for Supabase Auth emails: production `no-reply@auth.spb-ai.dev`; staging `no-reply@auth.staging.spb-ai.dev`.
- Use separate product email senders for API-owned transactional email: production `support@mail.spb-ai.dev`; staging `support@mail.staging.spb-ai.dev`.
- Use separate sender domains or subdomains for staging and production where practical.
- Keep transactional email templates versioned in code or configuration.

Storage configuration:

- Manuscript buckets must stay private.
- Do not allow public reads or public object listing.
- All manuscript upload and download access must go through API authorization checks and short-lived signed URLs.

Sentry configuration:

- Use Sentry projects `spb-ai-web`, `spb-ai-api`, and `spb-ai-ai-service`.
- Tag events and releases with `staging` or `production`.
- Name releases as `web@<git-sha>`, `api@<git-sha>`, and `ai-service@<git-sha>`.
- Route initial Sentry alerts to email. Add Slack routing later when the team has a shared Slack workspace.

## Deployment Flow

1. Apply infrastructure.
2. Run Supabase migrations.
3. Seed taxonomy and plans.
4. Deploy API.
5. Deploy AI service.
6. Deploy frontend.
7. Configure domain and environment variables.
8. Configure Supabase Auth custom SMTP and URL settings for the environment.
9. Run smoke tests, including email/password signup confirmation delivery.

## CI/CD Gates

- Pull requests run lint, typecheck, tests, and contract checks.
- Staging deploys run migrations, integration tests, E2E smoke tests, image scanning, and Terraform validation.
- Production deploys require manual approval, migration review, rollback notes, image tag verification, and smoke tests after rollout.
- Protect `main` with required pull requests, passing CI, up-to-date branch before merge, at least one approval, resolved conversations, no force pushes, and no direct pushes.

## Open Questions

- Which Supabase region/project will be used?
- Should infrastructure be single-project or separate GCP projects for staging and production?
