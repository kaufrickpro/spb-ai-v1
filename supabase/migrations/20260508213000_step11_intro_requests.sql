create table if not exists public.intro_requests (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  publisher_profile_id uuid not null references public.profiles(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  message text check (message is null or char_length(message) <= 1000),
  rejection_note text check (rejection_note is null or char_length(rejection_note) <= 500),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (author_profile_id <> publisher_profile_id),
  check (requester_profile_id in (author_profile_id, publisher_profile_id)),
  check (recipient_profile_id in (author_profile_id, publisher_profile_id)),
  check (requester_profile_id <> recipient_profile_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (char_length(notification_type) between 1 and 120),
  target_type text not null check (char_length(target_type) between 1 and 120),
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.product_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target_type text not null check (char_length(target_type) between 1 and 120),
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.intro_request_usage_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  intro_request_id uuid not null references public.intro_requests(id) on delete cascade,
  usage_date date not null default current_date,
  source_event_key text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, source_event_key)
);

drop trigger if exists set_intro_requests_updated_at on public.intro_requests;
create trigger set_intro_requests_updated_at
  before update on public.intro_requests
  for each row execute function private.set_updated_at();

create index if not exists intro_requests_author_status_idx
  on public.intro_requests(author_profile_id, status, requested_at desc);

create index if not exists intro_requests_publisher_status_idx
  on public.intro_requests(publisher_profile_id, status, requested_at desc);

create index if not exists intro_requests_requester_idx
  on public.intro_requests(requester_profile_id, requested_at desc);

create index if not exists intro_requests_recipient_idx
  on public.intro_requests(recipient_profile_id, requested_at desc);

create index if not exists intro_requests_pair_idx
  on public.intro_requests(manuscript_id, publisher_profile_id, requested_at desc);

create unique index if not exists intro_requests_one_pending_pair_idx
  on public.intro_requests(manuscript_id, publisher_profile_id)
  where status = 'pending';

create unique index if not exists intro_requests_one_accepted_pair_idx
  on public.intro_requests(manuscript_id, publisher_profile_id)
  where status = 'accepted';

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_profile_id, created_at desc);

create index if not exists product_audit_events_target_created_idx
  on public.product_audit_events(target_type, target_id, created_at desc);

create index if not exists intro_request_usage_profile_date_idx
  on public.intro_request_usage_events(profile_id, usage_date);

create index if not exists intro_request_usage_request_idx
  on public.intro_request_usage_events(intro_request_id);

alter table public.intro_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.product_audit_events enable row level security;
alter table public.intro_request_usage_events enable row level security;

drop policy if exists "participants can read intro requests" on public.intro_requests;
create policy "participants can read intro requests"
  on public.intro_requests
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.id in (
          intro_requests.author_profile_id,
          intro_requests.publisher_profile_id
        )
    )
  );

drop policy if exists "recipients can read notifications" on public.notifications;
create policy "recipients can read notifications"
  on public.notifications
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.id = notifications.recipient_profile_id
    )
  );

drop policy if exists "admins can read product audit events" on public.product_audit_events;
create policy "admins can read product audit events"
  on public.product_audit_events
  for select
  to authenticated
  using (private.is_admin());

drop policy if exists "service role manages intro requests" on public.intro_requests;
create policy "service role manages intro requests"
  on public.intro_requests
  for all
  using (false)
  with check (false);

drop policy if exists "service role manages notifications" on public.notifications;
create policy "service role manages notifications"
  on public.notifications
  for all
  using (false)
  with check (false);

drop policy if exists "service role manages product audit events" on public.product_audit_events;
create policy "service role manages product audit events"
  on public.product_audit_events
  for all
  using (false)
  with check (false);

drop policy if exists "service role manages intro usage" on public.intro_request_usage_events;
create policy "service role manages intro usage"
  on public.intro_request_usage_events
  for all
  using (false)
  with check (false);

create or replace function public.has_accepted_intro(
  p_manuscript_id uuid,
  p_publisher_profile_id uuid
) returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1
    from public.intro_requests request
    where request.manuscript_id = p_manuscript_id
      and request.publisher_profile_id = p_publisher_profile_id
      and request.status = 'accepted'
  );
$$;

create or replace function public.create_intro_request(
  p_manuscript_id uuid,
  p_author_profile_id uuid,
  p_publisher_profile_id uuid,
  p_requester_profile_id uuid,
  p_recipient_profile_id uuid,
  p_message text default null
) returns public.intro_requests
language plpgsql
security invoker
as $$
declare
  request_row public.intro_requests%rowtype;
  today_count integer;
