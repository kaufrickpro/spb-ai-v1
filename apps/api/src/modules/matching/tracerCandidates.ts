import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { MatchingServiceError } from "./errors.js";

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

  const rows = (profiles ?? []).map((profile, index) => ({
    match_run_id: run.id,
    rank: index + 1,
    candidate_profile_id: profile.id,
    candidate_manuscript_id: null,
    candidate_type: "publisher",
    score_band: index === 0 ? "strong" : "moderate",
    axis_bands: { premise: "strong", voice: "moderate", arc: "moderate" },
    explanation:
      index < 10
        ? "This publisher is a plausible fit based on declared acquisition interests."
        : null,
    fit_reasons: ["Genre and audience signals overlap."],
    risk_reasons: [],
    score_details: {
      title: profile.display_name,
      subtitle: "Publisher profile",
      profilePath: `/app/profiles/publishers/${profile.id}`,
      manuscriptProfilePath: null,
    },
    safe_snippets: [],
  }));
  await persistCandidatesAndGrants(db, run, rows);
  return rows.length;
}

async function createManuscriptCandidates(
  db: ServiceRoleDb,
  run: Record<string, unknown>,
): Promise<number> {
  const { data: manuscripts, error } = await db
    .from("manuscripts")
    .select("id,author_id,title,genre,sample_document_id,eligibility_status")
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

  const rows: Array<Record<string, unknown>> = [];
  for (const manuscript of manuscripts ?? []) {
    if (
      rows.length >= 25 ||
      !(await dbManuscriptHasProcessedSample(db, manuscript))
    ) {
      continue;
    }

    const author = authorsByUserId.get(manuscript.author_id);
    if (!author || author.eligibility_status !== "eligible") {
      continue;
    }

    rows.push({
      match_run_id: run.id,
      rank: rows.length + 1,
      candidate_profile_id: author.id,
      candidate_manuscript_id: manuscript.id,
      candidate_type: "manuscript",
      score_band: rows.length === 0 ? "strong" : "moderate",
      axis_bands: { premise: "moderate", voice: "moderate", arc: "strong" },
      explanation:
        rows.length < 10
          ? "This manuscript is a plausible fit based on declared publisher interests."
          : null,
      fit_reasons: ["Manuscript metadata aligns with publisher interests."],
      risk_reasons: [],
      score_details: {
        title: manuscript.title,
        subtitle: manuscript.genre,
        profilePath: `/app/profiles/authors/${author.id}`,
        manuscriptProfilePath: `/app/profiles/manuscripts/${manuscript.id}`,
      },
      safe_snippets: [],
    });
  }
  await persistCandidatesAndGrants(db, run, rows);
  return rows.length;
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
