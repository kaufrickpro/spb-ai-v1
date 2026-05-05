alter table public.profiles
  add column if not exists eligibility_status text not null default 'limited',
  add column if not exists review_outcome text not null default 'needs_review',
  add column if not exists eligibility_updated_at timestamptz not null default now();

alter table public.profiles
  add constraint profiles_eligibility_status_check
  check (eligibility_status in ('eligible', 'limited', 'blocked', 'quarantined')),
  add constraint profiles_review_outcome_check
  check (review_outcome in ('auto_approved', 'needs_review', 'admin_approved', 'admin_rejected', 'quarantined'));

update public.profiles
set
  eligibility_status = case approval_status
    when 'approved' then 'eligible'
    when 'rejected' then 'blocked'
    else 'limited'
  end,
  review_outcome = case approval_status
    when 'approved' then 'admin_approved'
    when 'rejected' then 'admin_rejected'
    else 'needs_review'
  end,
  eligibility_updated_at = updated_at;

create index if not exists profiles_eligibility_status_idx
  on public.profiles(eligibility_status);
create index if not exists profiles_review_outcome_idx
  on public.profiles(review_outcome);

alter table public.manuscripts
  add column if not exists eligibility_status text not null default 'limited',
  add column if not exists review_outcome text not null default 'needs_review',
  add column if not exists eligibility_updated_at timestamptz not null default now();

alter table public.manuscripts
  add constraint manuscripts_eligibility_status_check
  check (eligibility_status in ('eligible', 'limited', 'blocked', 'quarantined')),
  add constraint manuscripts_review_outcome_check
  check (review_outcome in ('auto_approved', 'needs_review', 'admin_approved', 'admin_rejected', 'quarantined'));

update public.manuscripts
set
  eligibility_status = case admin_review_status
    when 'approved' then 'eligible'
    when 'rejected' then 'blocked'
    else 'limited'
  end,
  review_outcome = case admin_review_status
    when 'approved' then 'admin_approved'
    when 'rejected' then 'admin_rejected'
    else 'needs_review'
  end,
  eligibility_updated_at = updated_at;

create index if not exists manuscripts_eligibility_status_idx
  on public.manuscripts(eligibility_status);
create index if not exists manuscripts_review_outcome_idx
  on public.manuscripts(review_outcome);

alter table public.documents
  add column if not exists eligibility_status text not null default 'limited',
  add column if not exists review_outcome text not null default 'needs_review',
  add column if not exists eligibility_updated_at timestamptz not null default now();

alter table public.documents
  add constraint documents_eligibility_status_check
  check (eligibility_status in ('eligible', 'limited', 'blocked', 'quarantined')),
  add constraint documents_review_outcome_check
  check (review_outcome in ('auto_approved', 'needs_review', 'admin_approved', 'admin_rejected', 'quarantined'));

update public.documents
set
  eligibility_status = case admin_review_status
    when 'approved' then 'eligible'
    when 'rejected' then 'blocked'
    else 'limited'
  end,
  review_outcome = case admin_review_status
    when 'approved' then 'admin_approved'
    when 'rejected' then 'admin_rejected'
    else 'needs_review'
  end,
  eligibility_updated_at = updated_at;

create index if not exists documents_eligibility_status_idx
  on public.documents(eligibility_status);
create index if not exists documents_review_outcome_idx
  on public.documents(review_outcome);

alter table public.admin_reviews
  add column if not exists exception_queue text not null default 'needs_review',
  add column if not exists eligibility_status text not null default 'limited',
  add column if not exists review_outcome text not null default 'needs_review',
  add column if not exists source text not null default 'automated_checks',
  add column if not exists last_signal_at timestamptz;

alter table public.admin_reviews
  add constraint admin_reviews_exception_queue_check
  check (exception_queue in ('needs_review', 'quarantine', 'reports', 'system_failures')),
  add constraint admin_reviews_eligibility_status_check
  check (eligibility_status in ('eligible', 'limited', 'blocked', 'quarantined')),
  add constraint admin_reviews_review_outcome_check
  check (review_outcome in ('auto_approved', 'needs_review', 'admin_approved', 'admin_rejected', 'quarantined'));

