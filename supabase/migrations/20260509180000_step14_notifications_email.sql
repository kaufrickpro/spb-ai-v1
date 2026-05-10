alter table public.notifications
  drop constraint if exists notifications_metadata_is_safe,
  add constraint notifications_metadata_is_safe
    check (
      jsonb_typeof(metadata) = 'object'
      and pg_column_size(metadata) <= 4096
      and not (
        metadata ?| array[
          'message',
          'note',
          'rejection_note',
          'email',
          'phone',
          'contact',
          'signed_url',
          'download_url',
          'document_text',
          'chunk',
          'paytr_payload',
          'provider_payload',
          'raw_payload',
          'secret',
          'token'
        ]
      )
    );

create index if not exists notifications_recipient_unread_created_idx
  on public.notifications(recipient_profile_id, read_at, created_at desc, id desc);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 240),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid,
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  template_key text not null check (char_length(template_key) between 1 and 120),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  template_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in (
      'pending',
      'sending',
      'sent',
      'delivered',
      'failed_retryable',
      'failed_permanent',
      'bounced',
      'complained'
    )
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  provider text not null default 'local_fake' check (provider in ('local_fake', 'resend')),
  provider_message_id text,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint email_outbox_template_data_is_safe check (
    jsonb_typeof(template_data) = 'object'
    and pg_column_size(template_data) <= 4096
    and not (
      template_data ?| array[
        'message',
        'note',
        'rejection_note',
        'email',
        'phone',
        'contact',
        'signed_url',
        'download_url',
        'document_text',
        'chunk',
        'paytr_payload',
        'provider_payload',
        'raw_payload',
        'secret',
        'token'
      ]
    )
  )
);

create table if not exists public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('resend')),
  provider_event_id text not null,
  provider_message_id text,
  email_outbox_id uuid references public.email_outbox(id) on delete set null,
  event_type text not null check (
    event_type in (
      'email.sent',
      'email.delivered',
      'email.bounced',
      'email.complained',
      'email.failed'
    )
  ),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  constraint email_delivery_events_metadata_is_safe check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 2048
    and not (
      metadata ?| array[
        'message',
        'note',
        'rejection_note',
        'email',
        'phone',
        'contact',
        'signed_url',
        'download_url',
        'document_text',
        'chunk',
        'paytr_payload',
        'provider_payload',
        'raw_payload',
        'secret',
        'token'
      ]
    )
  )
);

drop trigger if exists email_outbox_set_updated_at on public.email_outbox;
create trigger email_outbox_set_updated_at
before update on public.email_outbox
for each row execute function private.set_updated_at();

create index if not exists email_outbox_status_next_attempt_idx
  on public.email_outbox(status, next_attempt_at, created_at);

create index if not exists email_outbox_provider_message_idx
  on public.email_outbox(provider_message_id)
  where provider_message_id is not null;

create index if not exists email_delivery_events_message_idx
  on public.email_delivery_events(provider_message_id)
  where provider_message_id is not null;

alter table public.email_outbox enable row level security;
alter table public.email_delivery_events enable row level security;

drop policy if exists "service role manages email outbox" on public.email_outbox;
create policy "service role manages email outbox"
  on public.email_outbox
  for all
  using (false)
  with check (false);

drop policy if exists "service role manages email delivery events" on public.email_delivery_events;
create policy "service role manages email delivery events"
  on public.email_delivery_events
  for all
  using (false)
  with check (false);

create or replace function private.email_template_cta_path(
  p_notification_type text,
  p_target_id uuid
) returns text
language sql
immutable
set search_path = private, public
as $$
  select case
    when p_notification_type = 'intro_request_created' then '/app/requests?box=received'
    when p_notification_type in (
      'intro_request_accepted',
      'intro_request_rejected',
      'intro_request_cancelled'
    ) then '/app/requests?box=all'
    when p_notification_type like 'profile_%' then '/app/profile'
    when p_notification_type like 'manuscript_%' then '/app/manuscripts/' || p_target_id::text
    when p_notification_type in (
      'subscription_activated',
      'subscription_renewed',
      'payment_failed',
      'subscription_inactive_downgrade'
    ) then '/app/billing'
    else '/app/dashboard'
  end;
$$;

create or replace function private.enqueue_email_outbox(
  p_idempotency_key text,
  p_recipient_profile_id uuid,
  p_template_key text,
  p_template_data jsonb
) returns void
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  profile_row public.profiles%rowtype;
  recipient_email text;
begin
  select * into profile_row
  from public.profiles
  where id = p_recipient_profile_id;

  if not found then
    return;
  end if;

  select email into recipient_email
  from auth.users
  where id = profile_row.user_id;

  if recipient_email is null or char_length(recipient_email) < 3 then
    return;
  end if;

  insert into public.email_outbox (
    idempotency_key,
    recipient_profile_id,
    recipient_user_id,
    recipient_email,
    template_key,
    locale,
    template_data,
    provider
  ) values (
    p_idempotency_key,
    profile_row.id,
    profile_row.user_id,
    recipient_email,
    p_template_key,
    coalesce(nullif(profile_row.locale, ''), 'tr'),
    p_template_data,
    'resend'
  )
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function private.enqueue_email_for_notification()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  actor_name text;
  target_label text;
