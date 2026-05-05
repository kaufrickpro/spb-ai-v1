create or replace function public.complete_document_upload(
  p_document_id uuid,
  p_actor_user_id uuid
)
returns public.documents
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pending_document public.documents%rowtype;
  uploaded_document public.documents%rowtype;
begin
  if auth.uid() is distinct from p_actor_user_id then
    raise exception 'Document upload completion requires the authenticated author'
      using errcode = '42501';
  end if;

  select *
  into pending_document
  from public.documents
  where id = p_document_id
    and author_id = p_actor_user_id
  for update;

  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  if pending_document.storage_status <> 'pending_upload' then
    raise exception 'The upload is no longer pending completion'
      using errcode = 'P0003';
  end if;

  update public.documents
  set storage_status = 'pending_delete'
  where manuscript_id = pending_document.manuscript_id
    and author_id = p_actor_user_id
    and id <> pending_document.id
    and storage_status = 'uploaded';

  update public.documents
  set
    storage_status = 'uploaded',
    processing_status = 'queued',
    processing_failure_code = null,
    admin_review_status = 'not_submitted',
    eligibility_status = 'limited',
    review_outcome = 'needs_review'
  where id = pending_document.id
    and author_id = p_actor_user_id
    and storage_status = 'pending_upload'
  returning * into uploaded_document;

  if not found then
    raise exception 'The upload is no longer pending completion'
      using errcode = 'P0003';
  end if;

  update public.manuscripts
  set sample_document_id = uploaded_document.id
  where id = uploaded_document.manuscript_id
    and author_id = p_actor_user_id;

  if not found then
    raise exception 'Manuscript not found' using errcode = 'P0002';
  end if;

  return uploaded_document;
end;
$$;

revoke all on function public.complete_document_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_document_upload(uuid, uuid) to authenticated;
grant execute on function public.complete_document_upload(uuid, uuid) to service_role;
