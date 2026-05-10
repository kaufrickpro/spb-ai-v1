create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (
    slug in (
      'author-trial',
      'publisher-trial',
      'author-pro-monthly',
      'author-pro-annual',
      'publisher-pro-monthly',
      'publisher-pro-annual'
    )
  ),
  role text not null check (role in ('author', 'publisher')),
  plan_kind text not null check (plan_kind in ('trial', 'paid')),
  billing_period text not null check (billing_period in ('trial', 'monthly', 'annual')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  ),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  paytr_customer_id text,
  paytr_subscription_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end > current_period_start),
  check (
    (trial_started_at is null and trial_ends_at is null)
    or (trial_started_at is not null and trial_ends_at is not null and trial_ends_at > trial_started_at)
  )
);

create table if not exists public.billing_trial_starts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paytr' check (provider = 'paytr'),
  provider_event_id text not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  processing_status text not null default 'stored' check (
    processing_status in ('stored', 'processed', 'ignored', 'failed')
  ),
  safe_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_payload) = 'object'),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  usage_type text not null check (usage_type in ('intro_request_sent')),
  quantity integer not null default 1 check (quantity > 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  source_event_key text not null check (char_length(trim(source_event_key)) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique(profile_id, source_event_key)
);

create unique index if not exists subscriptions_one_activeish_per_profile_idx
  on public.subscriptions(profile_id)
  where status in ('trialing', 'active', 'past_due');

create index if not exists subscriptions_profile_status_idx
  on public.subscriptions(profile_id, status, current_period_end desc);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions(user_id);

create index if not exists subscriptions_plan_id_idx
  on public.subscriptions(plan_id);

create index if not exists subscriptions_paytr_customer_id_idx
  on public.subscriptions(paytr_customer_id)
  where paytr_customer_id is not null;

create index if not exists subscriptions_paytr_subscription_ref_idx
  on public.subscriptions(paytr_subscription_ref)
  where paytr_subscription_ref is not null;

create index if not exists payment_events_subscription_created_idx
  on public.payment_events(subscription_id, created_at desc);

create index if not exists payment_events_profile_created_idx
  on public.payment_events(profile_id, created_at desc);

create index if not exists usage_ledger_profile_type_period_idx
  on public.usage_ledger(profile_id, usage_type, period_start, period_end);

create index if not exists usage_ledger_subscription_idx
  on public.usage_ledger(subscription_id);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function private.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_trial_starts enable row level security;
alter table public.payment_events enable row level security;
alter table public.usage_ledger enable row level security;

drop policy if exists "authenticated can read active plans" on public.plans;
create policy "authenticated can read active plans"
  on public.plans
  for select
  to authenticated
  using (active = true);

drop policy if exists "users can read own subscriptions" on public.subscriptions;
create policy "users can read own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "users can read own usage" on public.usage_ledger;
create policy "users can read own usage"
  on public.usage_ledger
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles viewer
      where viewer.id = usage_ledger.profile_id
        and viewer.user_id = (select auth.uid())
    )
    or (select private.is_admin())
  );

drop policy if exists "users can read own trial guard" on public.billing_trial_starts;
create policy "users can read own trial guard"
  on public.billing_trial_starts
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "admins can read payment events" on public.payment_events;
create policy "admins can read payment events"
  on public.payment_events
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "service role manages plans" on public.plans;
create policy "service role manages plans"
  on public.plans
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role manages subscriptions" on public.subscriptions;
create policy "service role manages subscriptions"
  on public.subscriptions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role manages trial starts" on public.billing_trial_starts;
create policy "service role manages trial starts"
  on public.billing_trial_starts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role manages payment events" on public.payment_events;
create policy "service role manages payment events"
  on public.payment_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role manages usage ledger" on public.usage_ledger;
create policy "service role manages usage ledger"
  on public.usage_ledger
  for all
  to service_role
  using (true)
  with check (true);

insert into public.plans (
  slug,
  role,
  plan_kind,
  billing_period,
  display_name,
  price_minor,
  limits,
  sort_order
)
values
  (
    'author-trial',
    'author',
    'trial',
    'trial',
    'Author trial',
    0,
    '{"introRequestsPerPeriod":5,"storageBytes":52428800,"directoryVisibility":false,"supportLevel":"standard"}'::jsonb,
    10
  ),
  (
    'publisher-trial',
    'publisher',
    'trial',
    'trial',
    'Publisher trial',
    0,
    '{"introRequestsPerPeriod":5,"storageBytes":0,"directoryVisibility":true,"supportLevel":"standard"}'::jsonb,
    20
  ),
  (
    'author-pro-monthly',
    'author',
    'paid',
    'monthly',
    'Author Pro monthly',
    0,
    '{"introRequestsPerPeriod":25,"storageBytes":262144000,"directoryVisibility":false,"supportLevel":"priority"}'::jsonb,
    30
  ),
  (
    'author-pro-annual',
    'author',
    'paid',
    'annual',
    'Author Pro annual',
    0,
    '{"introRequestsPerPeriod":25,"storageBytes":262144000,"directoryVisibility":false,"supportLevel":"priority"}'::jsonb,
    40
  ),
  (
    'publisher-pro-monthly',
    'publisher',
    'paid',
    'monthly',
    'Publisher Pro monthly',
    0,
    '{"introRequestsPerPeriod":50,"storageBytes":0,"directoryVisibility":true,"supportLevel":"priority"}'::jsonb,
    50
  ),
  (
    'publisher-pro-annual',
    'publisher',
    'paid',
    'annual',
    'Publisher Pro annual',
    0,
    '{"introRequestsPerPeriod":50,"storageBytes":0,"directoryVisibility":true,"supportLevel":"priority"}'::jsonb,
    60
  )
