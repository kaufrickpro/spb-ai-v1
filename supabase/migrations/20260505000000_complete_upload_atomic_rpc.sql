-- Atomic upload completion RPC for the author document upload flow.
--
-- Before this function existed, the API applied three separate writes in
-- sequence:
--   1. UPDATE documents  (storage_status = uploaded, processing_status = queued)
--   2. UPDATE manuscripts (sample_document_id = ...)
--   3. INSERT document_processing_jobs
--
-- Any failure between steps could leave a document as queued with no matching
-- job, or a manuscript pointing at a stale sample.  This function wraps all
-- three writes in a single Postgres transaction, providing an atomic completion
-- boundary for the upload flow.
--
-- Caller: service-role only.  RLS is bypassed intentionally so the function
-- can read and update across author-owned rows without relying on the caller's
-- JWT context.

create or replace function public.complete_author_document_upload(
  p_document_id      uuid,
  p_author_id        uuid,
  p_idempotency_key  text
)
returns uuid        -- returns the document_processing_jobs.id on success
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_manuscript_id  uuid;
  v_old_sample_id  uuid;
  v_job_id         uuid;
begin
  -- Lock the target document and verify it is in the expected pre-completion
  -- state.  Raises an exception if the row is missing, belongs to a different
  -- author, or has already been completed.
  select manuscript_id
  into   v_manuscript_id
  from   public.documents
  where  id = p_document_id
    and  author_id = p_author_id
    and  storage_status = 'pending_upload'
  for update;

  if not found then
    raise exception 'document_not_found_or_not_pending'
      using errcode = 'P0002',
            detail  = format('document_id=%s author_id=%s', p_document_id, p_author_id);
  end if;

  -- Find any document that is already the active sample for this manuscript
  -- (storage_status = 'uploaded') so we can retire it.  Lock it to prevent
  -- a concurrent retirement race.
  select id
  into   v_old_sample_id
  from   public.documents
  where  manuscript_id = v_manuscript_id
    and  storage_status = 'uploaded'
    and  id <> p_document_id
  for update skip locked
  limit 1;

  -- Retire the prior active sample if one exists.
  if v_old_sample_id is not null then
    update public.documents
    set    storage_status = 'pending_delete',
           updated_at     = now()
    where  id = v_old_sample_id;
  end if;

  -- Transition the new document to the uploaded / queued state.
  update public.documents
  set    storage_status    = 'uploaded',
         processing_status = 'queued',
         updated_at        = now()
  where  id = p_document_id;

  -- Point the manuscript at the new sample.
  update public.manuscripts
  set    sample_document_id = p_document_id,
         updated_at         = now()
  where  id = v_manuscript_id;

  -- Upsert the ingestion job.  If a job with the same idempotency key already
  -- exists (e.g. a retried request), reset it to queued rather than duplicating.
  insert into public.document_processing_jobs (
    document_id,
    status,
    idempotency_key,
    metadata
  ) values (
    p_document_id,
    'queued',
    p_idempotency_key,
    '{}'::jsonb
  )
  on conflict (document_id, idempotency_key) do update
    set status     = 'queued',
        updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

-- Grant execute to service_role only.  The author-facing API calls this
-- through the service-role client — never through the user-scoped JWT client.
revoke execute on function public.complete_author_document_upload(uuid, uuid, text) from public;
grant  execute on function public.complete_author_document_upload(uuid, uuid, text) to service_role;
