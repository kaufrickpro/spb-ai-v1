-- Step 10 profile/access foundation.
-- Adds only the profile visibility, public directory, and manuscript-access
-- surfaces needed before the matching run lifecycle lands.

alter table public.profiles
  add column if not exists public_contact_email text,
  add column if not exists public_phone text,
  add column if not exists website_url text,
  add column if not exists social_links jsonb not null default '[]'::jsonb,
  add column if not exists contact_visibility jsonb not null default '{}'::jsonb;

alter table public.profiles
  add constraint profiles_public_contact_email_length
    check (public_contact_email is null or char_length(public_contact_email) <= 254),
  add constraint profiles_public_phone_length
    check (public_phone is null or char_length(public_phone) <= 40),
  add constraint profiles_website_url_https
    check (website_url is null or website_url like 'https://%'),
  add constraint profiles_social_links_array
    check (jsonb_typeof(social_links) = 'array'),
  add constraint profiles_contact_visibility_object
    check (jsonb_typeof(contact_visibility) = 'object');

alter table public.author_profiles
  add column if not exists style_statement text,
  add column if not exists influences text[] not null default '{}'::text[];

alter table public.publisher_profiles
  add column if not exists publisher_name text,
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists biography text,
  add column if not exists editorial_note text,
  add column if not exists what_we_are_looking_for text,
  add column if not exists submission_guidelines text,
  add column if not exists recent_acquisitions text[] not null default '{}'::text[],
  add column if not exists best_selling_books text[] not null default '{}'::text[],
  add column if not exists accepted_primary_genres text[] not null default '{}'::text[],
  add column if not exists accepted_audience_categories text[] not null default '{}'::text[],
  add column if not exists accepted_manuscript_forms text[] not null default '{}'::text[],
  add column if not exists public_directory_status text not null default 'hidden',
  add column if not exists public_directory_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists public_directory_reviewed_at timestamptz;

alter table public.publisher_profiles
  add constraint publisher_profiles_website_url_https
    check (website_url is null or website_url like 'https://%'),
  add constraint publisher_profiles_logo_url_https
    check (logo_url is null or logo_url like 'https://%'),
  add constraint publisher_profiles_public_directory_status_check
    check (public_directory_status in ('hidden', 'approved', 'rejected'));

alter table public.manuscripts
  add column if not exists logline text,
  add column if not exists subgenres text[] not null default '{}'::text[],
  add column if not exists audience_categories text[] not null default '{}'::text[],
  add column if not exists manuscript_form text,
  add column if not exists declared_themes text[] not null default '{}'::text[],
  add column if not exists declared_content_warnings text[] not null default '{}'::text[],
  add column if not exists arc_summary text,
  add column if not exists chapter_summaries jsonb not null default '[]'::jsonb,
  add column if not exists profile_teaser text,
  add column if not exists author_profile_visibility text not null default 'match_revealed_only';

alter table public.manuscripts
  add constraint manuscripts_chapter_summaries_array
    check (jsonb_typeof(chapter_summaries) = 'array'),
  add constraint manuscripts_author_profile_visibility_check
    check (author_profile_visibility in ('match_revealed_only', 'requestable_from_author_profile'));

create table if not exists public.manuscript_access_requests (
  id uuid primary key default gen_random_uuid(),
  publisher_profile_id uuid not null references public.profiles(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_access_grants (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  manuscript_id uuid references public.manuscripts(id) on delete cascade,
  source text not null check (source in ('match_candidate', 'manuscript_access')),
  created_at timestamptz not null default now()
);

drop trigger if exists set_manuscript_access_requests_updated_at on public.manuscript_access_requests;
create trigger set_manuscript_access_requests_updated_at
  before update on public.manuscript_access_requests
  for each row execute function private.set_updated_at();

create index if not exists publisher_profiles_public_directory_status_idx
  on public.publisher_profiles(public_directory_status);

create index if not exists publisher_profiles_public_directory_approved_idx
  on public.publisher_profiles(profile_id)
  where public_directory_status = 'approved'
    and logo_url is not null
    and website_url like 'https://%';

create index if not exists profiles_role_eligibility_status_idx
  on public.profiles(role, eligibility_status);

create index if not exists manuscripts_author_eligibility_idx
  on public.manuscripts(author_id, eligibility_status);

create index if not exists manuscripts_requestable_visibility_idx
  on public.manuscripts(author_profile_visibility, eligibility_status);

create index if not exists manuscript_access_requests_publisher_status_idx
  on public.manuscript_access_requests(publisher_profile_id, status, requested_at desc);

create index if not exists manuscript_access_requests_author_status_idx
  on public.manuscript_access_requests(author_profile_id, status, requested_at desc);

create unique index if not exists manuscript_access_requests_one_pending_idx
  on public.manuscript_access_requests(publisher_profile_id, manuscript_id)
  where status = 'pending';

create unique index if not exists profile_access_grants_unique_idx
  on public.profile_access_grants(
    viewer_profile_id,
    target_profile_id,
    coalesce(manuscript_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source
  );

alter table public.manuscript_access_requests enable row level security;
alter table public.profile_access_grants enable row level security;

drop policy if exists "participants can read manuscript access requests" on public.manuscript_access_requests;
create policy "participants can read manuscript access requests"
  on public.manuscript_access_requests
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.id in (
          manuscript_access_requests.publisher_profile_id,
          manuscript_access_requests.author_profile_id
        )
    )
  );

drop policy if exists "service role manages manuscript access requests" on public.manuscript_access_requests;
create policy "service role manages manuscript access requests"
  on public.manuscript_access_requests
  for all
  using (false)
  with check (false);

drop policy if exists "viewer can read own profile access grants" on public.profile_access_grants;
create policy "viewer can read own profile access grants"
  on public.profile_access_grants
  for select
  to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.user_id = auth.uid()
        and viewer.id = profile_access_grants.viewer_profile_id
    )
  );

drop policy if exists "service role manages profile access grants" on public.profile_access_grants;
create policy "service role manages profile access grants"
  on public.profile_access_grants
  for all
  using (false)
  with check (false);
