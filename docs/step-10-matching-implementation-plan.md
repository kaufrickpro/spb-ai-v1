# Implementation Plan: Step 10 Matching Vertical Slice

## Current Implementation Note

As of 2026-05-08, GitHub issues #60-#65 are implemented on top of the #47-#56
matching foundation. Staging/production AI-service config now requires real
Vertex/Gemini matching settings and `/ready` fails closed when those
dependencies are incomplete. The AI service has Vertex text embedding and
Vector Search adapters, a signal sync worker, repository-backed
`MatchingWorker.process_run(match_run_id)`, Python three-axis soft scoring,
top-25 candidate and profile-access grant persistence, and strict top-10
Gemini explanation persistence. The deployed API path now creates runs, calls
the AI service with only `{ match_run_id }`, reads AI-persisted candidates, and
does not synthesize candidates on AI timeout/failure. Browser smoke coverage
now lives in `docs/step-10-matching-smoke-checklist.md`, and the first matching
eval fixture lives in `apps/ai-service/tests/fixtures/matching_eval.json`.

## Overview

Build match-revealed profile surfaces, manuscript access requests, public publisher directory approval, and bidirectional matching for authors and publishers using the ADR 0009 three-axis model. The first deliverable is a profile/access foundation that makes match results meaningful, followed by a synchronous match run that stores deterministic results, generates real Vertex/Gemini explanations for the top 10 candidates, exposes inspectable cards and dropdowns, and preserves stale match history under profile history.

## Requirements

- Support author-to-publisher matching from one eligible manuscript.
- Support publisher-to-manuscript matching from the publisher's general profile.
- Use manuscript `premise`, `voice`, and `arc` signals separately.
- Use publisher `guidelines`, optional `wishlist`, and optional `catalog` signals.
- Treat genre, audience, manuscript form, word count, and exclusion-topic conflicts as penalties and watch-outs, not hard filters.
- Store up to 25 visible candidates and generate LLM explanations for ranks 1-10.
- Keep ranks 11-25 inspectable through structured details.
- Create a new match run for every rematch and keep stale historical runs visible.
- Add match-revealed profile pages for publishers, authors, and manuscripts.
- Add a public `/publishers` directory that shows only admin-approved publisher logo, name, and `https` website.
- Add manual manuscript access requests so a matched publisher can ask an author to reveal another eligible manuscript profile.
- Show owner-approved match-visible contact fields after match or approved manuscript access, while keeping private contact and sample download behind accepted intro.
- Never use subscription plan as a hidden relevance boost.
- Never send full manuscript text, signed URLs, contact details, admin notes, secrets, or raw provider payloads to the browser or stored explanation fields.

## Architecture Changes

- `supabase/migrations/*`: add profile detail/public directory fields, manuscript teaser/access-request fields, match-visible contact visibility, Step 10 matching fields, `match_signal_sources`, bidirectional `match_runs`, and flexible `match_candidates`.
- `packages/contracts/src`: add profile detail schemas, public publisher directory schemas, manuscript access request schemas, match field schemas, route contracts, score bands, candidate detail payloads, history payloads, and OpenAPI coverage.
- `apps/api/src/modules/profiles`: add match-revealed profile access checks, profile detail responses, contact visibility mapping, and public publisher directory approval/read paths.
- `apps/api/src/modules/manuscripts`: add manuscript profile access checks, requestable teaser fields, and manuscript access request workflow.
- `apps/api/src/modules/matching`: add API-owned authorization, eligibility, rate limits, run lifecycle, persistence, and response mapping.
- `apps/api/src/modules/profiles` and `apps/api/src/modules/manuscripts`: extend profile and manuscript write/read services with matching-required fields.
- `apps/ai-service/app/modules/matching.py`: keep the private `{ match_run_id }` boundary and move the current API-owned scorer into an AI-service repository-backed three-axis orchestrator.
- `apps/ai-service/app/modules/retrieval.py`: add retrieval provider interfaces for axis-based candidate retrieval.
- `apps/ai-service/app/modules/explanations.py`: Vertex/Gemini explanation provider exists; next step is to connect it to stored candidate evidence and persist validated top-10 explanations from the AI service.
- `apps/ai-service/app/modules/supabase_repository.py`: add matching read/write repository methods for signals, candidates, snippets, and fingerprints.
- `apps/web/src/modules/marketing`: add the public publisher directory.
- `apps/web/src/modules/profiles`: add match-revealed publisher, author, and manuscript profile pages.
- `apps/web/src/modules/requests`: add manuscript access request tabs and actions.
- `apps/web/src/modules/manuscripts`, `apps/web/src/modules/profile`, and `apps/web/src/modules/matches`: collect matching fields, run matches, render results, and show profile history.

