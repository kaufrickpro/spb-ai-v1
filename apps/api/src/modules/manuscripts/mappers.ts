import type { Manuscript, Document } from "@marketplace/contracts";

// ─── DB row → domain object mappers ──────────────────────────────────────────

export function mapDbManuscript(row: Record<string, unknown>): Manuscript {
  return {
    id: row["id"] as string,
    authorId: row["author_id"] as string,
    title: row["title"] as string,
    genre: row["genre"] as string,
    language: row["language"] as string,
    wordCount:
      row["word_count"] !== null && row["word_count"] !== undefined
        ? Number(row["word_count"])
        : null,
    synopsis: (row["synopsis"] as string | null) ?? null,
    targetAgeMin:
      row["target_age_min"] !== null && row["target_age_min"] !== undefined
        ? Number(row["target_age_min"])
        : null,
    targetAgeMax:
      row["target_age_max"] !== null && row["target_age_max"] !== undefined
        ? Number(row["target_age_max"])
        : null,
    logline: (row["logline"] as string | null) ?? null,
    subgenres: ((row["subgenres"] as string[] | null) ?? []).filter(Boolean),
    audienceCategories: (
      (row["audience_categories"] as string[] | null) ?? []
    ).filter(Boolean),
    manuscriptForm: (row["manuscript_form"] as string | null) ?? null,
    compTitles: ((row["comp_titles"] as string[] | null) ?? []).filter(Boolean),
    declaredThemes: ((row["declared_themes"] as string[] | null) ?? []).filter(
      Boolean,
    ),
    declaredContentWarnings: (
      (row["declared_content_warnings"] as string[] | null) ?? []
    ).filter(Boolean),
    arcSummary: (row["arc_summary"] as string | null) ?? null,
    chapterSummaries: Array.isArray(row["chapter_summaries"])
      ? (row["chapter_summaries"] as Manuscript["chapterSummaries"])
      : [],
    shortTeaser: (row["profile_teaser"] as string | null) ?? null,
    requestable:
      row["author_profile_visibility"] === "requestable_from_author_profile",
    status: row["status"] as Manuscript["status"],
    adminReviewStatus: row[
      "admin_review_status"
    ] as Manuscript["adminReviewStatus"],
    eligibilityStatus: (row["eligibility_status"] ??
      "limited") as Manuscript["eligibilityStatus"],
    reviewOutcome: (row["review_outcome"] ??
      "needs_review") as Manuscript["reviewOutcome"],
    sampleDocumentId: (row["sample_document_id"] as string | null) ?? null,
    createdAt: normalizeDbDateTime(row["created_at"]) as string,
    updatedAt: normalizeDbDateTime(row["updated_at"]) as string,
  };
}

export function mapDbDocument(row: Record<string, unknown>): Document {
  return {
    id: row["id"] as string,
    manuscriptId: row["manuscript_id"] as string,
    authorId: row["author_id"] as string,
    originalFileName: row["original_file_name"] as string,
    mimeType: row["mime_type"] as Document["mimeType"],
    fileSizeBytes: Number(row["file_size_bytes"]),
    storageStatus: row["storage_status"] as Document["storageStatus"],
    processingStatus: row["processing_status"] as Document["processingStatus"],
    processingFailureCode:
      (row["processing_failure_code"] as Document["processingFailureCode"]) ??
      null,
    adminReviewStatus: row[
      "admin_review_status"
    ] as Document["adminReviewStatus"],
    eligibilityStatus: (row["eligibility_status"] ??
      "limited") as Document["eligibilityStatus"],
    reviewOutcome: (row["review_outcome"] ??
      "needs_review") as Document["reviewOutcome"],
    uploadId: row["upload_id"] as string,
    retentionExpiresAt:
      normalizeNullableDbDateTime(row["retention_expires_at"]) ?? null,
    createdAt: normalizeDbDateTime(row["created_at"]) as string,
    updatedAt: normalizeDbDateTime(row["updated_at"]) as string,
  };
}

function normalizeDbDateTime(value: unknown): unknown {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return value;
  }

  return new Date(value).toISOString();
}

function normalizeNullableDbDateTime(
  value: unknown,
): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return normalizeDbDateTime(value) as string;
}
