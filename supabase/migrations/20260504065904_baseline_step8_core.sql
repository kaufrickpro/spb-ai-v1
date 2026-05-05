-- Clean Step 8 baseline for the publisher-author marketplace.
-- Intentionally rebuilds app-owned objects so local and linked environments
-- share one executable database source of truth.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

drop function if exists public.rls_auto_enable() cascade;
drop function if exists public.apply_admin_review_decision(uuid, uuid, text, text) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.prevent_admin_access_for_profile_user() cascade;
drop function if exists public.prevent_profile_for_admin_user() cascade;
drop function if exists public.require_author_role_for_author_profile() cascade;
drop function if exists public.require_publisher_role_for_publisher_profile() cascade;
drop function if exists public.set_updated_at() cascade;

drop table if exists public.admin_trust_signals cascade;
drop table if exists public.admin_payment_events cascade;
drop table if exists public.admin_job_runs cascade;
drop table if exists public.admin_audit_logs cascade;
drop table if exists public.admin_reviews cascade;
drop table if exists public.documents cascade;
drop table if exists public.manuscripts cascade;
drop table if exists public.publisher_profiles cascade;
drop table if exists public.author_profiles cascade;
drop table if exists public.admin_users cascade;
drop table if exists public.profiles cascade;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('author', 'publisher')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  profile_photo_url text check (
    profile_photo_url is null
    or char_length(trim(profile_photo_url)) between 1 and 2048
  ),
  signup_intent text not null check (
    signup_intent in (
      'find_publisher',
      'compare_publishers',
      'prepare_submission',
      'discover_manuscripts',
      'source_authors',
      'manage_submissions'
    )
  ),
  approval_status text not null default 'pending' check (
    approval_status in ('pending', 'approved', 'rejected')
  ),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles(user_id);
create index profiles_role_idx on public.profiles(role);
create index profiles_approval_status_idx on public.profiles(approval_status);
create index profiles_created_at_idx on public.profiles(created_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_users_status_idx on public.admin_users(status);
create index admin_users_granted_by_user_id_idx on public.admin_users(granted_by_user_id);

create trigger admin_users_set_updated_at
before update on public.admin_users
for each row
execute function private.set_updated_at();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.status = 'active'
  );
$$;

create or replace function private.prevent_profile_for_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if exists (
    select 1
    from public.admin_users au
    where au.user_id = new.user_id
      and au.status = 'active'
  ) then
    raise exception 'Admin accounts cannot have marketplace profiles';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_admin_access_for_profile_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'active'
    and exists (
      select 1
      from public.profiles p
      where p.user_id = new.user_id
    ) then
    raise exception 'Marketplace profile accounts cannot receive admin access';
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_admin_user
before insert or update of user_id on public.profiles
for each row
execute function private.prevent_profile_for_admin_user();

create trigger admin_users_prevent_marketplace_profile
before insert or update of user_id, status on public.admin_users
for each row
execute function private.prevent_admin_access_for_profile_user();

create table public.author_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  biography text not null check (char_length(trim(biography)) between 24 and 1000),
  primary_genre text not null check (char_length(trim(primary_genre)) between 2 and 80),
  writing_languages text[] not null check (
    cardinality(writing_languages) between 1 and 2
    and writing_languages <@ array['tr', 'en']::text[]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index author_profiles_created_at_idx on public.author_profiles(created_at);

create table public.publisher_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  focus_genres text[] not null check (cardinality(focus_genres) between 1 and 5),
  preferred_languages text[] not null check (
    cardinality(preferred_languages) between 1 and 2
    and preferred_languages <@ array['tr', 'en']::text[]
  ),
  accepts_unsolicited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index publisher_profiles_created_at_idx on public.publisher_profiles(created_at);

create or replace function private.require_author_role_for_author_profile()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.profile_id
      and p.role = 'author'
  ) then
    raise exception 'Author details require an author profile';
  end if;

  return new;
end;
$$;

create or replace function private.require_publisher_role_for_publisher_profile()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.profile_id
      and p.role = 'publisher'
  ) then
    raise exception 'Publisher preferences require a publisher profile';
  end if;

  return new;
end;
$$;

create trigger author_profiles_set_updated_at
before update on public.author_profiles
for each row
execute function private.set_updated_at();

create trigger publisher_profiles_set_updated_at
before update on public.publisher_profiles
for each row
execute function private.set_updated_at();

create trigger author_profiles_require_author_role
before insert or update of profile_id on public.author_profiles
for each row
execute function private.require_author_role_for_author_profile();

create trigger publisher_profiles_require_publisher_role
before insert or update of profile_id on public.publisher_profiles
for each row
execute function private.require_publisher_role_for_publisher_profile();

