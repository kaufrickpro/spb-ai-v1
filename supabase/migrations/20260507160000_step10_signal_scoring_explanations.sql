-- Step 10 scoring/explanation metadata and signal freshness.
-- Forward-only migration for existing remotes after 20260507124500_step10_matching_runs.sql.

alter table public.match_signal_sources
  add column if not exists source_fingerprint text,
  add column if not exists status text not null default 'current'
    check (status in ('current', 'stale', 'missing_optional')),
  add column if not exists summary text;

update public.match_signal_sources
set source_fingerprint = fingerprint
where source_fingerprint is null;

alter table public.match_signal_sources
  alter column source_fingerprint set not null,
  add constraint match_signal_sources_summary_length
    check (summary is null or char_length(summary) <= 900);

alter table public.match_candidates
  add column if not exists explanation_status text not null default 'not_requested'
    check (explanation_status in ('generated', 'not_requested'));

update public.match_candidates
set explanation_status = case
  when explanation is null then 'not_requested'
  else 'generated'
end;

alter table public.match_candidates
  add constraint match_candidates_top_explanation_status
    check (
      (rank <= 10 and explanation_status = 'generated' and explanation is not null)
      or (rank > 10 and explanation_status = 'not_requested' and explanation is null)
    );

alter table public.embedding_records
  add constraint embedding_records_no_vector_arrays
    check (
      not (metadata ? 'vector')
      and not (metadata ? 'embedding')
      and not (metadata ? 'values')
      and not (metadata ? 'numeric_vector')
      and coalesce((metadata ->> 'has_vector_array')::boolean, false) = false
    );

create index if not exists match_signal_sources_status_idx
  on public.match_signal_sources(status, updated_at desc);