update public.admin_reviews
set
  exception_queue = case
    when review_outcome = 'quarantined' then 'quarantine'
    else 'needs_review'
  end,
  eligibility_status = case status
    when 'approved' then 'eligible'
    when 'rejected' then 'blocked'
    else 'limited'
  end,
  review_outcome = case status
    when 'approved' then 'admin_approved'
    when 'rejected' then 'admin_rejected'
    else 'needs_review'
  end,
  last_signal_at = coalesce(last_signal_at, submitted_at);

create index if not exists admin_reviews_exception_queue_idx
  on public.admin_reviews(exception_queue);
create index if not exists admin_reviews_eligibility_status_idx
  on public.admin_reviews(eligibility_status);
create index if not exists admin_reviews_review_outcome_idx
  on public.admin_reviews(review_outcome);

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
  normalized_status text;
  next_eligibility_status text;
  next_review_outcome text;
  next_exception_queue text;
begin
  if auth.uid() is distinct from p_actor_user_id or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'quarantined', 'restored', 'suspended') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;

  if p_decision in ('rejected', 'quarantined', 'restored', 'suspended')
    and (p_rejection_note is null or char_length(trim(p_rejection_note)) < 5) then
    raise exception 'Internal note is required' using errcode = '22023';
  end if;

  normalized_status := case
    when p_decision in ('approved', 'restored') then 'approved'
    else 'rejected'
  end;
  next_eligibility_status := case
    when p_decision in ('approved', 'restored') then 'eligible'
    when p_decision = 'quarantined' then 'quarantined'
    else 'blocked'
  end;
  next_review_outcome := case
    when p_decision in ('approved', 'restored') then 'admin_approved'
    when p_decision = 'quarantined' then 'quarantined'
    else 'admin_rejected'
  end;
  next_exception_queue := case
    when p_decision = 'quarantined' then 'quarantine'
    else 'needs_review'
  end;

  update public.admin_reviews
  set
    status = normalized_status,
    rejection_note = p_rejection_note,
    decided_by_user_id = p_actor_user_id,
    decided_at = now(),
    eligibility_status = next_eligibility_status,
    review_outcome = next_review_outcome,
    exception_queue = next_exception_queue
  where id = p_review_id
  returning * into review_row;

  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;

  if review_row.entity_type = 'profile' then
    update public.profiles
    set
      approval_status = normalized_status,
      eligibility_status = next_eligibility_status,
      review_outcome = next_review_outcome,
      eligibility_updated_at = now()
    where id = review_row.entity_id;
  elsif review_row.entity_type = 'manuscript' then
    update public.manuscripts
    set
      admin_review_status = normalized_status,
      status = case
        when normalized_status = 'approved' then 'approved'
        else 'rejected'
      end,
      eligibility_status = next_eligibility_status,
      review_outcome = next_review_outcome,
      eligibility_updated_at = now()
    where id = review_row.entity_id;
  elsif review_row.entity_type = 'document' then
    update public.documents
    set
      admin_review_status = normalized_status,
      eligibility_status = next_eligibility_status,
      review_outcome = next_review_outcome,
      eligibility_updated_at = now()
    where id = review_row.entity_id;
  end if;

  action_name := case p_decision
    when 'approved' then 'review.approved'
    when 'rejected' then 'review.rejected'
    when 'quarantined' then 'review.quarantined'
    when 'restored' then 'review.restored'
    else 'review.suspended'
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
      'review_id', review_row.id,
      'internal_note', p_rejection_note,
      'eligibility_status', next_eligibility_status,
      'review_outcome', next_review_outcome
    )
  )
  returning * into audit_log_row;

  return jsonb_build_object(
    'review', to_jsonb(review_row),
    'auditLog', to_jsonb(audit_log_row)
  );
end;
$$;
