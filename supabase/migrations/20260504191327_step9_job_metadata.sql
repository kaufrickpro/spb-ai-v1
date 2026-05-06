-- Complete the Step 9 ingestion state shape without changing existing RLS.
-- Local/dev can keep provider fakes, but staging/production will use this same
-- durable job/document vocabulary for async AI ingestion.

alter table public.document_processing_jobs
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.documents
add column if not exists processing_failure_code text check (
  processing_failure_code is null
  or processing_failure_code in (
    'empty_extracted_text',
    'unsupported_file_type',
    'file_type_mismatch',
    'extracted_text_too_large',
    'chunk_limit_exceeded',
    'download_failed',
    'parser_failed',
    'embedding_failed',
    'scanner_suspicious',
    'scanner_failed',
    'unexpected_processing_error'
  )
);
