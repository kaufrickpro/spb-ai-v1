alter table public.match_candidates
  add column if not exists detail_snapshot jsonb not null default '{}'::jsonb;

update public.match_candidates
set score_details = score_details - 'scoreDebug'
where score_details ? 'scoreDebug';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_candidates_score_details_no_score_debug'
  ) then
    alter table public.match_candidates
      add constraint match_candidates_score_details_no_score_debug
      check (not (score_details ? 'scoreDebug'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_candidates_detail_snapshot_object'
  ) then
    alter table public.match_candidates
      add constraint match_candidates_detail_snapshot_object
      check (jsonb_typeof(detail_snapshot) = 'object');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_candidates_detail_snapshot_no_forbidden_top_keys'
  ) then
    alter table public.match_candidates
      add constraint match_candidates_detail_snapshot_no_forbidden_top_keys
      check (
        not (
          detail_snapshot ?| array[
            'scoreDebug',
            'rawScore',
            'finalScore',
            'vectors',
            'embeddings',
            'providerPayload',
            'prompt',
            'signedUrl',
            'downloadUrl',
            'privateContact',
            'email',
            'phone',
            'adminNotes',
            'billingState',
            'documentChunks',
            'fullManuscriptText',
            'fullSynopsis',
            'chapterSummaries'
          ]
        )
      );
  end if;
end $$;
