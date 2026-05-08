# Google Cloud Deployment Architecture

## Summary

The platform is Google Cloud native and should be deployed close to Türkiye, with Frankfurt-aligned regions as the default target where service support allows.

## Deployable Services

- `web`: React SPA served from Cloud Run.
- `api`: Fastify + Node.js TypeScript API on Cloud Run.
- `ai-service`: private FastAPI service on Cloud Run.
- `document-scanner`: private ClamAV HTTP scanner on Cloud Run.

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

- production: `https://spb-ai.com`
- production `www`: redirect `https://www.spb-ai.com` to `https://spb-ai.com`
- staging: `https://spb-ai.dev`

## Production Setup Decision Register

| Blocker                          | Owner   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Secret Location                                                                                                                                                                                                                                                                                        | Status  |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Product name                     | Mustafa | Smart Publishing Bridge                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | N/A                                                                                                                                                                                                                                                                                                    | Decided |
| Production domain                | Mustafa | Canonical production URL is `https://spb-ai.com`; redirect `https://www.spb-ai.com` to the apex domain.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | N/A                                                                                                                                                                                                                                                                                                    | Decided |
| Staging domain                   | Mustafa | Use `https://spb-ai.dev`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | N/A                                                                                                                                                                                                                                                                                                    | Decided |
| Production app callback URLs     | Mustafa | Production app URL `https://spb-ai.com`; production auth callback `https://spb-ai.com/auth/callback`; staging app URL `https://spb-ai.dev`; staging auth callback `https://spb-ai.dev/auth/callback`.                                                                                                                                                                                                                                                                                                                                                   | N/A                                                                                                                                                                                                                                                                                                    | Decided |
| GCS bucket naming/configuration  | Mustafa | Use separate private manuscript buckets: production `spb-ai-prod-manuscripts`; staging `spb-ai-staging-manuscripts`.                                                                                                                                                                                                                                                                                                                                                                                                                                    | GCP IAM/service credentials in Secret Manager, not docs or GitHub issues.                                                                                                                                                                                                                              | Decided |
| GCS object access policy         | Mustafa | No public reads or object listing. All manuscript upload/download access goes through API authorization checks and short-lived signed URLs.                                                                                                                                                                                                                                                                                                                                                                                                             | GCP IAM/service credentials in Secret Manager, not docs or GitHub issues.                                                                                                                                                                                                                              | Decided |
| Step 9 staging target resources  | Mustafa | Staging uses project `spb-ai`, region `europe-west3`, bucket `spb-ai-staging-manuscripts`, Cloud Tasks queue `document-processing-staging`, API service `spb-api-staging`, AI service `spb-ai-service-staging`, API service account `spb-api-staging@spb-ai.iam.gserviceaccount.com`, AI service account `spb-ai-service-staging@spb-ai.iam.gserviceaccount.com`, and Cloud Tasks invoker `spb-cloud-tasks-staging@spb-ai.iam.gserviceaccount.com`.                                                                                                     | Service account keys must not be created or committed; use runtime service identities and Secret Manager.                                                                                                                                                                                              | Decided |
| Supabase Auth SMTP sender        | Mustafa | Use Resend SMTP with production sender `no-reply@auth.spb-ai.com` and staging sender `no-reply@auth.spb-ai.dev`.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Resend SMTP/API credentials in Supabase SMTP settings or Secret Manager, not docs or GitHub issues.                                                                                                                                                                                                    | Decided |
| API-owned product email sender   | Mustafa | Use Resend product senders: production `support@mail.spb-ai.com`; staging `support@mail.spb-ai.dev`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Resend API keys and webhook secrets in Secret Manager, not docs or GitHub issues.                                                                                                                                                                                                                      | Decided |
| Sentry project/alert routing     | Mustafa | Use projects `spb-ai-web`, `spb-ai-api`, and `spb-ai-ai-service`; tag environments as `staging` and `production`; route initial alerts to email and add Slack later.                                                                                                                                                                                                                                                                                                                                                                                    | Sentry auth tokens in CI secrets or Secret Manager; DSNs in env config as appropriate.                                                                                                                                                                                                                 | Decided |
| Sentry release naming            | Mustafa | Use `web@<git-sha>`, `api@<git-sha>`, and `ai-service@<git-sha>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Sentry release/source-map upload token in CI secrets only.                                                                                                                                                                                                                                             | Decided |
| GitHub `main` branch protection  | Mustafa | Require PRs, passing CI, up-to-date branch before merge, at least one approval, resolved conversations, no force pushes, and no direct pushes.                                                                                                                                                                                                                                                                                                                                                                                                          | GitHub admin credentials and PATs outside the repo.                                                                                                                                                                                                                                                    | Decided |
| Document scanner launch posture  | Mustafa | ADR 0008 remains available only for controlled internal staging smoke tests. Real-user staging and production uploads use the repo-owned `apps/document-scanner` ClamAV Cloud Run service with `DOCUMENT_SCANNER_MODE=real`, `DOCUMENT_SCANNER_PROVIDER=http-clamav`, Secret Manager config, and private Cloud Run OIDC.                                                                                                                                                                                                                                | Scanner provider config stays in Secret Manager. Staging secret names are `spb-ai-staging-document-scanner-endpoint`, `spb-ai-staging-document-scanner-token`, and `spb-ai-staging-document-scanner-timeout-seconds`.                                                                                  | Decided |
| Staging Vertex Vector Search PSC | Mustafa | Staging uses project `spb-ai`, project number `937194608067`, region `europe-west3`, VPC `spb-ai-staging-vpc`, Cloud Run subnet `spb-ai-staging-run-euw3` (`10.42.0.0/26`), PSC endpoint subnet `spb-ai-staging-psc-euw3` (`10.42.1.0/28`), service connection policy `spb-ai-staging-vertex-psc`, streaming index `publisher-author-staging-vector-index` / `6107839868853813248`, PSC endpoint `publisher-author-staging-vector-endpoint` / `737156575726141440`, deployed index ID `publisher_author_staging_v1`, and PSC match address `10.42.1.2`. | No secrets. AI-service runtime secrets come from Secret Manager. Cloud Build now produces the staging AI service image as `linux/amd64`, and `spb-ai-service-staging-00003-wgf` is Ready on the PSC VPC path. Basic `findNeighbors` smoke from Cloud Run passed against the synthetic smoke datapoint. | Decided |

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
- Document processing provider mode: local uses `DOCUMENT_PROCESSING_PROVIDER=local`; staging/production use `DOCUMENT_PROCESSING_PROVIDER=cloud_tasks`.
- Cloud Tasks service account email for private AI service OIDC invocation.
- Vertex AI project, region, index, and endpoint identifiers when Step 10 real Vertex matching is enabled.
- Document scanner config for the AI service: local may use `DOCUMENT_SCANNER_MODE=local_fake` and `LOCAL_FAKE_SCANNER_RESULT=not_scanned`; staging/production real scanning must use `DOCUMENT_SCANNER_MODE=real`, `DOCUMENT_SCANNER_PROVIDER=http-clamav`, `DOCUMENT_SCANNER_ENDPOINT`, `DOCUMENT_SCANNER_TOKEN`, and `DOCUMENT_SCANNER_TIMEOUT_SECONDS`, or an explicit `DOCUMENT_SCANNER_LAUNCH_DECISION_ID`.
- Sentry DSNs, environment tags, release names, and trace sample rates for frontend, API, and AI service.
- Sentry auth token for release/source-map upload in CI only.
- Supabase Auth custom SMTP configuration, preferably Resend SMTP, for signup confirmation, password reset, invites, and future OTP/magic-link emails.
- Resend API key, sender domain, and webhook secret for API-owned product emails.

Committed staging templates live under `infra/env/staging/`. They are examples only; angle-bracket values such as `<staging-supabase-service-role-key-secret>` are secret names to replace during deployment, not literal runtime values. Real server-side secrets must be injected from Secret Manager or the deployment platform secret store.

Environment-specific values:

- production app URL: `https://spb-ai.com`
- production auth callback: `https://spb-ai.com/auth/callback`
- staging app URL: `https://spb-ai.dev`
- staging auth callback: `https://spb-ai.dev/auth/callback`
- production manuscript bucket: `spb-ai-prod-manuscripts`
- staging manuscript bucket: `spb-ai-staging-manuscripts`
- staging AI/Vertex PSC VPC: `projects/spb-ai/global/networks/spb-ai-staging-vpc`
- staging AI Cloud Run subnet: `projects/spb-ai/regions/europe-west3/subnetworks/spb-ai-staging-run-euw3`
- staging Vertex PSC endpoint subnet: `projects/spb-ai/regions/europe-west3/subnetworks/spb-ai-staging-psc-euw3`
- staging Vertex PSC service connection policy: `projects/spb-ai/locations/europe-west3/serviceConnectionPolicies/spb-ai-staging-vertex-psc`
- staging Vertex Vector Search index ID: `6107839868853813248`
- staging Vertex Vector Search index endpoint ID: `737156575726141440`
- staging Vertex Vector Search deployed index ID: `publisher_author_staging_v1`
- staging Vertex Vector Search PSC match address: `10.42.1.2`

