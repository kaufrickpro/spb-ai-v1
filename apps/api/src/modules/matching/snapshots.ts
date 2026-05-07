export const ALGORITHM_VERSION = "step10-tracer-2026-05-07";
export const CONSTRAINT_POLICY_VERSION = "soft-constraints-v1";
export const EMBEDDING_MODEL = "reference-only-local";
export const EXPLANATION_VERSION = "bounded-evidence-v1";
export const WEIGHT_PROFILE = "three-axis-default-v1";

export function safeManuscriptSnapshot(row: Record<string, unknown>) {
  return {
    title: row.title,
    genre: row.genre,
    language: row.language,
    wordCount: row.word_count,
    logline: row.logline,
    synopsis: row.synopsis,
    subgenres: row.subgenres ?? [],
    audienceCategories: row.audience_categories ?? [],
    manuscriptForm: row.manuscript_form,
    declaredThemes: row.declared_themes ?? [],
    declaredContentWarnings: row.declared_content_warnings ?? [],
    arcSummary: row.arc_summary,
    chapterSummaries: row.chapter_summaries ?? [],
  };
}

export function safePublisherSnapshot(
  profile: Record<string, unknown>,
  details: Record<string, unknown>,
) {
  return {
    title: details.publisher_name ?? profile.display_name,
    focusGenres: details.accepted_primary_genres ?? details.focus_genres ?? [],
    preferredLanguages: details.preferred_languages ?? [],
    acceptedAudienceCategories: details.accepted_audience_categories ?? [],
    acceptedManuscriptForms: details.accepted_manuscript_forms ?? [],
    submissionGuidelines: details.submission_guidelines,
    editorWishlist: details.editor_wishlist,
    recentAcquisitions: details.recent_acquisitions ?? [],
    excludedTopics: details.excluded_topics ?? [],
  };
}
