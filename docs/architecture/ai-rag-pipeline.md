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

- Local/dev: local file storage and fake signed URLs stand in for private GCS; the API local processor command `npm run documents:process --workspace apps/api -- <limit>` claims queued jobs and calls the AI service with only `{ job_id }`; the AI service local worker reads Supabase job/document rows, reads bytes from `LOCAL_STORAGE_ROOT`, and writes chunks plus embedding references back to Supabase; fake embeddings write deterministic reference metadata only; AI calls use `AI_INTERNAL_TOKEN`.
- Staging/production: files live in private GCS with `STORAGE_PROVIDER=gcs` and `GCS_BUCKET_PRIVATE_UPLOADS`; Cloud Tasks calls the private Cloud Run AI service with OIDC; AI service authentication uses Cloud Run IAM/OIDC; the AI service reads document bytes from private GCS through its service identity, not through public buckets or browser-provided signed URLs. Vertex AI embeddings and Vector Search are wired behind config when that provider slice is implemented.
- Local/dev may mark scanner metadata as `not_scanned`. Staging/production must configure real malware/safety scanning with `DOCUMENT_SCANNER_MODE=real` and `DOCUMENT_SCANNER_PROVIDER`, or carry a named explicit launch decision in `DOCUMENT_SCANNER_LAUNCH_DECISION_ID` before accepting real user documents. The API and AI service both fail fast when deployed config tries to use `DOCUMENT_SCANNER_MODE=local_fake` without that decision.

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

`scanner_result = not_scanned` means the uploaded sample has not received a malware or safety scan. In local/dev, this is deterministic fake scanner behavior only and is acceptable because local files are developer fixtures.

In staging and production, `not_scanned` is not a clean result. It is allowed only when the team has made and documented an explicit launch decision named by `DOCUMENT_SCANNER_LAUNCH_DECISION_ID`. Without that decision, staging and production services must not start in fake scanner mode. A real scanner launch instead sets `DOCUMENT_SCANNER_MODE=real` plus a provider name so operators can tell which scanning system owns the decision.

Scanner outcomes map to admin exceptions as follows:

- `clean`: no scanner-driven admin exception.
- `suspicious`, `malware_suspected`, or `policy_suspicious`: document stays `limited` with `needs_review` and enters the Needs Review queue.
- `quarantined`, `malware_detected`, or `unsafe`: document becomes `quarantined` with `review_outcome = quarantined` and enters the Quarantine queue.
- `not_scanned`: local/dev fake result, or a deployed explicit launch exception; it must not be treated as clean for launch readiness.

### Ingestion Result Policy

- Successful Step 9 ingestion marks the document processed and stores evidence for later eligibility. Step 10 owns full matching/discovery eligibility.
- Ordinary user-correctable failures, such as empty text, unsupported type during the text-only phase, too-large extracted text, or corrupt files, fail the document with a safe reason code and do not create default admin work.
- Admin exceptions are reserved for suspicious scanner signals, quarantine, file type mismatch/validation bypass, repeated system/provider failures after automatic retries, and unexpected runtime errors.
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

- Manuscript metadata.
- Approved manuscript sample chunks.
- Publisher preferences.
- Publisher profile embeddings.

Steps:

1. Validate manuscript and publisher eligibility.
2. Retrieve candidate publishers from Vertex AI Vector Search.
3. Apply hard filters:
   - genre compatibility
   - excluded genres
   - language
   - target age
   - accepted formats
   - content limits where structured enough
4. Re-rank candidates with structured business rules.
5. Generate fit reasons, risk reasons, source snippets, and score band.
6. Store `match_runs` and `match_candidates`.

Do not use paid subscription status as a hidden relevance boost.

Persist version metadata with every run:

- `matching_algorithm_version`
- `filter_version`
- `embedding_model`
- `explanation_version`

## Match Detail Output

V1 exposes match detail data directly from stored match candidates instead of generating separate AI reports.

Match detail output must include:

- score band
- strong fit reasons
- weak fit or mismatch reasons
- shared genres
- source snippets
- publisher preference context
- manuscript metadata comparison

AI-generated fit reports, report agents, PDF exports, and Google ADK workflows are deferred to V1.5.

## Evaluation

Create AI eval fixtures with known manuscript/publisher pairs:

- expected top-k publisher candidates
- expected reject/mismatch reasons
- expected citation/source snippet quality
- match detail completeness checklist

## Open Questions

- Which embedding model should be used for Turkish and English content?