on conflict (slug) do update
set role = excluded.role,
    plan_kind = excluded.plan_kind,
    billing_period = excluded.billing_period,
    display_name = excluded.display_name,
    price_minor = excluded.price_minor,
    limits = excluded.limits,
    active = true,
    sort_order = excluded.sort_order;

create or replace function public.start_role_trial(
  p_actor_user_id uuid,
  p_profile_id uuid,
  p_plan_slug text
) returns public.subscriptions
language plpgsql
security invoker
as $$
declare
  profile_row public.profiles%rowtype;
  plan_row public.plans%rowtype;
  subscription_row public.subscriptions%rowtype;
  starts_at timestamptz := now();
  ends_at timestamptz := now() + interval '1 month';
begin
  if current_role <> 'service_role' then
    raise exception 'start_role_trial requires service_role' using errcode = '42501';
  end if;

  select * into profile_row
  from public.profiles
  where id = p_profile_id
    and user_id = p_actor_user_id;

  if not found then
    raise exception 'Marketplace profile not found' using errcode = 'P0002';
  end if;

  if profile_row.eligibility_status <> 'eligible' then
    raise exception 'Profile must be eligible before trial start' using errcode = '22023';
  end if;

  if profile_row.role = 'author' then
    if not exists (select 1 from public.author_profiles where profile_id = profile_row.id) then
      raise exception 'Author profile details are incomplete' using errcode = '22023';
    end if;
  elsif profile_row.role = 'publisher' then
    if not exists (select 1 from public.publisher_profiles where profile_id = profile_row.id) then
      raise exception 'Publisher profile details are incomplete' using errcode = '22023';
    end if;
  end if;

  select * into plan_row
  from public.plans
  where slug = p_plan_slug
    and role = profile_row.role
    and plan_kind = 'trial'
    and active = true;

  if not found then
    raise exception 'Role trial plan not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.billing_trial_starts trial
    where trial.user_id = p_actor_user_id
  ) then
    raise exception 'Trial has already been used' using errcode = '23505';
  end if;

  insert into public.subscriptions (
    profile_id,
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_started_at,
    trial_ends_at
  )
  values (
    profile_row.id,
    p_actor_user_id,
    plan_row.id,
    'trialing',
    starts_at,
    ends_at,
    starts_at,
    ends_at
  )
  returning * into subscription_row;

  insert into public.billing_trial_starts (
    user_id,
    profile_id,
    subscription_id,
    plan_id,
    started_at,
    trial_ends_at
  )
  values (
    p_actor_user_id,
    profile_row.id,
    subscription_row.id,
    plan_row.id,
    starts_at,
    ends_at
  );

  insert into public.product_audit_events (
    actor_profile_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    profile_row.id,
    'billing_trial_started',
    'subscription',
    subscription_row.id,
    jsonb_build_object(
      'plan_slug', plan_row.slug,
      'period_start', starts_at,
      'period_end', ends_at
    )
  );

  return subscription_row;
end;
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
  subscription_row public.subscriptions%rowtype;
  plan_limits jsonb;
  intro_limit integer;
  used_count integer;
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

  select subscriptions.* into subscription_row
  from public.subscriptions
  where subscriptions.profile_id = p_requester_profile_id
    and subscriptions.status in ('trialing', 'active')
    and subscriptions.current_period_end > now()
  order by subscriptions.current_period_end desc
  limit 1
  for update;

  if not found then
    raise exception 'Active entitlement is required for intro requests' using errcode = '22023';
  end if;

  select plans.limits into plan_limits
  from public.plans
  where plans.id = subscription_row.plan_id;

  intro_limit := coalesce((plan_limits ->> 'introRequestsPerPeriod')::integer, 0);

  select coalesce(sum(usage.quantity), 0)::integer into used_count
  from public.usage_ledger usage
  where usage.profile_id = p_requester_profile_id
    and usage.usage_type = 'intro_request_sent'
    and usage.period_start = subscription_row.current_period_start
    and usage.period_end = subscription_row.current_period_end;

  if used_count >= intro_limit then
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

  insert into public.usage_ledger (
    profile_id,
    subscription_id,
    usage_type,
    quantity,
    period_start,
    period_end,
    source_event_key,
    metadata
  )
  values (
    p_requester_profile_id,
    subscription_row.id,
    'intro_request_sent',
    1,
    subscription_row.current_period_start,
    subscription_row.current_period_end,
    'intro_request:' || request_row.id::text,
    jsonb_build_object('intro_request_id', request_row.id)
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
      'recipient_profile_id', p_recipient_profile_id,
      'usage_source_event_key', 'intro_request:' || request_row.id::text
    )
  );

  return request_row;
end;
$$;

revoke all on function public.start_role_trial(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_intro_request(uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.start_role_trial(uuid, uuid, text) to service_role;
grant execute on function public.create_intro_request(uuid, uuid, uuid, uuid, uuid, text) to service_role;

grant select on public.plans to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_trial_starts to authenticated;
grant select on public.usage_ledger to authenticated;
grant select on public.payment_events to authenticated;

grant all on public.plans to service_role;
grant all on public.subscriptions to service_role;
grant all on public.billing_trial_starts to service_role;
grant all on public.payment_events to service_role;
grant all on public.usage_ledger to service_role;