## Implementation Steps

### Phase 0: Profile And Access Foundation

1. **Add profile/access schema** (Files: `supabase/migrations/<timestamp>_step10_profile_access_foundation.sql`)
   - Action: add publisher public directory fields/status, publisher profile display fields, author profile display fields, match-visible contact fields/visibility, manuscript teaser/visibility fields, and `manuscript_access_requests`.
   - Why: matching unlocks profile pages, so the profile/access surface must exist before candidate links are useful.
   - Dependencies: none.
   - Risk: High, because profile visibility and contact visibility are privacy-sensitive.

2. **Add profile/access contracts** (Files: `packages/contracts/src/profiles.ts`, `packages/contracts/src/manuscripts.ts`, `packages/contracts/src/routes.ts`)
   - Action: define public publisher directory payloads, match-revealed publisher/author/manuscript profile payloads, contact visibility payloads, manuscript access request payloads, and redacted error shapes.
   - Why: access-controlled profile detail pages need stable shared contracts before API/UI work.
   - Dependencies: Phase 0 step 1.
   - Risk: Medium.

3. **Implement access source checker** (Files: `apps/api/src/modules/profiles/access.ts`, `apps/api/src/modules/manuscripts/access.ts`)
   - Action: centralize profile/manuscript visibility checks for owner, admin, approved manuscript access, future matched candidate access, and future accepted intro access.
   - Why: matched profile pages, manuscript access requests, and later intro unlocks need one auditable access model.
   - Dependencies: Phase 0 step 1.
   - Risk: High.

4. **Implement public publisher directory API** (Files: `apps/api/src/modules/profiles/registerProfileRoutes.ts`, `apps/api/src/modules/profiles/service.ts`)
   - Action: expose a logged-out-safe publisher directory that returns only logo, name, and valid `https` website for eligible publishers with admin-approved public directory status.
   - Why: pre-signin `/publishers` should prove supply exists without exposing full marketplace profiles.
   - Dependencies: Phase 0 steps 1-2.
   - Risk: Medium.

5. **Implement match-revealed profile APIs** (Files: `apps/api/src/modules/profiles/registerProfileRoutes.ts`, `apps/api/src/modules/manuscripts/registerManuscriptRoutes.ts`)
   - Action: add app-only publisher profile, author profile, and manuscript profile detail routes with current safe data plus match/access-specific evidence hooks.
   - Why: candidate names should link to profile pages after matching or access approval.
   - Dependencies: Phase 0 steps 2-3.
   - Risk: High.

6. **Implement manuscript access request workflow** (Files: `apps/api/src/modules/manuscripts/accessRequests.ts`, `apps/api/src/modules/manuscripts/registerManuscriptRoutes.ts`)
   - Action: let eligible publishers who discovered an author through matching request access to another requestable manuscript; let authors approve/reject; approval unlocks only the manuscript profile page for that publisher.
   - Why: author pages can show limited teasers for other requestable works without silently exposing full manuscript profiles.
   - Dependencies: Phase 0 steps 2-3. The discovered-through-matching branch becomes active after match candidates exist.
   - Risk: High.

7. **Build Phase 0 frontend pages** (Files: `apps/web/src/modules/marketing/*`, `apps/web/src/modules/profiles/*`, `apps/web/src/modules/requests/*`, `apps/web/src/App.tsx`)
   - Action: add public `/publishers` directory, app-only publisher/author/manuscript profile pages, match-visible contact rendering, manuscript teaser cards, and `/app/requests` manuscript access tab.
   - Why: Phase 0 must produce usable surfaces, not just schema.
   - Dependencies: Phase 0 steps 4-6.
   - Risk: Medium.