create table public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  genre text not null check (char_length(genre) between 1 and 80),
  language text not null check (char_length(language) between 2 and 10),
  word_count integer check (word_count >= 0),
  synopsis text check (char_length(synopsis) <= 2000),
  target_age_min integer check (target_age_min >= 0),
  target_age_max integer check (target_age_max >= 0),
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'archived')
  ),
  admin_review_status text not null default 'not_submitted' check (
    admin_review_status in ('not_submitted', 'pending', 'approved', 'rejected')
  ),
  sample_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index manuscripts_author_id_idx on public.manuscripts(author_id);
create index manuscripts_status_idx on public.manuscripts(status);
create index manuscripts_admin_review_status_idx on public.manuscripts(admin_review_status);
create index manuscripts_sample_document_id_idx on public.manuscripts(sample_document_id);
create index manuscripts_created_at_idx on public.manuscripts(created_at);

create trigger manuscripts_set_updated_at
before update on public.manuscripts
for each row
execute function private.set_updated_at();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  original_file_name text not null check (char_length(original_file_name) between 1 and 255),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/epub+zip',
      'text/plain'
    )
  ),
  file_size_bytes bigint not null check (
    file_size_bytes > 0 and file_size_bytes <= 26214400
  ),
  storage_status text not null default 'pending_upload' check (
    storage_status in ('pending_upload', 'uploaded', 'attached', 'pending_delete', 'deleted')
  ),
  processing_status text not null default 'not_started' check (
    processing_status in ('not_started', 'queued', 'processing', 'succeeded', 'failed')
  ),
  admin_review_status text not null default 'not_submitted' check (
    admin_review_status in ('not_submitted', 'pending', 'approved', 'rejected')
  ),
  upload_id text not null check (char_length(upload_id) between 1 and 120),
  retention_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manuscripts
  add constraint manuscripts_sample_document_id_fkey
  foreign key (sample_document_id)
  references public.documents(id)
  on delete set null;

create index documents_manuscript_id_idx on public.documents(manuscript_id);
create index documents_author_id_idx on public.documents(author_id);
create index documents_storage_status_idx on public.documents(storage_status);
create index documents_processing_status_idx on public.documents(processing_status);
create index documents_admin_review_status_idx on public.documents(admin_review_status);
create index documents_created_at_idx on public.documents(created_at);

create unique index documents_one_active_sample_idx
  on public.documents(manuscript_id)
  where storage_status = 'uploaded';

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function private.set_updated_at();

create table public.admin_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('profile', 'manuscript', 'document', 'publisher_change_request')
  ),
  entity_id uuid not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  risk_level text not null default 'medium' check (
    risk_level in ('low', 'medium', 'high')
  ),
  summary text not null check (char_length(summary) between 1 and 500),
  submitted_fields jsonb not null default '{}'::jsonb,
  risk_warnings text[] not null default '{}'::text[],
  rejection_note text,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  decided_by_user_id uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_reviews_status_idx on public.admin_reviews(status);
create index admin_reviews_entity_idx on public.admin_reviews(entity_type, entity_id);
create index admin_reviews_created_at_idx on public.admin_reviews(created_at);
create index admin_reviews_submitted_at_idx on public.admin_reviews(submitted_at);
create index admin_reviews_submitted_by_user_id_idx on public.admin_reviews(submitted_by_user_id);
create index admin_reviews_decided_by_user_id_idx on public.admin_reviews(decided_by_user_id);

create trigger admin_reviews_set_updated_at
before update on public.admin_reviews
for each row
execute function private.set_updated_at();

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 120),
  target_type text not null check (
    target_type in ('profile', 'manuscript', 'document', 'publisher_change_request')
  ),
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_actor_user_id_idx on public.admin_audit_logs(actor_user_id);
create index admin_audit_logs_target_idx on public.admin_audit_logs(target_type, target_id);
create index admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at);

create table public.admin_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (
    job_type in ('document_ingestion', 'matching', 'billing_sync', 'email_delivery')
  ),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  source text not null check (char_length(source) between 1 and 120),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_job_runs_status_idx on public.admin_job_runs(status);
create index admin_job_runs_updated_at_idx on public.admin_job_runs(updated_at desc);

create trigger admin_job_runs_set_updated_at
before update on public.admin_job_runs
for each row
execute function private.set_updated_at();

create table public.admin_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paytr', 'manual')),
  event_type text not null check (char_length(event_type) between 1 and 120),
  status text not null check (status in ('processed', 'failed', 'pending')),
  failure_reason text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index admin_payment_events_status_idx on public.admin_payment_events(status);
create index admin_payment_events_occurred_at_idx on public.admin_payment_events(occurred_at desc);