Configuration rules:

- Each service validates typed configuration at startup and fails fast on missing required values.
- Provider mode must match environment, for example PayTR sandbox in staging and PayTR production in production.
- Frontend-exposed config must be explicitly allowlisted.
- Server-only secrets must come from Secret Manager in deployed environments.

Email domain configuration:

- Configure SPF, DKIM, and DMARC for each Resend sender domain.
- Use dedicated auth senders for Supabase Auth emails: production `no-reply@auth.spb-ai.com`; staging `no-reply@auth.spb-ai.dev`.
- Use separate product email senders for API-owned transactional email: production `support@mail.spb-ai.com`; staging `support@mail.spb-ai.dev`.
- Use separate sender domains or subdomains for staging and production where practical.
- Keep transactional email templates versioned in code or configuration.

Storage configuration:

- Manuscript buckets must stay private.
- Do not allow public reads or public object listing.
- All manuscript upload and download access must go through API authorization checks and short-lived signed URLs.
- Staging API config must set `STORAGE_PROVIDER=gcs`, `GCS_BUCKET_PRIVATE_UPLOADS=spb-ai-staging-manuscripts`, `DOCUMENT_PROCESSING_PROVIDER=cloud_tasks`, `GOOGLE_CLOUD_PROJECT=spb-ai`, `GOOGLE_CLOUD_REGION=europe-west3`, `CLOUD_TASKS_INGESTION_QUEUE=document-processing-staging`, `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL=spb-cloud-tasks-staging@spb-ai.iam.gserviceaccount.com`, and `AI_SERVICE_BASE_URL` to the private AI Cloud Run service URL.
- Staging AI-service config must set `STORAGE_PROVIDER=gcs`, `GCS_BUCKET_PRIVATE_UPLOADS=spb-ai-staging-manuscripts`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and real scanner config (`DOCUMENT_SCANNER_MODE=real`, `DOCUMENT_SCANNER_PROVIDER=http-clamav`, `DOCUMENT_SCANNER_ENDPOINT`, `DOCUMENT_SCANNER_TOKEN`, `DOCUMENT_SCANNER_TIMEOUT_SECONDS`) injected from Secret Manager; it must also set `DOCUMENT_SCANNER_CLOUD_RUN_AUDIENCE` to the scanner service URL for private Cloud Run OIDC. The service reads private objects through its runtime service identity. The expected staging scanner secret names are `spb-ai-staging-document-scanner-endpoint`, `spb-ai-staging-document-scanner-token`, and `spb-ai-staging-document-scanner-timeout-seconds`. Use `infra/scripts/deploy-document-scanner-staging.sh` to build/deploy the scanner and create or rotate these values until Terraform owns these resources.
- Staging AI-service Vertex config must set `VERTEX_PROJECT_ID=spb-ai`, `VERTEX_LOCATION=europe-west3`, `VERTEX_AI_EMBEDDING_MODEL=gemini-embedding-001`, `VERTEX_AI_VECTOR_INDEX_ID=6107839868853813248`, `VERTEX_AI_INDEX_ENDPOINT_ID=737156575726141440`, `VERTEX_AI_DEPLOYED_INDEX_ID=publisher_author_staging_v1`, `VERTEX_AI_PSC_NETWORK=projects/spb-ai/global/networks/spb-ai-staging-vpc`, and `VERTEX_AI_PSC_MATCH_ADDRESS=10.42.1.2` when the real retrieval adapter is enabled. The Cloud Run service must use Direct VPC egress through `spb-ai-staging-run-euw3` with `private-ranges-only` or stricter egress as appropriate.
- Cloud Tasks task payloads for document processing contain only `{ job_id }`. Private Cloud Run IAM/OIDC, Supabase service-role credentials, and GCS IAM stay server-side.
- `DOCUMENT_SCANNER_TOKEN` is server-only and belongs in Secret Manager. It must never be exposed to the frontend, Cloud Tasks payloads, logs, Sentry metadata, job metadata, or admin submitted fields.

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