8. **Add admin public directory approval** (Files: `apps/api/src/modules/admin/*`, `apps/web/src/modules/admin/*`)
   - Action: add a lightweight admin approval queue/action for publisher public directory visibility, separate from general eligibility and safety review.
   - Why: logged-out publisher directory inclusion is platform/admin-approved, not publisher-controlled.
   - Dependencies: Phase 0 steps 1-4.
   - Risk: Medium.

### Phase 1: Matching Schema And Contracts

9. **Create Step 10 migration** (Files: `supabase/migrations/<timestamp>_step10_matching.sql`)
   - Action: add matching fields to `manuscripts` and `publisher_profiles`; create `match_signal_sources`, `match_runs`, and `match_candidates`; add indexes and service-role write posture.
   - Why: matching needs durable input shape, signal freshness, bidirectional run records, and stored candidate explanations.
   - Dependencies: none.
   - Risk: High, because RLS and nullable bidirectional fields can create accidental data exposure.

10. **Update shared contracts** (Files: `packages/contracts/src/matching.ts`, `packages/contracts/src/routes.ts`, `packages/contracts/src/index.ts`)

- Action: define match run request/response schemas, candidate schemas, history schemas, score bands, axis bands, explanation status, and error codes.
- Why: API and frontend need the same shape before route implementation.
- Dependencies: Phase 1 step 1 field decisions.
- Risk: Medium, because overfitting contract fields too early can leak internals.

11. **Regenerate OpenAPI coverage** (Files: `packages/contracts/openapi.json`, `packages/contracts/src/index.test.ts`)

- Action: add contract tests for match routes and OpenAPI emission.
- Why: route shape drift should fail visibly.
- Dependencies: Phase 1 step 2.
- Risk: Low.

### Phase 2: API Run Lifecycle

12. **Add matching API module** (Files: `apps/api/src/modules/matching/*`, `apps/api/src/server.ts`)

- Action: register `POST /api/v1/matches/run`, `GET /api/v1/matches`, `GET /api/v1/matches/:matchRunId`, and candidate detail routes.
- Why: browser matching must flow through the Node API.
- Dependencies: Phase 1.
- Risk: Medium.

13. **Implement authorization and eligibility gates** (Files: `apps/api/src/modules/matching/service.ts`, `apps/api/src/modules/eligibility/service.ts`)

- Action: enforce owner role, eligible profiles, eligible manuscripts/documents, publisher discoverability, entitlement checks, and rate limits.
- Why: AI scoring must not run for unauthorized or unavailable records.
- Dependencies: Phase 2 step 4.
- Risk: High, because this is access-sensitive.

14. **Persist runs and call AI service** (Files: `apps/api/src/modules/matching/service.ts`, `apps/api/src/modules/matching/aiClient.ts`)

- Action: create `running` match run, call the private AI service with `{ match_run_id }`, persist returned candidates, mark run `succeeded` or `failed`.
- Why: Node owns product state; AI owns scoring.
- Dependencies: Phase 2 step 5.
- Risk: High, because partial failure must not show incomplete results.

15. **Add history read model** (Files: `apps/api/src/modules/matching/historyService.ts`, `apps/api/src/modules/profiles/registerProfileRoutes.ts`)

- Action: expose profile history with match runs, stale badges, candidate counts, and view/rematch targets.
- Why: users must be able to inspect prior and stale runs.
- Dependencies: Phase 2 step 6.
- Risk: Medium.

### Phase 3: AI Service Matching

16. **Add matching repository methods** (Files: `apps/ai-service/app/modules/supabase_repository.py`, `apps/ai-service/app/modules/repositories.py`)

- Action: load match run source, eligible candidates, manuscript chunks, signal records, publisher preferences, and safe snippets; write signal records and candidate payloads as needed.
- Why: AI service should load data by trusted IDs, not receive raw browser payloads.
- Dependencies: Phase 1 schema.
- Risk: High, because repository methods must avoid full text leaks in outputs.

