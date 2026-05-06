-- Add scanner_failed as a first-class retryable system/provider failure.
--
-- Postgres check constraints cannot be altered in place, so this replaces the
-- existing processing_failure_code allowlist with the same values plus
-- scanner_failed.

alter table public.documents
drop constraint if exists documents_processing_failure_code_check;

alter table public.documents
add constraint documents_processing_failure_code_check
check (
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
