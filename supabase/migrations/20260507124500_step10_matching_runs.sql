-- Step 10 matching run lifecycle and remaining matching input fields.
-- This is a forward migration for existing remotes that may already have
-- applied the Phase 0 profile/access foundation.

alter table public.manuscripts
  add column if not exists comp_titles text[] not null default '{}'::text[];

alter table public.publisher_profiles
  add column if not exists excluded_topics text[] not null default '{}'::text[],
  add column if not exists editor_wishlist text,
  add column if not exists imprint_tone text,
  add column if not exists market_positioning text;

alter table public.manuscripts
  add constraint manuscripts_comp_titles_bounded
    check (cardinality(comp_titles) <= 8),
  add constraint manuscripts_declared_content_warnings_bounded
    check (cardinality(declared_content_warnings) <= 12),
  add constraint manuscripts_profile_teaser_length
    check (profile_teaser is null or char_length(profile_teaser) <= 500);

alter table public.publisher_profiles
  add constraint publisher_profiles_excluded_topics_bounded
    check (cardinality(excluded_topics) <= 20),
  add constraint publisher_profiles_editor_wishlist_length
    check (editor_wishlist is null or char_length(editor_wishlist) <= 2000),
  add constraint publisher_profiles_imprint_tone_length
    check (imprint_tone is null or char_length(imprint_tone) <= 1000),
  add constraint publisher_profiles_market_positioning_length
    check (market_positioning is null or char_length(market_positioning) <= 1000);

drop function if exists public.complete_profile_onboarding_details(
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  boolean
);
drop function if exists private.complete_profile_onboarding_details(
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  boolean
);

