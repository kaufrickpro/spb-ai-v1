# Agent Harness

This project should be easy for an agent to enter, understand, change, and verify. The harness is the combination of docs, scripts, tests, local tools, and review loops that make that possible.

## Source Of Truth

AGENTS.md is only a map. Do not turn it back into the full project manual.

Use these docs as the durable source of truth:

- `docs/project-knowledge-base.md`: current phase, recent decisions, blockers, and next recommended step.
- `docs/project-build-plan.md`: vertical-slice build order and deferred work.
- `docs/architecture/*.md`: domain architecture, product constraints, security rules, operational rules, and provider-specific guidance.
- `docs/architecture/adr/*.md`: accepted architecture decisions and tradeoffs.
- `docs/mcp-tooling.md`: local tool and MCP setup.

When a rule becomes important enough to repeat, promote it from chat into the right doc. When a rule becomes important enough to break production or security if missed, encode it as a test, lint, script, migration assertion, or CI check.

## Harness Principles

- Prefer small vertical slices with a clear validation path.
- Keep architectural decisions visible in docs and mechanically checked where practical.
- Make invalid states hard to express with typed contracts, schemas, enums, and helper functions.
- Keep agent entrypoints short and navigable.
- Keep provider setup instructions current and tied to official docs or local config examples.
- Treat failed agent work as a harness signal: missing context, missing tool access, missing fixture, missing test, or missing guardrail.

## Execution Discipline

### Think Before Coding

- Do not assume, and do not hide confusion. Surface tradeoffs before implementing.
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them instead of choosing silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop, name what is confusing, and ask.

### Simplicity First

- Write the minimum code that solves the problem. Do not add speculative features.
- Do not create abstractions for single-use code.
- Do not add flexibility or configurability that was not requested.
- Do not add error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.
- Ask: would a senior engineer say this is overcomplicated? If yes, simplify.

### Surgical Changes

- Touch only what is required. Clean up only your own mess.
- Do not improve adjacent code, comments, or formatting while editing existing code.
- Do not refactor code that is not broken.
- Match existing style, even if you would choose a different style.
- If unrelated dead code is noticed, mention it instead of deleting it.
- Remove imports, variables, or functions that your changes made unused.
- Do not remove pre-existing dead code unless explicitly asked.
- Every changed line should trace directly to the user's request.

### Goal-Driven Execution

- Define success criteria and loop until verified.
- Transform tasks into verifiable goals, such as: add validation means write tests for invalid inputs, then make them pass.
- Transform bug fixes into reproductions: write a test that reproduces the bug, then make it pass.
- For refactors, ensure tests pass before and after.
- For multi-step tasks, state a brief plan with each step and its verification check.
- Strong success criteria allow independent progress. Weak criteria require clarification.

## Mechanical Guardrails To Grow

The current repo has generic TypeScript linting and focused tests. Strengthen it incrementally with project-specific checks:

- Module boundaries: prevent frontend code from importing server-only modules, secrets, service-role clients, PayTR, Resend, or AI-service internals.
- Barrel entrypoints: keep `src/index.ts` package entrypoints as re-export-only files.
- API contracts: ensure public `/api/v1` routes validate request and response payloads through `packages/contracts`.
- Admin surfaces: prove admin pages, navigation, and API routes are denied to non-admin users and MFA-incomplete admin users.
- i18n: prevent user-facing frontend copy from bypassing route-independent translation keys except in explicitly allowed places.
- Docs freshness: require step docs to change when auth, admin, upload, matching, billing, provider config, or routing behavior changes.
- Sensitive data: scan for committed secrets, private manuscript text, signed URLs, service-role keys, PayTR secrets, Resend API keys, Sentry auth tokens, and Google service account keys.
- UI validation: after substantial frontend work, inspect real browser output for desktop and mobile layouts.

## Validation Commands

Use the narrowest check for the change:

- `npm run check:harness`: verifies this harness map and documentation wiring.
- `npm run lint`: lints TypeScript and React workspaces.
- `npm run typecheck`: type-checks TypeScript workspaces.
- `npm run test`: runs TypeScript workspace tests.
- `npm run build`: builds TypeScript workspaces.
- `npm run format:check`: checks formatting.
- `cd apps/ai-service && uv run ruff check .`: lints Python service code.
- `cd apps/ai-service && uv run mypy .`: type-checks Python service code.
- `cd apps/ai-service && uv run pytest`: runs AI service tests.

The root npm workspace commands do not cover the Python AI service. Run the `uv` commands whenever the AI service or shared behavior that affects it changes.

## Documentation Rules

Keep docs synchronized with behavior:

- Update `README.md` when setup, commands, local URLs, provider setup, or current-slice behavior changes.
- Update `docs/project-knowledge-base.md` when current status, recent decisions, blockers, or next recommended step changes.
- Update `docs/project-build-plan.md` when slice order, scope, deferred work, or validation strategy changes.
- Update the relevant `docs/architecture/*.md` file when architecture, security, data, provider, or operations behavior changes.
- Update ADRs only for durable decisions with real tradeoffs.

Auth documentation has a stricter rule: whenever signup, login, OAuth providers, callback URLs, or post-auth routing changes, update `README.md`, `docs/project-build-plan.md`, `docs/project-knowledge-base.md`, and `docs/architecture/auth-security-rls.md`.

## Review Loop

Before finishing a change, report:

- Completion status using one of these labels:
  - `Fully implemented`: the requested behavior works end-to-end through the intended path and was validated.
  - `Partially implemented`: meaningful parts are done, but some planned behavior remains.
  - `Scaffolded only`: structure, docs, contracts, or placeholders exist, but the feature is not usable end-to-end.
  - `Blocked`: work could not finish because of a concrete blocker.
- What changed.
- What is not finished, if completion status is anything other than `Fully implemented`.
- Which checks ran.
- Which checks could not run and why.
- Any remaining risk or follow-up that matters for the next slice.

For code review, lead with bugs, regressions, and missing tests. Summaries are secondary.

## User-Facing Completion Rule

A backend route, contract, migration, or service function is not a complete user-facing slice by itself. Before calling a user-visible flow complete, verify the full product path:

- Shared contract route exists and is used by the API.
- API behavior has positive and negative coverage for access-sensitive flows.
- Frontend client hook or service calls the route through the shared contract.
- A visible UI affordance exists for the user action.
- The local browser flow is smoke-tested from the actual screen when the feature is reachable in the web app.

If any layer is intentionally deferred, say that explicitly as an incomplete follow-up rather than presenting the backend slice as done.

Never describe a plan as implemented when only part of it is complete. If the requested plan has multiple phases or user-visible behaviors, list the completed phases and the unfinished phases plainly. A scaffold, migration, contract, queued state, or adapter interface is not a completed feature unless the core behavior works through the intended end-to-end path.
