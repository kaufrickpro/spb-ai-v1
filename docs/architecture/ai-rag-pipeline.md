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

The first Step 9 implementation supports `text/plain` only. Digital PDF, DOCX, and EPUB parsers are planned behind the same parser interface. OCR/Document AI is deferred unless explicitly requested.

### Environment Split

- Local/dev: local file storage and fake signed URLs stand in for private GCS; a local processor or test fake runs queued jobs; fake embeddings write deterministic reference metadata only; AI calls use `AI_INTERNAL_TOKEN`.
- Staging/production: files live in private GCS; Cloud Tasks calls the private Cloud Run AI service; AI service authentication uses Cloud Run IAM/OIDC; Vertex AI embeddings and Vector Search are wired behind config.
- Local/dev may mark scanner metadata as `not_scanned`. Staging/production must configure real malware/safety scanning or carry an explicit launch decision before accepting real user documents.

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
