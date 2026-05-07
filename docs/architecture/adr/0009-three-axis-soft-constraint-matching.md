# ADR 9: Use Three-Axis Matching With Soft Constraints

## Status

Accepted

## Context

The Step 10 matching slice needs to recommend publishers for manuscripts and manuscripts for publishers in a way that is explainable, auditable, and useful for ambiguous editorial taste. Early matching notes treated genre, audience, form, exclusions, and semantic similarity as one broad matching problem. That risks two failures:

- structured constraints such as manuscript form and audience get fuzzed by embeddings
- soft editorial signals such as voice and market positioning get hidden inside one averaged vector

Publishers also evaluate different manuscript dimensions independently. Premise, voice, and narrative arc often do not correlate, and collapsing them into one embedding loses precision.

## Decision

Use a three-axis matching model that keeps structured constraints separate from semantic signals until final scoring.

Manuscripts have three semantic signals:

- `premise`: logline, synopsis, and later resolved comp-title context
- `voice`: uploaded sample/opening pages and selected document chunks
- `arc`: author-provided arc summary or chapter summaries, with sample-derived evidence used only as support

Publisher profiles have semantic signals:

- `guidelines`: submission guidelines and stable acquisition criteria
- `wishlist`: optional editor wishlist or current acquisition interest
- `catalog`: optional recent acquisitions or catalog positioning

Hard gates are limited to platform and availability requirements: eligible profile, eligible manuscript where applicable, successfully processed sample for manuscript candidates, discoverable publisher profile, and rate limits. Genre mismatch, audience mismatch, manuscript-form mismatch, word-count concerns, and high-confidence exclusion-topic hits are large penalties and prominent watch-outs, not hard filters.

Run three retrieval paths, merge candidates, score each axis, apply penalties, hide candidates below the visibility threshold, store the top 25 visible candidates, and generate real Vertex/Gemini LLM explanations for the top 10. Ranks 11-25 remain inspectable through structured score details, reasons, penalties, and snippets, but do not require an LLM paragraph in Step 10.

Support both directions in Step 10:

- author-to-publisher runs from an eligible manuscript
- publisher-to-manuscript runs from the publisher's general profile

Every run creates a new `match_runs` record. Match-relevant input fingerprints and snapshots are stored on the run. When source data changes, older runs become stale but remain visible in profile history.

## Consequences

- Matching explanations can say why a candidate fits by premise, voice, and structure instead of presenting one opaque score.
- Candidates are not silently removed for editorial preference mismatches; they are penalized and explained.
- The schema needs explicit signal tracking through `match_signal_sources` in addition to `embedding_records`.
- Real explanation generation becomes a required Step 10 dependency. Tests may mock the provider boundary, but the product path should not include a fake explanation provider.
- Vertex AI Vector Search remains the production retrieval target. Step 10 can build the full model shape before all vector index operations are production-wired, but explanations use the real Vertex/Gemini provider path.
