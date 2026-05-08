# Environment Templates

This folder contains committed environment templates for deployed environments.

Rules:

- Commit only `.env.example` files with placeholders.
- Do not commit real Supabase service-role keys, scanner tokens, PayTR secrets, Resend keys, Sentry auth tokens, or Google credentials.
- Store deployed secrets in Google Secret Manager or the deployment platform secret store. Angle-bracket values such as `<staging-supabase-service-role-key-secret>` name the secret to mount/inject; they are not literal runtime values.
- Keep frontend templates limited to public values only.
- Use service-specific templates because the web app, Node API, and AI service have different secret boundaries.
- Real document scanner config is uploaded with `infra/scripts/put-scanner-secrets.sh`.
  The staging AI service template expects these Secret Manager entries:
  `spb-ai-staging-document-scanner-endpoint`,
  `spb-ai-staging-document-scanner-token`, and
  `spb-ai-staging-document-scanner-timeout-seconds`.

For staging, start from:

- `staging/web.env.example`
- `staging/api.env.example`
- `staging/ai-service.env.example`
