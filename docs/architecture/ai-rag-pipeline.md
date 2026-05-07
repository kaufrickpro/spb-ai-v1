# AI And RAG Pipeline Architecture

## Summary

The AI service is a FastAPI application responsible for document ingestion, chunking, embeddings, RAG retrieval, and match ranking. The Node API orchestrates jobs; the browser does not call the AI service directly.

The current runtime uses an app factory (`create_app`) and a runtime Adapter selected from typed config. `/health` reports process health. `/ready` reports whether the configured local or Vertex runtime Adapter is ready to accept work.

Local development may fake external providers, but it must preserve the production service shape. The browser calls the Node API, the API creates durable processing jobs, and an internal worker or AI service processes those jobs asynchronously. Do not build local-only flows that parse documents directly inside user upload requests.

## Service Boundaries

```txt
apps/ai-service/
  app/
    main.py
    api/
    ingestion/
    retrieval/
    matching/
    modules/runtime.py
    repositories/
    settings.py
```

## Ingestion Flow

1. Author uploads a manuscript sample through an API-issued signed URL.
2. Node API creates a `documents` row and, after upload completion, creates or reuses an idempotent `document_processing_jobs` row.
3. The document moves into an async checking state; the upload request must not wait for full AI processing.
4. A trusted worker calls the FastAPI ingestion endpoint with the durable job id.
5. AI service resolves the job and document through its repository adapter, then downloads the file through trusted credentials or an internal short-lived URL.
6. AI service extracts text, chunks it, writes bounded chunks to `document_chunks`, creates embedding reference records in `embedding_records`, and updates job/document status.

The internal ingestion endpoint must not accept raw document text from the caller. It processes the uploaded object through configured repository, storage, and embedding-reference adapters so local/dev fakes keep the same boundary as staging and production.

In staging and production, Cloud Tasks calls `POST /internal/ingestion/run` with `{ job_id }` only. The task must not include manuscript text, signed URLs, user JWTs, service-role keys, or GCS credentials.

The first Step 9 implementation supports `text/plain` only. Digital PDF, DOCX, and EPUB parsers are planned behind the same parser interface. OCR/Document AI is deferred unless explicitly requested.

### Environment Split

- Local/dev: local file storage and fake signed URLs stand in for private GCS; the API local processor command `npm run documents:process --workspace apps/api -- <limit>` claims queued jobs and calls the AI service with only `{ job_id }`; the AI service local worker reads Supabase job/document rows, reads bytes from `LOCAL_STORAGE_ROOT`, scans through the fake scanner adapter, and writes chunks plus embedding references back to Supabase for clean text samples; fake embeddings write deterministic reference metadata only; AI calls use `AI_INTERNAL_TOKEN`.
- Staging/production: files live in private GCS with `STORAGE_PROVIDER=gcs` and `GCS_BUCKET_PRIVATE_UPLOADS`; Cloud Tasks calls the private Cloud Run AI service with OIDC; AI service authentication uses Cloud Run IAM/OIDC; the AI service reads document bytes from private GCS through its service identity, not through public buckets or browser-provided signed URLs. Step 9 stores reference-only embedding records. Step 10 owns the full three-axis matching model, real Vertex/Gemini explanation generation, and Vertex AI embeddings/Vector Search behind provider adapters as the production retrieval target.
- Local/dev may simulate scanner outcomes with the fake scanner adapter through `LOCAL_FAKE_SCANNER_RESULT`. Staging/production must configure real malware/safety scanning with `DOCUMENT_SCANNER_MODE=real`, `DOCUMENT_SCANNER_PROVIDER=http-clamav`, `DOCUMENT_SCANNER_ENDPOINT`, `DOCUMENT_SCANNER_TOKEN`, and `DOCUMENT_SCANNER_TIMEOUT_SECONDS`, or carry a named explicit launch decision in `DOCUMENT_SCANNER_LAUNCH_DECISION_ID` before accepting real user documents. Deployed environments must not use local simulation outcomes such as fake `clean`, fake `suspicious`, or fake `quarantined`.

### Local Validation

