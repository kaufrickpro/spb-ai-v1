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
