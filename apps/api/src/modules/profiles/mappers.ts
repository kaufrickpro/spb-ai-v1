import {
  type Profile,
  type ProfileDetails,
  ProfileDetailsSchema,
  ProfileResponseSchema,
} from "@marketplace/contracts";

export function mapDbProfile(row: Record<string, unknown>): Profile {
  return ProfileResponseSchema.shape.profile.parse({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    profilePhotoUrl: row.profile_photo_url,
    signupIntent: row.signup_intent,
    approvalStatus: row.approval_status,
    eligibilityStatus: row.eligibility_status ?? "limited",
    reviewOutcome: row.review_outcome ?? "needs_review",
    locale: row.locale,
    createdAt: normalizeDbDateTime(row.created_at),
    updatedAt: normalizeDbDateTime(row.updated_at),
  });
}

function normalizeDbDateTime(value: unknown): unknown {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return value;
  }

  return new Date(value).toISOString();
}

export function mapDbAuthorDetails(
  row: Record<string, unknown>,
): ProfileDetails {
  return ProfileDetailsSchema.parse({
    role: "author",
    biography: row.biography,
    primaryGenre: row.primary_genre,
    writingLanguages: row.writing_languages,
    styleStatement: row.style_statement ?? null,
    influences: row.influences ?? [],
  });
}

export function mapDbPublisherDetails(
  row: Record<string, unknown>,
): ProfileDetails {
  return ProfileDetailsSchema.parse({
    role: "publisher",
    publisherName: row.publisher_name ?? null,
    logoUrl: row.logo_url ?? null,
    websiteUrl: row.website_url ?? null,
    focusGenres: row.focus_genres,
    preferredLanguages: row.preferred_languages,
    acceptsUnsolicited: row.accepts_unsolicited,
    about: row.biography ?? null,
    editorialFocus: row.editorial_note ?? null,
    lookingFor: row.what_we_are_looking_for ?? null,
    acceptedAudienceCategories: row.accepted_audience_categories ?? [],
    acceptedManuscriptForms: row.accepted_manuscript_forms ?? [],
    submissionGuidelines: row.submission_guidelines ?? null,
    recentAcquisitions: row.recent_acquisitions ?? [],
    bestSellingBooks: row.best_selling_books ?? [],
    excludedTopics: row.excluded_topics ?? [],
    editorWishlist: row.editor_wishlist ?? null,
    imprintTone: row.imprint_tone ?? null,
    marketPositioning: row.market_positioning ?? null,
  });
}