begin
  if new.notification_type not in (
    'intro_request_created',
    'intro_request_accepted',
    'intro_request_rejected',
    'intro_request_cancelled',
    'profile_approved',
    'profile_rejected',
    'profile_quarantined',
    'manuscript_approved',
    'manuscript_rejected',
    'manuscript_quarantined'
  ) then
    return new;
  end if;

  select display_name into actor_name
  from public.profiles
  where id = new.actor_profile_id;

  target_label := coalesce(
    new.metadata->>'manuscript_title',
    new.metadata->>'publisher_name',
    new.metadata->>'profile_name',
    new.metadata->>'decision_label',
    'Smart Publishing Bridge'
  );

  perform private.enqueue_email_outbox(
    'notification:' || new.id::text,
    new.recipient_profile_id,
    new.notification_type,
    jsonb_build_object(
      'actorLabel', coalesce(actor_name, 'Smart Publishing Bridge'),
      'targetLabel', left(target_label, 160),
      'ctaPath', private.email_template_cta_path(new.notification_type, new.target_id)
    )
  );

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_email_outbox on public.notifications;
create trigger notifications_enqueue_email_outbox
after insert on public.notifications
for each row execute function private.enqueue_email_for_notification();

create or replace function private.create_decision_notification_from_audit()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  notification_type text;
  recipient_profile_id uuid;
  target_label text;
begin
  if new.target_type not in ('profile', 'manuscript') then
    return new;
  end if;

  notification_type := case
    when new.action in ('review.approved', 'profile.approved', 'manuscript.approved') then new.target_type || '_approved'
    when new.action in ('review.rejected', 'profile.rejected', 'manuscript.rejected') then new.target_type || '_rejected'
    when new.action in ('review.quarantined', 'profile.quarantined', 'manuscript.quarantined') then new.target_type || '_quarantined'
    else null
  end;

  if notification_type is null then
    return new;
  end if;

  if new.target_type = 'profile' then
    recipient_profile_id := new.target_id;
    select display_name into target_label from public.profiles where id = new.target_id;
  else
    select profiles.id, manuscripts.title
      into recipient_profile_id, target_label
    from public.manuscripts
    join public.profiles on profiles.user_id = manuscripts.author_id
    where manuscripts.id = new.target_id;
  end if;

  if recipient_profile_id is null then
    return new;
  end if;

  insert into public.notifications (
    recipient_profile_id,
    actor_profile_id,
    notification_type,
    target_type,
    target_id,
    metadata
  ) values (
    recipient_profile_id,
    null,
    notification_type,
    new.target_type,
    new.target_id,
    jsonb_build_object('decision_label', coalesce(target_label, 'Review decision'))
  );

  return new;
end;
$$;

drop trigger if exists admin_audit_logs_create_decision_notification on public.admin_audit_logs;
create trigger admin_audit_logs_create_decision_notification
after insert on public.admin_audit_logs
for each row execute function private.create_decision_notification_from_audit();

create or replace function private.enqueue_billing_email_from_audit()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  template_key text;
begin
  template_key := case
    when new.action = 'billing_subscription_activated' then 'subscription_activated'
    when new.action = 'billing_subscription_renewed' then 'subscription_renewed'
    when new.action = 'billing_subscription_inactive_downgrade' then 'subscription_inactive_downgrade'
    else null
  end;

  if template_key is null or new.actor_profile_id is null then
    return new;
  end if;

  perform private.enqueue_email_outbox(
    'billing-audit:' || new.id::text,
    new.actor_profile_id,
    template_key,
    jsonb_build_object(
      'targetLabel', 'Billing',
      'planLabel', coalesce(new.metadata->>'plan_slug', 'Pro'),
      'ctaPath', '/app/billing'
    )
  );

  return new;
end;
$$;

drop trigger if exists product_audit_events_enqueue_billing_email on public.product_audit_events;
create trigger product_audit_events_enqueue_billing_email
after insert on public.product_audit_events
for each row execute function private.enqueue_billing_email_from_audit();

create or replace function private.enqueue_payment_failed_email()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if new.event_type not in ('failed', 'payment_failed') or new.profile_id is null then
    return new;
  end if;

  perform private.enqueue_email_outbox(
    'payment-event:' || new.id::text,
    new.profile_id,
    'payment_failed',
    jsonb_build_object(
      'targetLabel', 'Payment',
      'planLabel', 'Pro',
      'ctaPath', '/app/billing'
    )
  );

  return new;
end;
$$;

drop trigger if exists payment_events_enqueue_failed_email on public.payment_events;
create trigger payment_events_enqueue_failed_email
after insert or update on public.payment_events
for each row execute function private.enqueue_payment_failed_email();

create or replace function public.claim_email_outbox(p_limit integer default 25)
returns setof public.email_outbox
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_role <> 'service_role' then
    raise exception 'claim_email_outbox requires service_role' using errcode = '42501';
  end if;

  return query
  with claimed as (
    select id
    from public.email_outbox
    where status in ('pending', 'failed_retryable')
      and (next_attempt_at is null or next_attempt_at <= now())
    order by created_at asc
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  update public.email_outbox outbox
  set status = 'sending',
      attempt_count = outbox.attempt_count + 1,
      updated_at = now()
  from claimed
  where outbox.id = claimed.id
  returning outbox.*;
end;
$$;

revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;

grant select, update, insert on public.notifications to service_role;
grant all on public.email_outbox to service_role;
grant all on public.email_delivery_events to service_role;
