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
- Sentry DSNs for frontend, API, and AI service.
- Sentry auth token for release/source-map upload in CI only.
- Supabase Auth custom SMTP configuration, preferably Resend SMTP, for signup confirmation, password reset, invites, and future OTP/magic-link emails.
- Resend API key, sender domain, and webhook secret for API-owned product emails.

Configuration rules:

- Each service validates typed configuration at startup and fails fast on missing required values.
- Provider mode must match environment, for example PayTR sandbox in staging and PayTR production in production.
- Frontend-exposed config must be explicitly allowlisted.
- Server-only secrets must come from Secret Manager in deployed environments.

Email domain configuration:

- Configure SPF, DKIM, and DMARC for each Resend sender domain.
- Use a dedicated auth sender such as `no-reply@auth.your-domain.com` for Supabase Auth emails.
- Use a separate product email sender domain or from-address for API-owned transactional email where practical.
- Use separate sender domains or subdomains for staging and production where practical.
- Keep transactional email templates versioned in code or configuration.

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

## Open Questions

- What is the production domain?
- Do you want separate staging and production domains?
- Which Supabase region/project will be used?
- Should infrastructure be single-project or separate GCP projects for staging and production?
- What auth email sender domain and from-address should Resend SMTP use?
- What product email sender domain and from-address should the API Resend adapter use?