create or replace function private.complete_profile_onboarding_details(
  p_actor_user_id uuid,
  p_role text,
  p_biography text default null,
  p_primary_genre text default null,
  p_writing_languages text[] default null,
  p_focus_genres text[] default null,
  p_preferred_languages text[] default null,
  p_accepts_unsolicited boolean default null,
  p_style_statement text default null,
  p_influences text[] default null,
  p_publisher_name text default null,
  p_logo_url text default null,
  p_website_url text default null,
  p_publisher_biography text default null,
  p_editorial_note text default null,
  p_what_we_are_looking_for text default null,
  p_accepted_primary_genres text[] default null,
  p_accepted_audience_categories text[] default null,
  p_accepted_manuscript_forms text[] default null,
  p_submission_guidelines text default null,
  p_recent_acquisitions text[] default null,
  p_best_selling_books text[] default null,
  p_excluded_topics text[] default null,
  p_editor_wishlist text default null,
  p_imprint_tone text default null,
  p_market_positioning text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_profile public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
begin
  if auth.role() <> 'service_role'
    and auth.uid() is distinct from p_actor_user_id then
    raise exception 'Profile onboarding completion requires the authenticated user'
      using errcode = '42501';
  end if;

  select *
  into existing_profile
  from public.profiles
  where user_id = p_actor_user_id
    and role in ('author', 'publisher')
  for update;

  if not found then
    raise exception 'No profile found for this account' using errcode = 'P0002';
  end if;

  if existing_profile.role <> p_role then
    raise exception 'Onboarding details must match the saved marketplace role'
      using errcode = 'P0004';
  end if;

  if p_role = 'author' then
    insert into public.author_profiles (
      profile_id,
      biography,
      primary_genre,
      writing_languages,
      style_statement,
      influences
    )
    values (
      existing_profile.id,
      p_biography,
      p_primary_genre,
      p_writing_languages,
      p_style_statement,
      coalesce(p_influences, '{}'::text[])
    )
    on conflict (profile_id) do update
    set
      biography = excluded.biography,
      primary_genre = excluded.primary_genre,
      writing_languages = excluded.writing_languages,
      style_statement = excluded.style_statement,
      influences = excluded.influences;
  elsif p_role = 'publisher' then
    insert into public.publisher_profiles (
      profile_id,
      focus_genres,
      preferred_languages,
      accepts_unsolicited,
      publisher_name,
      logo_url,
      website_url,
      biography,
      editorial_note,
      what_we_are_looking_for,
      accepted_primary_genres,
      accepted_audience_categories,
      accepted_manuscript_forms,
      submission_guidelines,
      recent_acquisitions,
      best_selling_books,
      excluded_topics,
      editor_wishlist,
      imprint_tone,
      market_positioning
    )
    values (
      existing_profile.id,
      p_focus_genres,
      p_preferred_languages,
      p_accepts_unsolicited,
      p_publisher_name,
      p_logo_url,
      p_website_url,
      p_publisher_biography,
      p_editorial_note,
      p_what_we_are_looking_for,
      coalesce(p_accepted_primary_genres, p_focus_genres, '{}'::text[]),
      coalesce(p_accepted_audience_categories, '{}'::text[]),
      coalesce(p_accepted_manuscript_forms, '{}'::text[]),
      p_submission_guidelines,
      coalesce(p_recent_acquisitions, '{}'::text[]),
      coalesce(p_best_selling_books, '{}'::text[]),
      coalesce(p_excluded_topics, '{}'::text[]),
      p_editor_wishlist,
      p_imprint_tone,
      p_market_positioning
    )
    on conflict (profile_id) do update
    set
      focus_genres = excluded.focus_genres,
      preferred_languages = excluded.preferred_languages,
      accepts_unsolicited = excluded.accepts_unsolicited,
      publisher_name = excluded.publisher_name,
      logo_url = excluded.logo_url,
      website_url = excluded.website_url,
      biography = excluded.biography,
      editorial_note = excluded.editorial_note,
      what_we_are_looking_for = excluded.what_we_are_looking_for,
      accepted_primary_genres = excluded.accepted_primary_genres,
      accepted_audience_categories = excluded.accepted_audience_categories,
      accepted_manuscript_forms = excluded.accepted_manuscript_forms,
      submission_guidelines = excluded.submission_guidelines,
      recent_acquisitions = excluded.recent_acquisitions,
      best_selling_books = excluded.best_selling_books,
      excluded_topics = excluded.excluded_topics,
      editor_wishlist = excluded.editor_wishlist,
      imprint_tone = excluded.imprint_tone,
      market_positioning = excluded.market_positioning;
  else
    raise exception 'Unsupported marketplace role' using errcode = 'P0004';
  end if;

  perform set_config('request.profile_eligibility_transition', 'on', true);

  update public.profiles
  set
    approval_status = 'approved',
    eligibility_status = 'eligible',
    review_outcome = 'auto_approved',
    eligibility_updated_at = now()
  where id = existing_profile.id
    and user_id = p_actor_user_id
    and role = p_role
  returning * into updated_profile;

  if not found then
    raise exception 'Failed to update profile eligibility'
      using errcode = 'P0005';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.complete_profile_onboarding_details(
  p_actor_user_id uuid,
  p_role text,
  p_biography text default null,
  p_primary_genre text default null,
  p_writing_languages text[] default null,
  p_focus_genres text[] default null,
  p_preferred_languages text[] default null,
  p_accepts_unsolicited boolean default null,
  p_style_statement text default null,
  p_influences text[] default null,
  p_publisher_name text default null,
  p_logo_url text default null,
  p_website_url text default null,
  p_publisher_biography text default null,
  p_editorial_note text default null,
  p_what_we_are_looking_for text default null,
  p_accepted_primary_genres text[] default null,
  p_accepted_audience_categories text[] default null,
  p_accepted_manuscript_forms text[] default null,
  p_submission_guidelines text default null,
  p_recent_acquisitions text[] default null,
  p_best_selling_books text[] default null,
  p_excluded_topics text[] default null,
  p_editor_wishlist text default null,
  p_imprint_tone text default null,
  p_market_positioning text default null
)
returns public.profiles
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.complete_profile_onboarding_details(
    p_actor_user_id,
    p_role,
    p_biography,
    p_primary_genre,
    p_writing_languages,
    p_focus_genres,
    p_preferred_languages,
    p_accepts_unsolicited,
    p_style_statement,
    p_influences,
    p_publisher_name,
    p_logo_url,
    p_website_url,
    p_publisher_biography,
    p_editorial_note,
    p_what_we_are_looking_for,
    p_accepted_primary_genres,
    p_accepted_audience_categories,
    p_accepted_manuscript_forms,
    p_submission_guidelines,
    p_recent_acquisitions,
    p_best_selling_books,
    p_excluded_topics,
    p_editor_wishlist,
    p_imprint_tone,
    p_market_positioning
  );
$$;

revoke all on function private.complete_profile_onboarding_details(
  uuid, text, text, text, text[], text[], text[], boolean, text, text[],
  text, text, text, text, text, text, text[], text[], text[], text, text[],
  text[], text[], text, text, text
) from public, anon, authenticated;
revoke all on function public.complete_profile_onboarding_details(
  uuid, text, text, text, text[], text[], text[], boolean, text, text[],
  text, text, text, text, text, text, text[], text[], text[], text, text[],
  text[], text[], text, text, text
) from public, anon, authenticated;

grant execute on function private.complete_profile_onboarding_details(
  uuid, text, text, text, text[], text[], text[], boolean, text, text[],
  text, text, text, text, text, text, text[], text[], text[], text, text[],
  text[], text[], text, text, text
) to service_role;
grant execute on function public.complete_profile_onboarding_details(
  uuid, text, text, text, text[], text[], text[], boolean, text, text[],
  text, text, text, text, text, text, text[], text[], text[], text, text[],
  text[], text[], text, text, text
) to service_role;

create table if not exists public.match_signal_sources (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  manuscript_id uuid references public.manuscripts(id) on delete cascade,
  publisher_profile_id uuid references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('premise', 'voice', 'arc', 'guidelines', 'wishlist', 'catalog')),
  fingerprint text not null,
  embedding_record_id uuid references public.embedding_records(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (manuscript_id is not null and publisher_profile_id is null)
    or (manuscript_id is null and publisher_profile_id is not null)
  )
);

