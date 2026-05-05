-- Step 9 ingestion storage foundation.
-- Worker writes stay service-role-only until the ingestion API slice lands.

create table public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  idempotency_key text not null,
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, idempotency_key)
);

create index document_processing_jobs_document_id_idx
on public.document_processing_jobs(document_id);

create index document_processing_jobs_status_queued_at_idx
on public.document_processing_jobs(status, queued_at);

create trigger document_processing_jobs_set_updated_at
before update on public.document_processing_jobs
for each row
execute function private.set_updated_at();

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0 and chunk_index < 300),
  content text not null check (char_length(content) > 0),
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_id_chunk_index_idx
on public.document_chunks(document_id, chunk_index);

create table public.embedding_records (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (
    source_type in ('manuscript', 'document_chunk', 'publisher_profile')
  ),
  source_id uuid not null,
  vector_index_name text not null check (char_length(vector_index_name) between 1 and 200),
  vector_datapoint_id text not null check (char_length(vector_datapoint_id) between 1 and 200),
  embedding_model text not null check (char_length(embedding_model) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (vector_index_name, vector_datapoint_id)
);

create index embedding_records_source_idx
on public.embedding_records(source_type, source_id);

alter table public.document_processing_jobs enable row level security;
alter table public.document_chunks enable row level security;
alter table public.embedding_records enable row level security;

create policy document_processing_jobs_admin_read
on public.document_processing_jobs
for select
to authenticated
using ((select private.is_admin()));

create policy document_chunks_owner_or_admin_read
on public.document_chunks
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.author_id = (select auth.uid())
  )
  or (select private.is_admin())
);

create policy embedding_records_admin_read
on public.embedding_records
for select
to authenticated
using ((select private.is_admin()));

revoke all on public.document_processing_jobs from anon, authenticated;
revoke all on public.document_chunks from anon, authenticated;
revoke all on public.embedding_records from anon, authenticated;

grant select on public.document_processing_jobs to authenticated;
grant select on public.document_chunks to authenticated;
grant select on public.embedding_records to authenticated;

grant all on public.document_processing_jobs to service_role;
grant all on public.document_chunks to service_role;
grant all on public.embedding_records to service_role;
