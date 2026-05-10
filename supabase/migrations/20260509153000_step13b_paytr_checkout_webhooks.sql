alter table public.payment_events
  add column if not exists hash_verification_status text not null default 'verified'
  check (hash_verification_status in ('verified', 'failed', 'not_applicable'));

create table if not exists public.paytr_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_oid text not null unique check (merchant_oid ~ '^[A-Za-z0-9]+$'),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'expired')),
  checkout_token text not null check (char_length(checkout_token) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paytr_checkout_sessions_profile_created_idx
  on public.paytr_checkout_sessions(profile_id, created_at desc);

drop trigger if exists paytr_checkout_sessions_set_updated_at on public.paytr_checkout_sessions;
create trigger paytr_checkout_sessions_set_updated_at
before update on public.paytr_checkout_sessions
for each row execute function private.set_updated_at();

alter table public.paytr_checkout_sessions enable row level security;

drop policy if exists "service role manages paytr checkout sessions" on public.paytr_checkout_sessions;
create policy "service role manages paytr checkout sessions"
  on public.paytr_checkout_sessions
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.apply_paytr_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_safe_payload jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  checkout_row public.paytr_checkout_sessions%rowtype;
  event_row public.payment_events%rowtype;
  plan_row public.plans%rowtype;
  subscription_row public.subscriptions%rowtype;
  starts_at timestamptz := now();
  ends_at timestamptz;
begin
  if current_role <> 'service_role' then
    raise exception 'apply_paytr_webhook_event requires service_role' using errcode = '42501';
  end if;

  insert into public.payment_events (
    provider,
    provider_event_id,
    event_type,
    processing_status,
    safe_payload,
    hash_verification_status
  )
  values (
    'paytr',
    p_provider_event_id,
    p_event_type,
    'stored',
    coalesce(p_safe_payload, '{}'::jsonb),
    'verified'
  )
  on conflict (provider, provider_event_id) do update
  set safe_payload = public.payment_events.safe_payload
  returning * into event_row;

  if event_row.processing_status in ('processed', 'ignored') then
    return jsonb_build_object(
      'event_id', event_row.id,
      'processing_status', event_row.processing_status
    );
  end if;

  if p_event_type not in ('success', 'failed') then
    return jsonb_build_object(
      'event_id', event_row.id,
      'processing_status', event_row.processing_status
    );
  end if;

  select * into checkout_row
  from public.paytr_checkout_sessions
  where merchant_oid = p_provider_event_id
  for update;

  if not found then
    update public.payment_events
    set processing_status = 'failed',
        processed_at = now()
    where id = event_row.id
    returning * into event_row;
    return jsonb_build_object(
      'event_id', event_row.id,
      'processing_status', event_row.processing_status
    );
  end if;

  update public.payment_events
  set profile_id = checkout_row.profile_id
  where id = event_row.id
  returning * into event_row;

  if p_event_type = 'failed' then
    update public.paytr_checkout_sessions
    set status = 'failed'
    where id = checkout_row.id;

    update public.payment_events
    set processing_status = 'failed',
        processed_at = now()
    where id = event_row.id
    returning * into event_row;

    return jsonb_build_object(
      'event_id', event_row.id,
      'processing_status', event_row.processing_status
    );
  end if;

  select * into plan_row
  from public.plans
  where id = checkout_row.plan_id
    and plan_kind = 'paid'
    and active = true;

  if not found then
    raise exception 'Paid plan not found for checkout session' using errcode = 'P0002';
  end if;

  if plan_row.billing_period = 'annual' then
    ends_at := starts_at + interval '1 year';
  else
    ends_at := starts_at + interval '1 month';
  end if;

  select * into subscription_row
  from public.subscriptions
  where profile_id = checkout_row.profile_id
  order by current_period_end desc
  limit 1
  for update;

  if found then
    update public.subscriptions
    set plan_id = plan_row.id,
        status = 'active',
        current_period_start = starts_at,
        current_period_end = ends_at,
        trial_started_at = null,
        trial_ends_at = null,
        paytr_subscription_ref = checkout_row.merchant_oid
    where id = subscription_row.id
    returning * into subscription_row;
  else
    insert into public.subscriptions (
      profile_id,
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end,
      paytr_subscription_ref
    )
    values (
      checkout_row.profile_id,
      checkout_row.user_id,
      plan_row.id,
      'active',
      starts_at,
      ends_at,
      checkout_row.merchant_oid
    )
    returning * into subscription_row;
  end if;

  update public.paytr_checkout_sessions
  set status = 'paid'
  where id = checkout_row.id;

  update public.payment_events
  set subscription_id = subscription_row.id,
      profile_id = checkout_row.profile_id,
      processing_status = 'processed',
      processed_at = now()
  where id = event_row.id
  returning * into event_row;

  insert into public.product_audit_events (
    actor_profile_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    checkout_row.profile_id,
    'billing_payment_event_processed',
    'subscription',
    subscription_row.id,
    jsonb_build_object(
      'payment_event_id', event_row.id,
      'provider_event_id', p_provider_event_id,
      'event_type', p_event_type,
      'plan_slug', plan_row.slug,
      'period_start', subscription_row.current_period_start,
      'period_end', subscription_row.current_period_end
    )
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'processing_status', event_row.processing_status
  );
end;
$$;

create or replace function public.repair_billing_subscription(
  p_action text,
  p_actor_user_id uuid,
  p_internal_note text,
  p_payment_event_id uuid default null,
  p_subscription_id uuid default null,
  p_paytr_subscription_ref text default null,
  p_status text default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  event_row public.payment_events%rowtype;
  subscription_row public.subscriptions%rowtype;
begin
  if current_role <> 'service_role' then
    raise exception 'repair_billing_subscription requires service_role' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_internal_note, ''))) < 8 then
    raise exception 'Internal note is required for billing repair' using errcode = '22023';
  end if;

  if p_action = 'mark_event_processed' then
    select * into event_row
    from public.payment_events
    where id = p_payment_event_id
    for update;

    if not found then
      raise exception 'Payment event not found' using errcode = 'P0002';
    end if;

    update public.payment_events
    set processing_status = 'processed',
        processed_at = coalesce(processed_at, now())
    where id = event_row.id
    returning * into event_row;

    insert into public.product_audit_events (
      actor_profile_id,
      action,
      target_type,
      target_id,
      metadata
    )
    values (
      event_row.profile_id,
      'billing_payment_event_repaired',
      'payment_event',
      event_row.id,
      jsonb_build_object(
        'actor_user_id', p_actor_user_id,
        'internal_note', p_internal_note,
        'repair_action', p_action
      )
    );

    return jsonb_build_object('repaired', true);
  end if;

  select * into subscription_row
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'Subscription not found' using errcode = 'P0002';
  end if;

  if p_action = 'attach_paytr_reference' then
    if p_paytr_subscription_ref is null or char_length(btrim(p_paytr_subscription_ref)) < 3 then
      raise exception 'PayTR reference is required' using errcode = '22023';
    end if;

    update public.subscriptions
    set paytr_subscription_ref = p_paytr_subscription_ref
    where id = subscription_row.id
    returning * into subscription_row;
  elsif p_action = 'reconcile_subscription_status' then
    if p_status not in ('active', 'past_due', 'cancelled', 'expired') then
      raise exception 'Unsupported billing repair status' using errcode = '22023';
    end if;

    update public.subscriptions
    set status = p_status
    where id = subscription_row.id
    returning * into subscription_row;
  else
    raise exception 'Unsupported billing repair action' using errcode = '22023';
  end if;

  insert into public.product_audit_events (
    actor_profile_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    subscription_row.profile_id,
    'billing_subscription_repaired',
    'subscription',
    subscription_row.id,
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'internal_note', p_internal_note,
      'repair_action', p_action,
      'status', subscription_row.status,
      'paytr_subscription_ref', subscription_row.paytr_subscription_ref
    )
  );

  return jsonb_build_object('repaired', true);
end;
$$;

revoke all on function public.apply_paytr_webhook_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.repair_billing_subscription(text, uuid, text, uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.apply_paytr_webhook_event(text, text, jsonb) to service_role;
grant execute on function public.repair_billing_subscription(text, uuid, text, uuid, uuid, text, text) to service_role;

grant all on public.paytr_checkout_sessions to service_role;
