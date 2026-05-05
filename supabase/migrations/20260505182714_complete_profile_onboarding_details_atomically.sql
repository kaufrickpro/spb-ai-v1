create or replace function private.complete_profile_onboarding_details(
  p_actor_user_id uuid,
  p_role text,
  p_biography text default null,
  p_primary_genre text default null,
  p_writing_languages text[] default null,
  p_focus_genres text[] default null,
  p_preferred_languages text[] default null,
  p_accepts_unsolicited boolean default null
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
      writing_languages
    )
    values (
      existing_profile.id,
      p_biography,
      p_primary_genre,
      p_writing_languages
    )
    on conflict (profile_id) do update
    set
      biography = excluded.biography,
      primary_genre = excluded.primary_genre,
      writing_languages = excluded.writing_languages;
  elsif p_role = 'publisher' then
    insert into public.publisher_profiles (
      profile_id,
      focus_genres,
      preferred_languages,
      accepts_unsolicited
    )
    values (
      existing_profile.id,
      p_focus_genres,
      p_preferred_languages,
      p_accepts_unsolicited
    )
    on conflict (profile_id) do update
    set
      focus_genres = excluded.focus_genres,
      preferred_languages = excluded.preferred_languages,
      accepts_unsolicited = excluded.accepts_unsolicited;
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
  p_accepts_unsolicited boolean default null
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
    p_accepts_unsolicited
  );
$$;

revoke all on function private.complete_profile_onboarding_details(
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  boolean
) from public, anon, authenticated;
revoke all on function public.complete_profile_onboarding_details(
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  boolean
) from public, anon, authenticated;

grant execute on function private.complete_profile_onboarding_details(
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  boolean
) to service_role;
grant execute on function public.complete_profile_onboarding_details(
  uuid,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  boolean
) to service_role;
