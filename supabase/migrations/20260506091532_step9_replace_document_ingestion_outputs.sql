-- Replace the active chunk and embedding-reference set for one document in a
-- single database transaction. Job history stays in document_processing_jobs.

create or replace function public.replace_document_ingestion_outputs(
  p_document_id uuid,
  p_chunks jsonb,
  p_embeddings jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not exists (
    select 1
    from public.documents
    where id = p_document_id
  ) then
    raise exception 'document_not_found';
  end if;

  with old_chunks as (
    select id
    from public.document_chunks
    where document_id = p_document_id
  )
  delete from public.embedding_records er
  using old_chunks oc
  where er.source_type = 'document_chunk'
    and er.source_id = oc.id;

  delete from public.document_chunks
  where document_id = p_document_id;

  with inserted_chunks as (
    insert into public.document_chunks (
      document_id,
      chunk_index,
      content,
      metadata
    )
    select
      p_document_id,
      (chunk_item.value ->> 'chunk_index')::integer,
      chunk_item.value ->> 'content',
      coalesce(chunk_item.value -> 'metadata', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb)) as chunk_item(value)
    order by (chunk_item.value ->> 'chunk_index')::integer
    returning id, chunk_index
  )
  insert into public.embedding_records (
    source_type,
    source_id,
    vector_index_name,
    vector_datapoint_id,
    embedding_model,
    metadata
  )
  select
    'document_chunk',
    inserted_chunks.id,
    embedding_item.value ->> 'vector_index_name',
    embedding_item.value ->> 'vector_datapoint_id',
    embedding_item.value ->> 'embedding_model',
    coalesce(embedding_item.value -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_embeddings, '[]'::jsonb)) as embedding_item(value)
  join inserted_chunks
    on inserted_chunks.chunk_index = (embedding_item.value ->> 'chunk_index')::integer;
end;
$$;

revoke all on function public.replace_document_ingestion_outputs(uuid, jsonb, jsonb)
from public, anon, authenticated;

grant execute on function public.replace_document_ingestion_outputs(uuid, jsonb, jsonb)
to service_role;
