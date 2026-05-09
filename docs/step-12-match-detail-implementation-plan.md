# Step 12 Match Detail Implementation Plan

## Summary

Build the full match detail view as a synchronous, deterministic read over stored
match candidate data. Step 12 deepens the existing candidate detail route and
page; it does not add report jobs, generated narrative reports, PDF exports, or
detail-time LLM calls.

Implementation status: locally implemented for GitHub issues #75-#82 on
2026-05-09. The shipped slice adds the database column/guards, shared Zod
contracts, AI-service Pydantic validation and writer support, API detail mapping
with legacy fallback, compact match cards, a full candidate detail page, focused
redaction/access tests, and this documentation refresh.

The detail model is historical snapshot first. New matches should persist a
safe `match_candidates.detail_snapshot` JSONB read model for every visible
candidate. The API returns that richer shape only from
`GET /api/v1/matches/:matchRunId/candidates/:candidateId`; match run/card
responses stay light.

Remote migration required: apply
`supabase/migrations/20260509120000_step12_match_detail_snapshot.sql` after the
Step 10 matching/access migrations and
`supabase/migrations/20260508213000_step11_intro_requests.sql`.

## Locked Decisions

- Match detail is built from stored `match_candidates` data. The only live
  computed field on the detail response is `introState`.
- The candidate detail endpoint is enriched in place. Do not add a separate
  `/detail` endpoint.
- `GET /api/v1/matches/:matchRunId` keeps returning card-level candidates. The
  heavier detail payload is returned only by the candidate detail endpoint.
- The detail model is normalized around one manuscript-publisher pair, regardless
  of match direction.
- Candidate detail access remains requester-owned. Accepted intro does not grant
  the counterparty access to the requester's match-run detail.
- Cards stay compact. The candidate detail route becomes the primary full-detail
  surface.
- Step 12 may show intro request state/action, but accepted-intro contact and
  sample download stay on request, profile, and manuscript surfaces.
- No admin diagnostics are added to the user-facing candidate detail contract.

## Data Model

Add `public.match_candidates.detail_snapshot jsonb` in a forward migration.

`detail_snapshot` is the safe, deterministic read model for the match detail
page. It is required for every newly persisted visible candidate, including
ranks 11-25. Ranks 1-10 still require a generated explanation paragraph; ranks
11-25 use structured detail without an LLM paragraph.

Keep `score_details` for existing card-adjacent safe facts such as title,
subtitle, profile links, and penalties while migrating rich user-facing detail
into `detail_snapshot`.

Remove raw numeric score debug data from new writes. Add a forward cleanup:

```sql
update public.match_candidates
set score_details = score_details - 'scoreDebug'
where score_details ? 'scoreDebug';
```

Add a durable check forbidding new `scoreDebug` writes:

```sql
alter table public.match_candidates
  add constraint match_candidates_score_details_no_score_debug
  check (not (score_details ? 'scoreDebug'));
```

Database validation should stay lightweight:

- `detail_snapshot` defaults to `{}` and must be a JSON object.
- Add targeted forbidden-key protection for obvious top-level hazards.
- Full shape validation lives in Pydantic and Zod contracts.
- Recursive sensitive-data safety is enforced by AI-service writer tests, API
  mapper tests, contract tests, and harness checks where applicable.

Forbidden content includes signed URLs, download URLs, private contact details,
email/phone values, provider payloads, prompts, embeddings, vectors, raw scores,
full manuscript text, document chunks, admin notes, secrets, and unreleased
relationship data.

## Detail Contract Shape

Define the snapshot shape in both places:

- Python/Pydantic: AI service writer validation before candidate insertion.
- TypeScript/Zod: shared API/frontend response validation.

Add `MatchCandidateDetailSchema = MatchCandidateSchema.extend({ detail:
MatchDetailSnapshotSchema })`. `MatchCandidateResponseSchema` should use
`MatchCandidateDetailSchema`, while `MatchRunResponseSchema` continues to use
`MatchCandidateSchema[]`.

The snapshot should use stable keys/statuses/values, not localized labels. The
frontend owns Turkish/English labels through i18n. Deterministic comparison
notes should use `noteCode` plus safe `noteParams`; bounded signal summaries may
remain text.

Recommended shape:

```ts
type MatchDetailSnapshot = {
  pair: {
    manuscriptId: string | null;
    manuscriptTitle: string | null;
    publisherProfileId: string | null;
    publisherName: string | null;
    sourceSide: "manuscript" | "publisher";
  };
  publisherContext: {
    acceptedGenres: string[];
    acceptedAudienceCategories: string[];
    acceptedManuscriptForms: string[];
    excludedTopics: string[];
    guidelinesSummary: string | null;
    wishlistSummary: string | null;
    catalogSummary: string | null;
  } | null;
  manuscriptContext: {
    genre: string | null;
    subgenres: string[];
    audienceCategories: string[];
    manuscriptForm: string | null;
    language: string | null;
    wordCount: number | null;
    themes: string[];
    declaredContentWarnings: string[];
    logline: string | null;
    teaser: string | null;
  } | null;
  comparison: ComparisonRow[];
  axisEvidence: {
    premise: AxisEvidence;
    voice: AxisEvidence;
    arc: AxisEvidence;
  };
  evidence: {
    fitReasons: string[];
    watchOuts: string[];
    safeSnippets: DetailSnippet[];
  };
  limitations: string[];
};
```

Comparison row statuses are `match`, `partial`, `mismatch`, and `unknown`.
Use `unknown` when either side lacks enough declared data. Missing optional
publisher wishlist/catalog data is neutral `unknown`, not a watch-out.

Comparison rows should cover only matching-relevant fields or watch-out
explainers:

- genre/subgenres
- audience categories
- manuscript form
- submitted word count plus interpreted status
- language when available
- themes
- declared content warnings versus publisher excluded topics

Do not compare decorative profile fields, biographies, websites, logos, display
names, or billing/subscription data.

## Content Rules

Use bounded summaries and selected metadata, not raw long-form/private text.

Allowed examples:

- submitted manuscript metadata
- capped logline or profile/short teaser
- author-declared content-warning labels
- publisher accepted genres/audiences/forms
- publisher excluded topics when they explain a declared-preference conflict
- bounded signal summaries for guidelines, wishlist, and catalog
- bounded safe snippets

Disallowed examples:

- full synopsis
- chapter summaries
- full sample text
- extracted document chunks
- signed sample URLs
- private contact fields
- raw publisher internal notes
- raw provider prompts or payloads
- raw numeric scores or vector distances

Publisher catalog/recent-acquisition evidence may be shown only as bounded,
match-safe summaries. Do not expose private acquisition notes, staff notes,
sales data, hidden imprints, or anything outside match-safe publisher profile
data.

Safe snippets should gain an optional `sourceType` on the existing base snippet
schema for backward compatibility. In new `detail_snapshot` snippets, require a
bounded source type such as:

- `manuscript_metadata`
- `manuscript_sample`
- `publisher_guidelines`
- `publisher_wishlist`
- `publisher_catalog`
- `unknown`

## Axis Evidence

The detail view should explain `premise`, `voice`, and `arc` without exposing
raw vectors, distances, or provider internals.

Axis evidence is manuscript-axis-first and should also show the publisher signal
that contributed:

```ts
{
  band: "strong",
  manuscriptSignal: "premise",
  publisherSignal: "guidelines",
  manuscriptSummary: "...",
  publisherSummary: "...",
  reasons: [...]
}
```

Store bounded summaries directly in `detail_snapshot`, not references to mutable
`match_signal_sources` rows. This preserves the historical evidence used at run
time and keeps stale-run behavior understandable.

## Fallback For Old Rows

Older candidates may not have `detail_snapshot`. Keep a small permanent
compatibility branch that synthesizes a limited detail response from existing
card fields only:

- pair IDs/titles where available from existing safe fields
- axis bands
- fit reasons
- risk reasons/watch-outs
- safe snippets, with `sourceType = "unknown"` when needed
- `limitations: ["detail_snapshot_unavailable"]`

Do not join live profile/manuscript tables to reconstruct a rich historical
snapshot for old rows.

## UI Plan

Candidate detail should use major tabs:

- Overview
- Comparison
- Evidence
- Watch-outs / limitations

The first view should immediately show the score band, stale-run warning when
`run.stale` is true, intro action/state, generated explanation when present, and
the highest-signal comparison/watch-out summary.

Use compact accordions only inside evidence-heavy areas such as axis evidence
and snippets. Cards on the run page should be reduced to high-signal previews:

- score/axis bands
- explanation paragraph when available
- first two fit reasons
- first two watch-outs
- profile/detail/intro actions

## Implemented Files

- Database: `supabase/migrations/20260509120000_step12_match_detail_snapshot.sql`
  adds `detail_snapshot`, strips old `scoreDebug`, forbids new `scoreDebug`, and
  adds lightweight JSON safety checks.
