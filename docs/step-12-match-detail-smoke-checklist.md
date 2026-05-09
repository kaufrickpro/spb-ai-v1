# Step 12 Match Detail Smoke Checklist

Use this after applying `supabase/migrations/20260509120000_step12_match_detail_snapshot.sql`
and deploying the API, web, and AI service built from the Step 12 code.

## Prerequisites

- Step 10 matching/access migrations are applied.
- `supabase/migrations/20260508213000_step11_intro_requests.sql` is applied.
- `supabase/migrations/20260509120000_step12_match_detail_snapshot.sql` is applied.
- AI service has valid Supabase service-role, Vertex embedding/vector search,
  and Gemini explanation configuration.
- A requester account has an eligible profile, an eligible manuscript/sample or
  eligible publisher profile, and can run matching.

## Browser Flow

1. Run a new match from `/app/matches`.
2. Confirm match cards stay compact:
   - score band and premise/voice/arc bands render
   - top-10 generated explanation renders when available
   - only short fit/watch-out previews render
   - profile, detail, and intro actions render
   - full comparison rows, full snippets, limitations, and axis evidence do not
     render inline on cards
3. Open one candidate detail page.
4. Confirm Overview:
   - score band and axis bands render
   - generated explanation renders only for top-10 generated explanations
   - publisher/manuscript pair context renders from stored detail
   - intro action/state renders
   - accepted-intro contact and sample download controls are absent
5. Confirm Comparison:
   - genre/subgenres, audience, manuscript form, language, word count, themes,
     and content warnings render when present in stored detail
   - statuses are `match`, `partial`, `mismatch`, or `unknown`
   - missing optional wishlist/catalog data reads as unknown/limited, not as a
     hard failure
6. Confirm Evidence:
   - premise, voice, and arc sections render
   - source-labeled snippets render with bounded source types
   - no vectors, embedding ids, raw distances, prompts, provider payloads, full
     sample text, or document chunks appear
7. Confirm Watch-outs / limitations:
   - watch-outs render from stored detail
   - limitations render when present
8. For a stale run, open candidate detail and confirm:
   - stale warning appears
   - warning says evidence is from the original run
   - rematch path links to existing profile history/rematch behavior
   - opening the old detail does not mutate or recompute it
9. For a pre-Step-12 candidate row without `detail_snapshot`, confirm:
   - candidate detail still opens
   - fallback limitation `detail_snapshot_unavailable` appears
   - snippets have `sourceType = unknown`
   - no live profile/manuscript reconstruction appears
10. Search rendered page text/network payloads for forbidden markers:
    - `scoreDebug`, `finalScore`, `rawScore`
    - `vector`, `embedding`, `providerPayload`, `prompt`
    - `signedUrl`, `downloadUrl`, `token`
    - private email/phone/contact fields
    - full synopsis, chapter summaries, full sample text, document chunks
    - admin notes or billing state

## Focused Local Validation Commands

```sh
npm run test --workspace packages/contracts
npm run test --workspace apps/api -- matching
npm run test --workspace apps/web -- MatchCandidate
cd apps/ai-service && uv run ruff check .
cd apps/ai-service && uv run mypy .
cd apps/ai-service && uv run pytest tests/test_matching_worker.py tests/test_supabase_repository.py
npm run check:harness
```