begin
  if current_role <> 'service_role' then
    raise exception 'create_intro_request requires service_role' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.intro_requests existing
    where existing.manuscript_id = p_manuscript_id
      and existing.publisher_profile_id = p_publisher_profile_id
      and existing.status = 'accepted'
  ) then
    raise exception 'Accepted intro request is terminal for this pair' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.intro_requests existing
    where existing.manuscript_id = p_manuscript_id
      and existing.publisher_profile_id = p_publisher_profile_id
      and existing.status = 'pending'
  ) then
    raise exception 'An intro request is already pending for this pair' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.intro_requests existing
    where existing.manuscript_id = p_manuscript_id
      and existing.publisher_profile_id = p_publisher_profile_id
      and existing.status in ('rejected', 'cancelled')
      and coalesce(existing.responded_at, existing.updated_at) > now() - interval '14 days'
  ) then
    raise exception 'Intro request pair is cooling down' using errcode = '22023';
  end if;

  select count(*) into today_count
  from public.intro_request_usage_events usage
  where usage.profile_id = p_requester_profile_id
    and usage.usage_date = current_date;

  if today_count >= 10 then
    raise exception 'Intro request quota exhausted' using errcode = '22023';
  end if;

  insert into public.intro_requests (
    manuscript_id,
    author_profile_id,
    publisher_profile_id,
    requester_profile_id,
    recipient_profile_id,
    message
  )
  values (
    p_manuscript_id,
    p_author_profile_id,
    p_publisher_profile_id,
    p_requester_profile_id,
    p_recipient_profile_id,
    nullif(btrim(p_message), '')
  )
  returning * into request_row;

  insert into public.intro_request_usage_events (
    profile_id,
    intro_request_id,
    source_event_key
  )
  values (
    p_requester_profile_id,
    request_row.id,
    'intro_request:' || request_row.id::text
  );

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    notification_type,
    target_type,
    target_id,
    metadata
  )
  values (
    p_recipient_profile_id,
    p_requester_profile_id,
    'intro_request_created',
    'intro_request',
    request_row.id,
    jsonb_build_object(
      'manuscript_id', p_manuscript_id,
      'publisher_profile_id', p_publisher_profile_id
    )
  );

  insert into public.product_audit_events (
    actor_profile_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    p_requester_profile_id,
    'intro_request_created',
    'intro_request',
    request_row.id,
    jsonb_build_object(
      'manuscript_id', p_manuscript_id,
      'author_profile_id', p_author_profile_id,
      'publisher_profile_id', p_publisher_profile_id,
      'recipient_profile_id', p_recipient_profile_id
    )
  );

  return request_row;
end;
$$;

create or replace function public.transition_intro_request(
  p_request_id uuid,
  p_actor_profile_id uuid,
  p_action text,
  p_note text default null
) returns public.intro_requests
language plpgsql
security invoker
as $$
declare
  request_row public.intro_requests%rowtype;
  recipient_profile uuid;
begin
  if current_role <> 'service_role' then
    raise exception 'transition_intro_request requires service_role' using errcode = '42501';
  end if;

  select * into request_row
  from public.intro_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Intro request not found' using errcode = 'P0002';
  end if;

  if request_row.status <> 'pending' then
    raise exception 'Only pending intro requests can transition' using errcode = '22023';
  end if;

  if p_action in ('accept', 'reject') and request_row.recipient_profile_id <> p_actor_profile_id then
    raise exception 'Only the recipient can accept or reject intro requests' using errcode = '42501';
  end if;

  if p_action = 'cancel' and request_row.requester_profile_id <> p_actor_profile_id then
    raise exception 'Only the requester can cancel intro requests' using errcode = '42501';
  end if;

  if p_action = 'accept' and not exists (
    select 1
    from public.profiles author_profile
    join public.profiles publisher_profile
      on publisher_profile.id = request_row.publisher_profile_id
    join public.manuscripts manuscript
      on manuscript.id = request_row.manuscript_id
      and manuscript.author_id = author_profile.user_id
    join public.documents sample_document
      on sample_document.id = manuscript.sample_document_id
      and sample_document.manuscript_id = manuscript.id
    where author_profile.id = request_row.author_profile_id
      and author_profile.eligibility_status = 'eligible'
      and publisher_profile.eligibility_status = 'eligible'
      and manuscript.eligibility_status = 'eligible'
      and sample_document.storage_status = 'uploaded'
      and sample_document.processing_status = 'succeeded'
      and sample_document.eligibility_status = 'eligible'
  ) then
    raise exception 'Intro request pair is not currently eligible' using errcode = '22023';
  end if;

  if p_action = 'accept' then
    update public.intro_requests
    set status = 'accepted',
        responded_at = now()
    where id = p_request_id
    returning * into request_row;
  elsif p_action = 'reject' then
    update public.intro_requests
    set status = 'rejected',
        rejection_note = nullif(btrim(p_note), ''),
        responded_at = now()
    where id = p_request_id
    returning * into request_row;
  elsif p_action = 'cancel' then
    update public.intro_requests
    set status = 'cancelled',
        responded_at = now()
    where id = p_request_id
    returning * into request_row;
  else
    raise exception 'Unsupported intro request action' using errcode = '22023';
  end if;

  recipient_profile := case
    when p_actor_profile_id = request_row.requester_profile_id
      then request_row.recipient_profile_id
    else request_row.requester_profile_id
  end;

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    notification_type,
    target_type,
    target_id,
    metadata
  )
  values (
    recipient_profile,
    p_actor_profile_id,
    'intro_request_' || request_row.status,
    'intro_request',
    request_row.id,
    jsonb_build_object(
      'manuscript_id', request_row.manuscript_id,
      'publisher_profile_id', request_row.publisher_profile_id,
      'status', request_row.status
    )
  );

  insert into public.product_audit_events (
    actor_profile_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    p_actor_profile_id,
    'intro_request_' || request_row.status,
    'intro_request',
    request_row.id,
    jsonb_build_object(
      'manuscript_id', request_row.manuscript_id,
      'author_profile_id', request_row.author_profile_id,
      'publisher_profile_id', request_row.publisher_profile_id,
      'status', request_row.status
    )
  );

  return request_row;
end;
$$;

revoke all on function public.create_intro_request(uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.transition_intro_request(uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.create_intro_request(uuid, uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.transition_intro_request(uuid, uuid, text, text) to service_role;

grant select on public.intro_requests to authenticated;
grant select on public.notifications to authenticated;
grant select on public.product_audit_events to authenticated;

grant all on public.intro_requests to service_role;
grant all on public.notifications to service_role;
grant all on public.product_audit_events to service_role;
grant all on public.intro_request_usage_events to service_role;