- Contracts: `packages/contracts/src/matching.ts` defines
  `MatchDetailSnapshotSchema`, `MatchCandidateDetailSchema`, comparison rows,
  axis evidence, source-labeled snippets, and keeps `MatchRunResponseSchema`
  light.
- AI service: `apps/ai-service/app/modules/match_detail.py` builds and validates
  the stored snapshot; `matching_worker.py` attaches it before candidate insert;
  `supabase_repository.py` persists it.
- API: `apps/api/src/modules/matching/supabaseMatchingService.ts` has a real
  candidate-detail path; `dbMappers.ts` validates stored details and creates the
  limited `detail_snapshot_unavailable` fallback for old rows.
- Web: `MatchCandidateSummary.tsx` keeps cards compact; `MatchCandidatePage.tsx`
  renders overview, comparison, evidence, source-labeled snippets, stale warning,
  limitations, and intro state/action from the detail response.

## Validation Record

Focused checks run locally on 2026-05-09:

- `npm run typecheck --workspace packages/contracts`
- `npm run typecheck --workspace apps/api`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace packages/contracts`
- `npm run test --workspace apps/api -- matching`
- `npm run test --workspace apps/web -- MatchCandidate`
- `cd apps/ai-service && uv run ruff check .`
- `cd apps/ai-service && uv run mypy .`
- `cd apps/ai-service && uv run pytest tests/test_matching_worker.py tests/test_supabase_repository.py`

The narrower attempted command
`npm run test --workspace packages/contracts -- matching` returned “No test
files found” because the contracts package has a single `src/index.test.ts`
file; the unfiltered package test was run and passed.

Pending remote validation: apply the Step 12 migration in staging, run a real
AI-service-backed match against configured Vertex/Gemini, open a new candidate
detail page, and smoke legacy fallback behavior against a pre-Step-12 candidate
row if one exists.

When `run.stale` is true, candidate detail should show a small warning that the
page reflects stored evidence from the run date. Rematch may be offered directly
if it can safely reuse the existing match run action; otherwise link back to the
existing run/history rematch surface. Rematch always creates a new run.

## Implementation Slices

1. Add migration for `detail_snapshot`, `scoreDebug` cleanup, score debug check,
   and lightweight JSON object/forbidden-key checks.
2. Add Zod contracts for `MatchDetailSnapshotSchema`,
   `MatchCandidateDetailSchema`, comparison rows, axis evidence, and detail
   snippets.
3. Add Pydantic models for the same snapshot shape in the AI service.
4. Update the AI matching worker to build and validate `detail_snapshot` for
   every visible candidate and stop writing `scoreDebug`.
5. Update the Supabase matching repository to persist `detail_snapshot`.
6. Update the API mappers so run responses stay light and candidate detail
   responses include `detail` with fallback for old rows.
7. Update the frontend candidate detail page to render tabs and reduce card
   inline detail on match run pages.
8. Refresh docs and validation notes.

## Testing And Validation

Start with AI-service tests, then move outward:

- `cd apps/ai-service && uv run pytest tests/test_matching_worker.py`
- `cd apps/ai-service && uv run pytest tests/test_supabase_repository.py`
- `npm run test --workspace packages/contracts -- matching`
- `npm run test --workspace apps/api -- matching`
- `npm run test --workspace apps/web -- MatchCandidate`

Required coverage:

- Matching worker produces a valid `detail_snapshot` for every visible
  candidate, including ranks 11-25.
- Matching worker does not write `scoreDebug`.
- Invalid snapshot drops the candidate before insertion; if no candidates remain,
  the run fails. Existing top-10 explanation failures still fail the run.
- Repository persists `detail_snapshot`.
- API candidate detail response includes `detail`; run response remains light.
- Old rows without `detail_snapshot` return the limited fallback with
  `detail_snapshot_unavailable`.
- No browser response exposes raw scores, vectors, embeddings, prompt text,
  provider payloads, signed URLs, private contact, manuscript chunks, full
  synopsis, chapter summaries, or full sample text.
- Frontend renders stale warning, intro action/state, comparison rows, axis
  evidence, snippets with source labels, and limitations without overlapping or
  overflowing text.

## Out Of Scope

- Report jobs.
- Generated narrative reports.
- PDF exports.
- Google ADK workflows.
- Detail-time LLM calls.
- Admin-only diagnostics.
- Shared counterparty access to requester-owned match details.
- New publisher accepted-language onboarding fields.
- Exposing accepted-intro contact or sample download controls on match detail.
