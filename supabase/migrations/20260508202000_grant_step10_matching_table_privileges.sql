grant select on public.manuscript_access_requests to authenticated;
grant select on public.profile_access_grants to authenticated;
grant select on public.match_runs to authenticated;
grant select on public.match_candidates to authenticated;

grant all on public.manuscript_access_requests to service_role;
grant all on public.profile_access_grants to service_role;
grant all on public.match_signal_sources to service_role;
grant all on public.match_runs to service_role;
grant all on public.match_candidates to service_role;
