import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { MatchingServiceError } from "./errors.js";
import {
  compareScoredCandidates,
  isVisibleMatch,
  scoreMatchCandidate,
} from "./scoring.js";
import {
  upsertManuscriptSignals,
  upsertPublisherSignals,
} from "./signalSources.js";

type ServiceRoleDb = ReturnType<typeof createServiceRoleSupabaseClient>;

export async function createDbTracerCandidates(
  db: ServiceRoleDb,
  run: Record<string, unknown>,
): Promise<number> {
  if (run.direction === "author_to_publisher") {
    return createPublisherCandidates(db, run);
  }
  return createManuscriptCandidates(db, run);
}

async function createPublisherCandidates(
  db: ServiceRoleDb,
  run: Record<string, unknown>,
): Promise<number> {
  const { data: profiles, error } = await db
    .from("profiles")
    .select("id,display_name")
    .eq("role", "publisher")
    .eq("eligibility_status", "eligible")
    .limit(25);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to load publisher candidates",
      error,
    );
  }

  const publisherIds = (profiles ?? []).map((profile) => profile.id);
  const { data: details, error: detailsError } =
    publisherIds.length > 0
      ? await db
          .from("publisher_profiles")
          .select()
          .in("profile_id", publisherIds)
      : { data: [], error: null };
  if (detailsError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to load publisher matching details",
      detailsError,
    );
  }
  const detailsByProfileId = new Map(
    (details ?? []).map((detail) => [detail.profile_id, detail]),
  );
  const source = (run.input_snapshot ?? {}) as Record<string, unknown>;
  await upsertManuscriptSignals(db, {
    manuscript: normalizeManuscriptForSignals(source),
    manuscriptId: run.source_manuscript_id,
    ownerProfileId: run.requester_profile_id,
  });
  const scored = (profiles ?? [])
    .map((profile) => {
      const detail = detailsByProfileId.get(profile.id) ?? {};
      const candidate = {
        ...detail,
        displayName: profile.display_name,
        acceptedPrimaryGenres:
          detail.accepted_primary_genres ?? detail.focus_genres ?? [],
        acceptedAudienceCategories: detail.accepted_audience_categories ?? [],
        acceptedManuscriptForms: detail.accepted_manuscript_forms ?? [],
        submissionGuidelines: detail.submission_guidelines,
        editorWishlist: detail.editor_wishlist,
        recentAcquisitions: detail.recent_acquisitions ?? [],
        excludedTopics: detail.excluded_topics ?? [],
        whatWeAreLookingFor: detail.what_we_are_looking_for,
        imprintTone: detail.imprint_tone,
        marketPositioning: detail.market_positioning,
      };
      return {
        candidate,
        profile,
        result: scoreMatchCandidate({
          candidate,
          candidateKind: "publisher",
          rankSeed: `${run.id}:${profile.id}`,
          source,
        }),
        stableId: profile.id,
      };
    })
    .filter((item) => isVisibleMatch(item.result))
    .sort(compareScoredCandidates)
    .slice(0, 25);

  const rows = scored.map((item, index) => ({
    match_run_id: run.id,
    rank: index + 1,
    candidate_profile_id: item.profile.id,
    candidate_manuscript_id: null,
    candidate_type: "publisher",
    score_band: item.result.scoreBand,
    axis_bands: item.result.axisBands,
    explanation:
      index < 10
        ? buildBoundedExplanation("publisher", item.profile.display_name)
        : null,
    explanation_status: index < 10 ? "generated" : "not_requested",
    fit_reasons: item.result.fitReasons,
    risk_reasons: item.result.riskReasons,
    score_details: {
      title: item.profile.display_name,
      subtitle: "Publisher profile",
      profilePath: `/app/profiles/publishers/${item.profile.id}`,
      manuscriptProfilePath: null,
      penalties: item.result.penalties,
      finalScore: item.result.finalScore,
    },
    safe_snippets: item.result.safeSnippets,
  }));
  for (const item of scored) {
    await upsertPublisherSignals(db, {
      ownerProfileId: item.profile.id,
      publisher: item.candidate,
      publisherProfileId: item.profile.id,
    });
  }
  await persistCandidatesAndGrants(db, run, rows);
  return rows.length;
}

