# MCP Tooling

## Codex Setup

For Codex, configure MCP servers through Codex MCP configuration or the Codex CLI. Example:

```sh
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
```

Use Codex-visible MCP tools when they are available in the current session. If a needed MCP server is not visible, use the documented fallback path below and record the gap in the final report.

## Local Setup Status

| Server       | Status           | Notes                                                                                                                                                                  |
| ------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context7     | ⚠️ Needs API Key | `@upstash/context7-mcp@latest` via npx, requires `--api-key` from [context7.com](https://context7.com)                                                                 |
| Supabase     | ⚠️ Needs PAT     | Configure a Supabase Personal Access Token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) in the active local MCP config. |
| Playwright   | ✅ Configured    | `@playwright/mcp@latest` via npx, no auth required                                                                                                                     |
| GitHub       | ⚠️ Needs PAT     | Configure a GitHub PAT with `repo` and `read:org` scopes in the active local MCP config. Uses official npx package `@modelcontextprotocol/server-github`.              |
| Sentry       | ⏳ Deferred      | Configure once Sentry project is created                                                                                                                               |
| Google Cloud | ⏳ Deferred      | Configure once GCP project is provisioned                                                                                                                              |

Legacy local editor setups may still use `~/Library/Application Support/Claude/claude_desktop_config.json`. Treat that as an editor-specific fallback, not the primary Codex setup path.

## Purpose

MCP servers are optional-but-important build-time and operations tools for agents and developers working on this project. They are not production runtime dependencies and must never be required by deployed services.

This project should use MCP servers to improve documentation lookup, code review, database inspection, browser verification, observability triage, and cloud resource inspection.

## Required MCP Servers

### Context7 MCP

Purpose:

- Retrieve current library and framework documentation during implementation.
- Reduce stale assumptions for React, Tailwind CSS, shadcn/ui, FastAPI, Pydantic, Supabase, Terraform, Sentry, Resend, and Google Cloud SDK usage.

Use when:

- Adding or upgrading library APIs.
- Implementing framework-specific patterns.
- Checking provider SDK examples or configuration behavior.

Fallback:

- Use official vendor documentation and local package source/types.

### Supabase MCP

Purpose:

- Inspect Supabase project state, schemas, policies, and generated type expectations.
- Review RLS behavior and migration impact.

Use when:

- Designing or reviewing migrations.
- Debugging RLS access behavior.
- Verifying local/staging schema drift.
- Checking generated TypeScript database types.

Fallback:

- Use Supabase CLI, SQL migrations, local database inspection, and generated type output.

### GitHub MCP

Purpose:

- Inspect repository issues, pull requests, review context, CI checks, and releases once the project is hosted on GitHub.

Use when:

- Reviewing implementation history.
- Coordinating branch/PR work.
- Checking CI failures.
- Preparing release notes.

Fallback:

- Use `git`, GitHub CLI, and CI web UI.

### Browser Or Playwright MCP

Purpose:

- Verify frontend and admin UI behavior in a real browser.
- Capture screenshots and inspect responsive layout issues.

Use when:

- Building authenticated app screens.
- Building admin screens.
- Verifying prerendered public pages.
- Checking layout at mobile and desktop sizes.
- Smoke-testing signup, onboarding, upload, matching, match detail, intro request, billing, and admin flows.

Fallback:

- Use local dev server plus Playwright tests or manual browser testing.

### Sentry MCP

Purpose:

- Inspect Sentry issues, traces, releases, and alert quality after Sentry is configured.

Use when:

- Debugging staging or production errors.
- Reviewing release health.
- Investigating API, frontend, AI service, PayTR, or Resend failures.
- Confirming sensitive data is not captured.

Fallback:

- Use the Sentry web UI and exported issue/trace links.

### Google Cloud MCP

Purpose:

- Read-only inspection of deployed Google Cloud resources when available in the team's environment.

Use when:

- Inspecting Cloud Run services.
- Inspecting Cloud Tasks queues and dead-letter behavior.
- Inspecting GCS buckets.
- Inspecting Secret Manager metadata.
- Inspecting IAM bindings.
- Inspecting Cloud Logging and Monitoring signals.

Fallback:

- Use Terraform state/plan, `gcloud`, Google Cloud Console, and Cloud Logging queries.

## Provider-Specific Notes

- PayTR: no MCP server is required. Use official PayTR documentation, webhook fixtures, typed adapters, and hash-validation tests.
- Resend: no MCP server is required unless a reliable one is available later. Use official Resend documentation, typed adapters, webhook fixtures, and delivery-event tests.
- Vertex AI: Google Cloud MCP may help with resource inspection, but Terraform, Google Cloud SDK, and service adapters remain the executable integration path.

## Security Rules

- Do not commit MCP credentials, access tokens, project secrets, service-role keys, PayTR secrets, Resend API keys, Sentry auth tokens, or Google service account keys.
- Store MCP credentials in local MCP configuration, CI secrets, Google Secret Manager, or the provider-approved credential store.
- Prefer read-only MCP access for production resources.
- Do not mutate production resources through MCP unless an explicit task calls for it and the change path is documented.
- Do not expose manuscript text, document chunks, signed URLs, raw payment payloads, or unreleased contact details through MCP prompts or tool calls.

## Local Setup Checklist (Non-Secret)

Use this checklist while bootstrapping a local machine:

- [ ] Context7 MCP configured with `--api-key YOUR_API_KEY` in the active local MCP config, using a real API key from [context7.com](https://context7.com).
- [ ] Supabase MCP configured — replace `REPLACE_WITH_YOUR_SUPABASE_PAT` with a real PAT from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens).
- [x] Playwright MCP configured in the active local MCP config — ready, no auth needed.
- [ ] GitHub MCP configured — replace `REPLACE_WITH_YOUR_GITHUB_PAT` with a real PAT (scopes: `repo`, `read:org`).
- [ ] Sentry MCP — deferred until Sentry project is created.
- [ ] Google Cloud MCP — deferred until GCP project is provisioned.
- Keep all MCP credentials out of this repository and local `.env.example` files.
- Document the fallback path (official docs, CLI, SDK, console) for each unavailable MCP server.

## Smoke Checklist

Before tasks that depend on MCP tooling:

- Confirm the needed MCP server is configured and reachable.
- Confirm the selected MCP server has only the minimum permissions required.
- Confirm no secrets are printed into chat or logs.
- Record the fallback path if the MCP server is unavailable.

## Notes On Docker Dependency

The official MCP servers (such as GitHub) are now published and officially supported via `npx` (e.g., `@modelcontextprotocol/server-github`). Docker is no longer required for basic MCP setups, making the local installation significantly lighter.