17. **Implement signal fingerprinting and embedding references** (Files: `apps/ai-service/app/modules/matching.py`, `apps/ai-service/app/modules/embeddings.py`)

- Action: compute fingerprints for premise, voice, arc, guidelines, wishlist, and catalog; upsert `match_signal_sources`; create/update `embedding_records` references.
- Why: rematch and stale-run behavior depend on stable source fingerprints.
- Dependencies: Phase 3 step 8.
- Risk: Medium.

18. **Implement retrieval and scoring** (Files: `apps/ai-service/app/modules/retrieval.py`, `apps/ai-service/app/modules/matching.py`)

- Action: retrieve top 50 per axis, merge candidates, score premise/voice/arc, normalize publisher signal weights, apply penalties, hide `< 0.35`, rank top 25.
- Why: this is the core matching behavior.
- Dependencies: Phase 3 step 9.
- Risk: High, because scoring mistakes create bad product trust.

19. **Implement Vertex/Gemini explanations** (Files: `apps/ai-service/app/modules/explanations.py`, `apps/ai-service/app/modules/config.py`)

- Action: configure real explanation provider, batch top-10 evidence, validate strict JSON response, and return one bounded paragraph per candidate.
- Why: explanations are part of the Step 10 product output.
- Dependencies: Phase 3 step 10.
- Risk: High, because provider failure must fail the run safely and prompts must not include unsafe data.

20. **Add internal matching endpoint** (Files: `apps/ai-service/app/main.py`, `apps/ai-service/app/api/*`)

- Action: expose private `POST /internal/matching/run` accepting `{ match_run_id }` only.
- Why: matches should preserve the browser -> Node API -> private AI service boundary.
- Dependencies: Phase 3 steps 8-11.
- Risk: Medium.

### Phase 4: Frontend Inputs And Results

21. **Extend manuscript forms** (Files: `apps/web/src/modules/manuscripts/ManuscriptForm.tsx`, `apps/web/src/modules/manuscripts/useManuscripts.ts`)

- Action: collect primary genre, subgenres, audience categories, manuscript form, logline, arc summary or chapter summaries, optional comp titles, themes, and content warnings.
- Why: authors must provide the matching signals before running matches.
- Dependencies: Phase 1 and manuscript API updates.
- Risk: Medium.

22. **Extend publisher profile form** (Files: `apps/web/src/modules/profile/ProfilePage.tsx`, profile hooks)

- Action: collect publisher name, accepted primary genres, accepted audience categories, accepted manuscript forms, submission guidelines, optional wishlist, optional acquisitions, and optional exclusions.
- Why: publisher-to-manuscript matching needs publisher signal data.
- Dependencies: Phase 1 and profile API updates.
- Risk: Medium.

23. **Build match run UI** (Files: `apps/web/src/modules/matches/*`, `apps/web/src/App.tsx`)

- Action: add run/rematch controls, loading/error states, ranked cards, top-10 paragraph explanations, structured dropdowns, and placeholder intro CTAs.
- Why: Step 10 must be usable through the product, not just backend routes.
- Dependencies: Phases 2-3.
- Risk: Medium.

24. **Build profile history UI** (Files: `apps/web/src/modules/profile/ProfileHistoryPage.tsx`, routing/i18n files)

- Action: add `/app/profile/history` with run list, stale badges, candidate count, view results, and rematch.
- Why: stale runs remain user-visible and inspectable.
- Dependencies: Phase 2 step 7.
- Risk: Low.

### Phase 5: Validation And Docs

25. **Add API tests** (Files: `apps/api/src/matching.test.ts`, matching module tests)

- Action: cover author run, publisher run, non-owner denial, ineligible records, stale fingerprints, top-10 explanation requirement, and failed explanation behavior.
- Why: matching is access-sensitive and trust-sensitive.
- Dependencies: Phases 1-3.
- Risk: High.

26. **Add AI service tests** (Files: `apps/ai-service/tests/test_matching.py`, `apps/ai-service/tests/test_explanations.py`)

- Action: cover scoring bands, penalties, signal freshness, candidate thresholding, safe prompt inputs, and provider response validation. Mock the provider boundary in tests; do not add a product fake explanation provider.
- Why: scoring and prompt safety need repeatable coverage.
- Dependencies: Phase 3.
- Risk: High.