The repeatable Step 9 local validation path is covered by focused automated checks:

- `npm run test --workspace apps/api -- localDocumentProcessingFlow` exercises author manuscript creation, sample upload, upload completion, queued job creation, local processor dispatch, processed/failed document query states, and the rule that ordinary user-correctable failures do not create default admin exceptions.
- `cd apps/ai-service && uv run pytest tests/test_local_validation_flow.py` exercises the local worker reading stored text bytes, writing bounded chunks, writing reference-only embedding records, and recording user-safe failure outcomes without storing chunks for empty text.

As of 2026-05-06, Step 9 foundation validation passes with `npm run test --workspace apps/api -- localDocumentProcessingFlow` and `cd apps/ai-service && uv run pytest tests/test_config.py tests/test_ingestion.py tests/test_scanner.py tests/test_local_validation_flow.py`.

For a real local Supabase smoke run, start the API and AI service with matching `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOCAL_STORAGE_ROOT`, and `AI_INTERNAL_TOKEN`; upload and complete a `text/plain` sample through the author manuscript UI or API; then run `npm run documents:process --workspace apps/api -- 1`. Verify the document reaches `processing_status = 'succeeded'` or a safe failure state, and for a successful text sample verify rows exist in `document_chunks` and `embedding_records`.

Current staging target values:

- GCP project: `spb-ai`
- Region: `europe-west3`
- Private manuscript bucket: `spb-ai-staging-manuscripts`
- Cloud Tasks queue: `document-processing-staging`
- API Cloud Run service: `spb-api-staging`
- AI service Cloud Run service: `spb-ai-service-staging`
- API service account: `spb-api-staging@spb-ai.iam.gserviceaccount.com`
- AI service account: `spb-ai-service-staging@spb-ai.iam.gserviceaccount.com`
- Cloud Tasks invoker service account: `spb-cloud-tasks-staging@spb-ai.iam.gserviceaccount.com`

### Scanner Policy

The AI service scans downloaded bytes through a `DocumentScanner` boundary before parsing. The scanner receives file bytes and safe file metadata only; the parser, chunker, and embedding adapters run only after the scanner returns a clean result.

Local/dev can use the fake scanner adapter to simulate `not_scanned`, `clean`, `suspicious`, `quarantined`, and `scanner_failed` outcomes. Real scanning uses `DOCUMENT_SCANNER_PROVIDER=http-clamav` with `DOCUMENT_SCANNER_ENDPOINT`, `DOCUMENT_SCANNER_TOKEN`, and `DOCUMENT_SCANNER_TIMEOUT_SECONDS`.

Scanner job metadata must remain safe and bounded to `scanner`, `scanner_result`, `scanner_version`, `scanner_signature`, and `scanner_error_type`. Do not store raw scanner responses, file bytes, signed URLs, tokens, or manuscript text in metadata, logs, or admin exception details.

Scanner outcomes map to admin exceptions as follows:

- `clean`: no scanner-driven admin exception.
- `suspicious`: ingestion stops before parsing with `scanner_suspicious`; no chunks or embedding records are written, and the document enters Needs Review.
- `quarantined`: ingestion stops before parsing with `scanner_suspicious`; no chunks or embedding records are written, and the document enters Quarantine.
- Provider errors, HTTP failures, timeouts, malformed payloads, and unknown scanner response values: ingestion fails as retryable `scanner_failed` and writes no chunks or embedding records. A System Failures admin exception is created only after automatic retries are exhausted.
- `not_scanned`: local/dev fake result, or a deployed explicit launch exception; it must not be treated as clean for launch readiness.

No scanner container or repo-owned scanner deployable is introduced in Step 9c. Live malware protection still requires a private scanner endpoint, or a documented launch-decision escape hatch before accepting real user documents.

### Ingestion Result Policy