create table if not exists public.match_runs (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('author_to_publisher', 'publisher_to_manuscript')),
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  source_manuscript_id uuid references public.manuscripts(id) on delete cascade,
  source_publisher_profile_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  stale boolean not null default false,
  candidate_count integer not null default 0 check (candidate_count >= 0 and candidate_count <= 25),
  failure_code text,
  input_fingerprint text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  matching_algorithm_version text not null,
  constraint_policy_version text not null,
  embedding_model text not null,
  explanation_version text not null,
  explanation_model text,
  weight_profile text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (direction = 'author_to_publisher' and source_manuscript_id is not null and source_publisher_profile_id is null)
    or (direction = 'publisher_to_manuscript' and source_manuscript_id is null and source_publisher_profile_id is not null)
  )
);

create table if not exists public.match_candidates (
  id uuid primary key default gen_random_uuid(),
  match_run_id uuid not null references public.match_runs(id) on delete cascade,
  rank integer not null check (rank between 1 and 25),
  candidate_profile_id uuid not null references public.profiles(id) on delete cascade,
  candidate_manuscript_id uuid references public.manuscripts(id) on delete cascade,
  candidate_type text not null check (candidate_type in ('publisher', 'manuscript')),
  score_band text not null check (score_band in ('strong', 'moderate', 'weak')),
  axis_bands jsonb not null default '{}'::jsonb,
  explanation text,
  fit_reasons text[] not null default '{}'::text[],
  risk_reasons text[] not null default '{}'::text[],
  score_details jsonb not null default '{}'::jsonb,
  safe_snippets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (candidate_type = 'publisher' or candidate_manuscript_id is not null),
  check (explanation is null or char_length(explanation) <= 1200),
  unique (match_run_id, rank)
);

drop trigger if exists set_match_signal_sources_updated_at on public.match_signal_sources;
create trigger set_match_signal_sources_updated_at
  before update on public.match_signal_sources
  for each row execute function private.set_updated_at();

drop trigger if exists set_match_runs_updated_at on public.match_runs;
create trigger set_match_runs_updated_at
  before update on public.match_runs
  for each row execute function private.set_updated_at();

create unique index if not exists match_signal_sources_unique_idx
  on public.match_signal_sources(
    owner_profile_id,
    coalesce(manuscript_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(publisher_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    signal_type
  );

create index if not exists match_runs_requester_created_idx
  on public.match_runs(requester_profile_id, created_at desc);

create index if not exists match_runs_source_manuscript_idx
  on public.match_runs(source_manuscript_id, created_at desc)
  where source_manuscript_id is not null;

create index if not exists match_runs_source_publisher_idx
  on public.match_runs(source_publisher_profile_id, created_at desc)
  where source_publisher_profile_id is not null;

create index if not exists match_candidates_run_rank_idx
  on public.match_candidates(match_run_id, rank);

create index if not exists match_candidates_profile_idx
  on public.match_candidates(candidate_profile_id);

create index if not exists match_candidates_manuscript_idx
  on public.match_candidates(candidate_manuscript_id)
  where candidate_manuscript_id is not null;

alter table public.match_signal_sources enable row level security;
alter table public.match_runs enable row level security;
alter table public.match_candidates enable row level security;

drop policy if exists "participants can read own match runs" on public.match_runs;
create policy "participants can read own match runs"
  on public.match_runs
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.id = match_runs.requester_profile_id
    )
  );

drop policy if exists "participants can read own match candidates" on public.match_candidates;
create policy "participants can read own match candidates"
  on public.match_candidates
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.match_runs run
      join public.profiles viewer on viewer.id = run.requester_profile_id
      where run.id = match_candidates.match_run_id
        and viewer.user_id = auth.uid()
    )
  );

drop policy if exists "service role manages match signal sources" on public.match_signal_sources;
create policy "service role manages match signal sources"
  on public.match_signal_sources
  for all
  using (false)
  with check (false);

drop policy if exists "service role manages match runs" on public.match_runs;
create policy "service role manages match runs"
  on public.match_runs
  for all
  using (false)
  with check (false);

drop policy if exists "service role manages match candidates" on public.match_candidates;
create policy "service role manages match candidates"
  on public.match_candidates
  for all
  using (false)
  with check (false);