27. **Add frontend tests and browser smoke** (Files: `apps/web/src/modules/matches/*.test.tsx`, `apps/web/src/modules/profile/*.test.tsx`)

- Action: cover form validation, run states, result cards, dropdowns, stale history, and role-specific redaction.
- Why: the user-facing slice needs visible proof.
- Dependencies: Phase 4.
- Risk: Medium.

28. **Refresh docs after implementation** (Files: `docs/project-knowledge-base.md`, `docs/project-build-plan.md`, architecture docs)

- Action: mark completed phases, record validation commands, and update blockers.
- Why: project state must stay accurate for the next agent/developer.
- Dependencies: Phase 5 validation.
- Risk: Low.

## Testing Strategy

- Contracts: `npm run test --workspace packages/contracts`, `npm run build --workspace packages/contracts`.
- API: `npm run test --workspace apps/api -- matching`, `npm run build --workspace apps/api`.
- AI service: `cd apps/ai-service && uv run pytest tests/test_matching.py tests/test_explanations.py`, plus `uv run ruff check .` and `uv run mypy .`.
- Frontend: `npm run test --workspace apps/web -- matches`, `npm run build --workspace apps/web`.
- Harness: `npm run check:harness`.
- Browser smoke: logged-out user sees `/publishers` with only logo/name/website; author and publisher profile pages deny unauthorized users; approved manuscript access unlocks only the manuscript profile; author creates/updates a manuscript, processes a sample, runs matches, inspects dropdowns, rematches after a field change, and views stale history; publisher runs general profile matching and inspects manuscript cards.

## Risks And Mitigations

- **Risk**: Explanations invent facts.
  - Mitigation: generate only from bounded structured evidence, validate response schema, store model/prompt versions, and test prompt inputs for forbidden data.
- **Risk**: Soft penalties surface unsafe or absurd matches.
  - Mitigation: use a visibility threshold, prominent watch-outs, and score-band regression fixtures.
- **Risk**: Bidirectional candidate schema leaks private data.
  - Mitigation: centralize response mappers and add negative tests for role-based redaction.
- **Risk**: Match-revealed profile pages become public profiles by accident.
  - Mitigation: use app-only routes, centralized access checks, and negative tests for unauthenticated and unmatched viewers.
- **Risk**: Match-visible contact fields expose private account contact.
  - Mitigation: store explicit per-field visibility and never infer visibility from field existence.
- **Risk**: Public `/publishers` bypasses marketplace profile boundaries.
  - Mitigation: return only admin-approved logo, name, and `https` website.
- **Risk**: Match history becomes confusing after edits.
  - Mitigation: store input snapshots and fingerprints; show stale badges and always create new rematch runs.
- **Risk**: Vertex/Gemini provider config blocks local iteration.
  - Mitigation: tests mock the provider boundary, while any end-to-end local smoke requires real provider config.

## Success Criteria

- [ ] Authors can run matches for an eligible processed manuscript and see publisher candidates.
- [ ] Publishers can run a general profile match and see manuscript candidates.
- [ ] Logged-out users can view `/publishers` with only admin-approved publisher logo, name, and website.
- [ ] Match-revealed publisher, author, and manuscript profile pages deny unmatched viewers.
- [ ] Manuscript access requests are manual, publisher/manuscript-specific, and unlock only the manuscript profile.
- [ ] Match-visible contact fields are explicit and do not expose private account contact or sample downloads.
- [ ] Top 10 candidates have stored real LLM explanations; ranks 11-25 have structured inspectable details.
- [ ] Broad editorial mismatches are penalties/watch-outs, not hard filters.
- [ ] Prior runs remain visible under `/app/profile/history` and become stale after relevant input changes.
- [ ] Rematch creates a new run and does not overwrite old results.
- [ ] Exact scores stay internal; users see bands and explanations.
- [ ] Provider prompts and stored explanation evidence exclude full manuscripts, signed URLs, contact details, secrets, and admin notes.
- [ ] Narrow validation commands pass, including contracts, API, AI service, frontend, and harness checks relevant to the change.