async function createManuscriptCandidates(
  db: ServiceRoleDb,
  run: Record<string, unknown>,
): Promise<number> {
  const { data: manuscripts, error } = await db
    .from("manuscripts")
    .select()
    .eq("eligibility_status", "eligible")
    .limit(50);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to load manuscript candidates",
      error,
    );
  }

  const authorIds = [
    ...new Set((manuscripts ?? []).map((manuscript) => manuscript.author_id)),
  ];
  const { data: authors, error: authorsError } =
    authorIds.length > 0
      ? await db
          .from("profiles")
          .select("id,user_id,display_name,eligibility_status")
          .in("user_id", authorIds)
          .eq("role", "author")
      : { data: [], error: null };
  if (authorsError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to load manuscript authors",
      authorsError,
    );
  }
  const authorsByUserId = new Map(
    (authors ?? []).map((author) => [author.user_id, author]),
  );

  const source = (run.input_snapshot ?? {}) as Record<string, unknown>;
  await upsertPublisherSignals(db, {
    ownerProfileId: run.requester_profile_id,
    publisher: source,
    publisherProfileId: run.source_publisher_profile_id,
  });
  const scored: Array<{
    author: Record<string, unknown>;
    manuscript: Record<string, unknown>;
    result: ReturnType<typeof scoreMatchCandidate>;
    stableId: string;
  }> = [];
  for (const manuscript of manuscripts ?? []) {
    if (!(await dbManuscriptHasProcessedSample(db, manuscript))) {
      continue;
    }

    const author = authorsByUserId.get(manuscript.author_id);
    if (!author || author.eligibility_status !== "eligible") {
      continue;
    }

    const candidate = {
      ...manuscript,
      genre: manuscript.genre,
      primaryGenre: manuscript.genre,
      subgenres: manuscript.subgenres ?? [],
      audienceCategories: manuscript.audience_categories ?? [],
      manuscriptForm: manuscript.manuscript_form,
      logline: manuscript.logline,
      synopsis: manuscript.synopsis,
      declaredThemes: manuscript.declared_themes ?? [],
      declaredContentWarnings: manuscript.declared_content_warnings ?? [],
      arcSummary: manuscript.arc_summary,
      chapterSummaries: manuscript.chapter_summaries ?? [],
      shortTeaser: manuscript.short_teaser ?? manuscript.profile_teaser,
    };
    const result = scoreMatchCandidate({
      candidate,
      candidateKind: "manuscript",
      rankSeed: `${run.id}:${manuscript.id}`,
      source,
    });
    if (!isVisibleMatch(result)) {
      continue;
    }
    scored.push({ author, manuscript, result, stableId: manuscript.id });
  }

  const rows = scored
    .sort(compareScoredCandidates)
    .slice(0, 25)
    .map((item, index) => ({
      match_run_id: run.id,
      rank: index + 1,
      candidate_profile_id: item.author.id,
      candidate_manuscript_id: item.manuscript.id,
      candidate_type: "manuscript",
      score_band: item.result.scoreBand,
      axis_bands: item.result.axisBands,
      explanation:
        index < 10
          ? buildBoundedExplanation("manuscript", item.manuscript.title)
          : null,
      explanation_status: index < 10 ? "generated" : "not_requested",
      fit_reasons: item.result.fitReasons,
      risk_reasons: item.result.riskReasons,
      score_details: {
        title: item.manuscript.title,
        subtitle: item.manuscript.genre,
        profilePath: `/app/profiles/authors/${item.author.id}`,
        manuscriptProfilePath: `/app/profiles/manuscripts/${item.manuscript.id}`,
        penalties: item.result.penalties,
        finalScore: item.result.finalScore,
      },
      safe_snippets: item.result.safeSnippets,
    }));
  for (const item of scored) {
    await upsertManuscriptSignals(db, {
      manuscript: {
        ...item.manuscript,
        audienceCategories: item.manuscript.audience_categories ?? [],
        declaredContentWarnings:
          item.manuscript.declared_content_warnings ?? [],
        declaredThemes: item.manuscript.declared_themes ?? [],
        manuscriptForm: item.manuscript.manuscript_form,
        profileTeaser: item.manuscript.profile_teaser,
      },
      manuscriptId: item.manuscript.id,
      ownerProfileId: item.author.id,
    });
  }
  await persistCandidatesAndGrants(db, run, rows);
  return rows.length;
}

function normalizeManuscriptForSignals(source: Record<string, unknown>) {
  return {
    ...source,
    audienceCategories: source.audienceCategories ?? [],
    declaredContentWarnings: source.declaredContentWarnings ?? [],
    declaredThemes: source.declaredThemes ?? [],
    manuscriptForm: source.manuscriptForm,
  };
}

function buildBoundedExplanation(
  kind: "publisher" | "manuscript",
  title: unknown,
) {
  const safeTitle =
    typeof title === "string" && title.trim() ? title.trim() : "this candidate";
  return kind === "publisher"
    ? `${safeTitle} is a visible match because its declared editorial signals overlap with the manuscript profile after soft-constraint checks.`
    : `${safeTitle} is a visible match because its manuscript signals overlap with the publisher profile after soft-constraint checks.`;
}

async function persistCandidatesAndGrants(
  db: ServiceRoleDb,
  run: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
) {
  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await db.from("match_candidates").insert(rows);
  if (insertError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to persist match candidates",
      insertError,
    );
  }

  await insertProfileAccessGrants(
    db,
    rows.map((row) => ({
      viewer_profile_id: run.requester_profile_id,
      target_profile_id: row.candidate_profile_id,
      manuscript_id: row.candidate_manuscript_id ?? null,
      source: "match_candidate",
    })),
  );
}

async function insertProfileAccessGrants(
  db: ServiceRoleDb,
  rows: Array<Record<string, unknown>>,
) {
  for (const row of rows) {
    let query = db
      .from("profile_access_grants")
      .select("id")
      .eq("viewer_profile_id", row.viewer_profile_id)
      .eq("target_profile_id", row.target_profile_id)
      .eq("source", row.source)
      .limit(1);
    query =
      row.manuscript_id == null
        ? query.is("manuscript_id", null)
        : query.eq("manuscript_id", row.manuscript_id);

    const { data: existing, error: existingError } = await query.maybeSingle();
    if (existingError) {
      throw new MatchingServiceError(
        "storage",
        "Failed to check match profile access grant",
        existingError,
      );
    }
    if (existing) {
      continue;
    }

    const { error } = await db.from("profile_access_grants").insert(row);
    if (error) {
      throw new MatchingServiceError(
        "storage",
        "Failed to persist match profile access grant",
        error,
      );
    }
  }
}

async function dbManuscriptHasProcessedSample(
  db: ServiceRoleDb,
  manuscript: Record<string, unknown>,
) {
  if (!manuscript.sample_document_id) return false;
  const { data, error } = await db
    .from("documents")
    .select("processing_status,eligibility_status")
    .eq("id", manuscript.sample_document_id)
    .maybeSingle();
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to check manuscript sample document",
      error,
    );
  }
  return (
    data?.processing_status === "succeeded" &&
    data.eligibility_status === "eligible"
  );
}