- Successful Step 9 ingestion marks the document processed and stores evidence for later eligibility. Step 10 owns full matching/discovery eligibility.
- Ordinary user-correctable failures, such as empty text, unsupported type during the text-only phase, too-large extracted text, or corrupt files, fail the document with a safe reason code and do not create default admin work.
- Admin exceptions are reserved for suspicious scanner signals, quarantine, file type mismatch/validation bypass, repeated system/provider failures after automatic retries, and unexpected runtime errors. Scanner provider errors, timeouts, and invalid responses use the safe `scanner_failed` code.
- Author-facing copy must use simple terms such as "Checking your sample", "Sample ready", and "We couldn't read this file". Do not show users internal terms such as ingestion, chunking, embeddings, parser, job, GCS, Cloud Tasks, provider, or pipeline.

Initial V1 limits:

- Maximum manuscript sample upload size: 25 MB.
- Maximum extracted characters per sample used for matching: 250,000.
- Maximum chunks per document: 300.
- Ingestion timeout: 5 minutes per document.
- Matching timeout: 60 seconds per run.
- Maximum returned candidates per match run: 25.

## Matching Flow

Inputs:

- Manuscript metadata: primary genre, subgenres, audience categories, manuscript form, word count, logline, synopsis, arc summary or chapter summaries, optional comp titles, declared themes, and declared content warnings.
- Approved manuscript sample chunks for voice evidence and safe source snippets.
- Publisher preferences: publisher name, accepted primary genres, accepted audience categories, accepted manuscript forms, submission guidelines, optional editor wishlists, optional recent acquisitions, optional excluded topics, and optional positioning notes.
- Three manuscript signal embeddings: `premise`, `voice`, and `arc`.
- Publisher signal embeddings: `guidelines`, optional `wishlist`, and optional `catalog`.

Steps:

1. Validate platform gates: requester access, profile eligibility, manuscript eligibility where applicable, processed sample availability for manuscript candidates, publisher discoverability, entitlement checks, and rate limits.
2. Run three semantic retrieval paths, one each for `premise`, `voice`, and `arc`, then merge and de-duplicate candidates.
3. Score each candidate by axis and publisher signal. Normalize publisher-side semantic weights across available signals. When all publisher signals exist, start with wishlist `0.40`, catalog `0.30`, and guidelines `0.30`.
4. Apply structured penalties instead of broad hard filters. Genre mismatch, audience mismatch, manuscript-form mismatch, word-count concerns, and high-confidence exclusion-topic hits are watch-outs and score penalties, not candidate removal.
5. Hide candidates with final score below `0.35`, store up to 25 visible candidates, and generate real Vertex/Gemini LLM explanations for the top 10 only.
6. Store `match_runs`, `match_candidates`, input fingerprints, snapshots, score breakdowns, penalties, snippets, and explanation metadata.

Current tracer status: the Node API now calls the private AI service at
`POST /internal/matching/run` with `{ match_run_id }` only, then persists safe
deterministic candidates for both directions. The AI endpoint is currently a
placeholder boundary and does not yet perform retrieval, scoring, embeddings, or
Vertex/Gemini explanation generation.

Do not use paid subscription status as a hidden relevance boost.

Persist version metadata with every run:

- `matching_algorithm_version`
- `constraint_policy_version`
- `embedding_model`
- `explanation_version`
- `explanation_model`
- `weight_profile`

## Match Detail Output

V1 exposes match detail data directly from stored match candidates instead of generating separate AI reports.

Match detail output must include:

- score band
- one-paragraph LLM explanation for top-10 candidates
- premise, voice, and arc bands
- strong fit reasons
- weak fit or mismatch reasons
- structured penalties and watch-outs
- source snippets
- publisher preference context
- manuscript metadata comparison
- intro request CTA state

Ranks 11-25 remain inspectable through structured score details, fit reasons, watch-outs, and snippets, but do not require a stored LLM paragraph in Step 10. AI-generated fit reports, report agents, PDF exports, Google ADK workflows, comp-title catalog resolution, and specific editor-wishlist query runs are deferred to V1.5.

## Evaluation

Create AI eval fixtures with known manuscript/publisher pairs:

- expected top-k publisher candidates
- expected reject/mismatch reasons
- expected citation/source snippet quality
- match detail completeness checklist

## Open Questions

- Which embedding model should be used for Turkish and English content?
