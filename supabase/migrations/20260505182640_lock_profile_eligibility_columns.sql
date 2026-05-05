create or replace function private.prevent_profile_eligibility_self_promotion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated'
    and not private.is_admin()
    and coalesce(
      current_setting('request.profile_eligibility_transition', true),
      ''
    ) <> 'on'
    and (
      new.approval_status is distinct from old.approval_status
      or new.eligibility_status is distinct from old.eligibility_status
      or new.review_outcome is distinct from old.review_outcome
      or new.eligibility_updated_at is distinct from old.eligibility_updated_at
    ) then
    raise exception 'Profile eligibility fields are server-managed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_eligibility_self_promotion
  on public.profiles;

create trigger profiles_prevent_eligibility_self_promotion
before update of approval_status, eligibility_status, review_outcome, eligibility_updated_at
on public.profiles
for each row
execute function private.prevent_profile_eligibility_self_promotion();

revoke insert on public.profiles from authenticated;