create table public.admin_trust_signals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  signal_type text not null check (
    signal_type in ('fraud_report', 'policy_violation', 'identity_mismatch', 'spam')
  ),
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null check (status in ('open', 'resolved')),
  note text not null check (char_length(note) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index admin_trust_signals_profile_id_idx on public.admin_trust_signals(profile_id);
create index admin_trust_signals_status_idx on public.admin_trust_signals(status);
create index admin_trust_signals_created_at_idx on public.admin_trust_signals(created_at desc);

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.author_profiles enable row level security;
alter table public.publisher_profiles enable row level security;
alter table public.manuscripts enable row level security;
alter table public.documents enable row level security;
alter table public.admin_reviews enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_job_runs enable row level security;
alter table public.admin_payment_events enable row level security;
alter table public.admin_trust_signals enable row level security;

create policy profiles_authenticated_access
on public.profiles
for all
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.is_admin())
)
with check (
  ((select auth.uid()) = user_id and role in ('author', 'publisher'))
  or (select private.is_admin())
);

create policy admin_users_self_or_admin_select
on public.admin_users
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.is_admin())
);

create policy author_profiles_authenticated_access
on public.author_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.user_id = (select auth.uid())
      and p.role = 'author'
  )
  or (select private.is_admin())
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.user_id = (select auth.uid())
      and p.role = 'author'
  )
  or (select private.is_admin())
);

create policy publisher_profiles_authenticated_access
on public.publisher_profiles
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.user_id = (select auth.uid())
      and p.role = 'publisher'
  )
  or (select private.is_admin())
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.user_id = (select auth.uid())
      and p.role = 'publisher'
  )
  or (select private.is_admin())
);

create policy manuscripts_authenticated_access
on public.manuscripts
for all
to authenticated
using (
  (select auth.uid()) = author_id
  or (select private.is_admin())
)
with check (
  (select auth.uid()) = author_id
  or (select private.is_admin())
);

create policy documents_authenticated_access
on public.documents
for all
to authenticated
using (
  (select auth.uid()) = author_id
  or (select private.is_admin())
)
with check (
  (select auth.uid()) = author_id
  or (select private.is_admin())
);

create policy admin_reviews_admin_select
on public.admin_reviews
for select
to authenticated
using ((select private.is_admin()));

create policy admin_reviews_admin_update
on public.admin_reviews
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy admin_audit_logs_admin_select
on public.admin_audit_logs
for select
to authenticated
using ((select private.is_admin()));

create policy admin_audit_logs_admin_insert
on public.admin_audit_logs
for insert
to authenticated
with check ((select private.is_admin()));

create policy admin_job_runs_admin_access
on public.admin_job_runs
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy admin_payment_events_admin_access
on public.admin_payment_events
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy admin_trust_signals_admin_access
on public.admin_trust_signals
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create or replace function public.apply_admin_review_decision(
  p_review_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_rejection_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_row public.admin_reviews%rowtype;
  audit_log_row public.admin_audit_logs%rowtype;
  action_name text;
begin
  if auth.uid() is distinct from p_actor_user_id or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;

  if p_decision = 'rejected'
    and (p_rejection_note is null or char_length(trim(p_rejection_note)) < 5) then
    raise exception 'Rejection note is required' using errcode = '22023';
  end if;

  update public.admin_reviews
  set
    status = p_decision,
    rejection_note = p_rejection_note,
    decided_by_user_id = p_actor_user_id,
    decided_at = now()
  where id = p_review_id
  returning * into review_row;

  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;

  if review_row.entity_type = 'manuscript' then
    update public.manuscripts
    set
      admin_review_status = p_decision,
      status = case
        when p_decision = 'approved' then 'approved'
        else 'rejected'
      end
    where id = review_row.entity_id;
  elsif review_row.entity_type = 'document' then
    update public.documents
    set admin_review_status = p_decision
    where id = review_row.entity_id;
  end if;

  action_name := case review_row.entity_type
    when 'manuscript' then
      case when p_decision = 'approved' then 'manuscript.approved' else 'manuscript.rejected' end
    when 'document' then
      case when p_decision = 'approved' then 'document.approved' else 'document.rejected' end
    else
      case when p_decision = 'approved' then 'review.approved' else 'review.rejected' end
  end;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    p_actor_user_id,
    action_name,
    review_row.entity_type,
    review_row.entity_id,
    jsonb_build_object(
      'review_id', p_review_id,
      'rejection_note', p_rejection_note,
      'target_entity_type', review_row.entity_type
    )
  )
  returning * into audit_log_row;

  return jsonb_build_object(
    'review', to_jsonb(review_row),
    'auditLog', to_jsonb(audit_log_row)
  );
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.author_profiles to authenticated;
grant select, insert, update on public.publisher_profiles to authenticated;
grant select on public.admin_users to authenticated;
grant select, insert, update on public.manuscripts to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, update on public.admin_reviews to authenticated;
grant select, insert on public.admin_audit_logs to authenticated;
grant select, insert, update on public.admin_job_runs to authenticated;
grant select, insert, update on public.admin_payment_events to authenticated;
grant select, insert, update on public.admin_trust_signals to authenticated;

grant execute on function private.is_admin() to authenticated;
grant execute on function public.apply_admin_review_decision(uuid, uuid, text, text) to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema private to service_role;
grant execute on function public.apply_admin_review_decision(uuid, uuid, text, text) to service_role;
