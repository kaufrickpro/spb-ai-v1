# Seed Scripts

This directory is reserved for local development and test seed/import scripts.

Use this area for non-production seed tooling only.

Trusted bootstrap scripts that need service-role credentials currently live under `apps/api/src/scripts/`.

First admin bootstrap:

`npm run bootstrap:first-admin --workspace apps/api -- <email>`

Required env vars in `apps/api/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIRST_ADMIN_EMAIL_ALLOWLIST`

Demo marketplace seed:

`npm run demo:seed --workspace apps/api`

By default this creates or updates 50 publisher accounts and 50 author accounts
using confirmed Supabase Auth users. Each seeded author gets one eligible
manuscript with processed sample metadata/chunks so local matching and match
detail smoke tests have realistic data.

Default demo login pattern:

- Publishers: `demo-publisher-001@example.test` through `demo-publisher-050@example.test`
- Authors: `demo-author-001@example.test` through `demo-author-050@example.test`
- Password: `Demo-seed-password-1`

Useful options:

- `--publishers <count>`
- `--authors <count>`
- `--email-domain <domain>`
- `--prefix <prefix>`
- `--password <password>`

The command refuses to run when `APP_CONFIG_MODE=production`. It is local-only
by default; for a non-production remote, set `DEMO_SEED_ALLOW_NON_LOCAL=true` or
pass `--allow-non-local`.
