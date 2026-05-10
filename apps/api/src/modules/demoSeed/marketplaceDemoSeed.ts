import type { SupabaseClient, User } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "../admin/bootstrapFirstAdmin.js";

export const DEFAULT_DEMO_AUTHOR_COUNT = 50;
export const DEFAULT_DEMO_PUBLISHER_COUNT = 50;
export const DEFAULT_DEMO_EMAIL_DOMAIN = "example.test";
export const DEFAULT_DEMO_PASSWORD = "Demo-seed-password-1";

type MarketplaceRole = "author" | "publisher";

export type DemoSeedOptions = {
  authorCount: number;
  emailDomain: string;
  password: string;
  prefix: string;
  publisherCount: number;
};

export type DemoSeedResult = {
  authorCount: number;
  firstAuthorEmail: string | null;
  firstPublisherEmail: string | null;
  manuscriptsCreatedOrUpdated: number;
  password: string;
  publisherCount: number;
};

type DemoIdentity = {
  displayName: string;
  email: string;
  index: number;
  role: MarketplaceRole;
};

const GENRES = [
  "Roman",
  "Bilim Kurgu",
  "Fantastik",
  "Polisiye",
  "Romantik",
  "Tarihi Kurgu",
  "Genç Yetişkin",
  "Edebiyat",
  "Çocuk",
  "Gerilim",
] as const;

const AUDIENCES = [
  "adult",
  "young_adult",
  "middle_grade",
  "crossover",
] as const;

const FORMS = ["novel", "novella", "story_collection"] as const;

const THEMES = [
  "belonging",
  "family",
  "memory",
  "justice",
  "migration",
  "ambition",
  "friendship",
  "identity",
] as const;

export async function seedMarketplaceDemoData(input: {
  client: SupabaseClient;
  options: DemoSeedOptions;
}): Promise<DemoSeedResult> {
  const authors = Array.from(
    { length: input.options.authorCount },
    (_, index) => buildIdentity(input.options, "author", index + 1),
  );
  const publishers = Array.from(
    { length: input.options.publisherCount },
    (_, index) => buildIdentity(input.options, "publisher", index + 1),
  );

  for (const publisher of publishers) {
    const user = await ensureDemoAuthUser(input.client, {
      email: publisher.email,
      password: input.options.password,
      role: publisher.role,
    });
    const profileId = await ensureDemoProfile(input.client, publisher, user);
    await ensureDemoPublisherDetails(input.client, publisher, profileId);
  }

  let manuscriptsCreatedOrUpdated = 0;
  for (const author of authors) {
    const user = await ensureDemoAuthUser(input.client, {
      email: author.email,
      password: input.options.password,
      role: author.role,
    });
    await ensureDemoProfile(input.client, author, user);
    await ensureDemoAuthorDetails(input.client, author, user.id);
    await ensureDemoManuscript(input.client, author, user.id);
    manuscriptsCreatedOrUpdated += 1;
  }

  return {
    authorCount: authors.length,
    firstAuthorEmail: authors[0]?.email ?? null,
    firstPublisherEmail: publishers[0]?.email ?? null,
    manuscriptsCreatedOrUpdated,
    password: input.options.password,
    publisherCount: publishers.length,
  };
}

function buildIdentity(
  options: DemoSeedOptions,
  role: MarketplaceRole,
  index: number,
): DemoIdentity {
  const padded = String(index).padStart(3, "0");
  const roleSlug = role === "author" ? "author" : "publisher";
  const namePrefix = role === "author" ? "Demo Author" : "Demo Publisher";

  return {
    displayName: `${namePrefix} ${padded}`,
    email: `${options.prefix}-${roleSlug}-${padded}@${options.emailDomain}`
      .trim()
      .toLowerCase(),
    index,
    role,
  };
}

async function ensureDemoAuthUser(
  client: SupabaseClient,
  input: {
    email: string;
    password: string;
    role: MarketplaceRole;
  },
): Promise<User> {
  const existingUser = await findAuthUserByEmail(client, input.email);
  const userMetadata = {
    demoSeed: "marketplace_demo",
    marketplaceRole: input.role,
  };

  if (existingUser?.id) {
    const { data, error } = await client.auth.admin.updateUserById(
      existingUser.id,
      {
        email: input.email,
        email_confirm: true,
        password: input.password,
        user_metadata: userMetadata,
      },
    );
    if (error) throw error;
    if (!data.user?.id) {
      throw new Error(`Failed to update demo auth user ${input.email}`);
    }
    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    password: input.password,
    user_metadata: userMetadata,
  });
  if (error) throw error;
  if (!data.user?.id) {
    throw new Error(`Failed to create demo auth user ${input.email}`);
  }
  return data.user;
}

async function ensureDemoProfile(
  client: SupabaseClient,
  identity: DemoIdentity,
  user: User,
): Promise<string> {
  const existingProfile = await maybeSingle<Record<string, unknown>>(
    client
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle(),
  );

  if (existingProfile?.role && existingProfile.role !== identity.role) {
    throw new Error(
      `Demo user ${identity.email} already has a ${String(
        existingProfile.role,
      )} profile`,
    );
  }

  const profilePayload = {
    approval_status: "approved",
    contact_visibility: {
      email: false,
      phone: false,
      website: true,
    },
    display_name: identity.displayName,
    eligibility_status: "eligible",
    eligibility_updated_at: new Date().toISOString(),
    locale: identity.index % 5 === 0 ? "en" : "tr",
    profile_photo_url: null,
    public_contact_email: null,
    public_phone: null,
    review_outcome: "auto_approved",
    role: identity.role,
    signup_intent:
      identity.role === "author" ? "find_publisher" : "discover_manuscripts",
    social_links: [],
    user_id: user.id,
    website_url:
      identity.role === "publisher"
        ? `https://demo-publisher-${String(identity.index).padStart(
            3,
            "0",
          )}.example.test`
        : null,
  };

  if (existingProfile?.id) {
    const { data, error } = await client
      .from("profiles")
      .update(profilePayload)
      .eq("id", existingProfile.id)
      .select("id")
      .single();
    if (error) throw error;
    return String(data.id);
  }

  const { data, error } = await client
    .from("profiles")
    .insert(profilePayload)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

async function ensureDemoAuthorDetails(
  client: SupabaseClient,
  identity: DemoIdentity,
  userId: string,
): Promise<void> {
  const genre = pick(GENRES, identity.index);
  const { error } = await client.rpc("complete_profile_onboarding_details", {
    p_accepts_unsolicited: null,
    p_accepted_audience_categories: null,
    p_accepted_manuscript_forms: null,
    p_accepted_primary_genres: null,
    p_actor_user_id: userId,
    p_best_selling_books: null,
    p_biography: `${identity.displayName} writes ${genre.toLocaleLowerCase(
      "tr",
    )} with a clear commercial hook and a polished submission package for demo matching.`,
    p_editor_wishlist: null,
    p_editorial_note: null,
    p_excluded_topics: null,
    p_focus_genres: null,
    p_imprint_tone: null,
    p_influences: [
      pick(THEMES, identity.index),
      pick(THEMES, identity.index + 3),
    ],
    p_logo_url: null,
    p_market_positioning: null,
    p_preferred_languages: null,
    p_primary_genre: genre,
    p_publisher_biography: null,
    p_publisher_name: null,
    p_recent_acquisitions: null,
    p_role: "author",
    p_style_statement: `Crisp scenes, emotionally direct stakes, and a steady ${pick(
      THEMES,
      identity.index + 1,
    )} thread.`,
    p_submission_guidelines: null,
    p_website_url: null,
    p_what_we_are_looking_for: null,
    p_writing_languages: identity.index % 4 === 0 ? ["tr", "en"] : ["tr"],
  });
  if (error) throw error;
}

async function ensureDemoPublisherDetails(
  client: SupabaseClient,
  identity: DemoIdentity,
  profileId: string,
): Promise<void> {
  const primaryGenre = pick(GENRES, identity.index);
  const secondaryGenre = pick(GENRES, identity.index + 2);
  const audience = pick(AUDIENCES, identity.index);
  const form = pick(FORMS, identity.index);
  const websiteUrl = `https://demo-publisher-${String(identity.index).padStart(
    3,
    "0",
  )}.example.test`;

  const { error: rpcError } = await client.rpc(
    "complete_profile_onboarding_details",
    {
      p_accepts_unsolicited: true,
      p_accepted_audience_categories: [audience],
      p_accepted_manuscript_forms: [form, "novel"],
      p_accepted_primary_genres: [primaryGenre, secondaryGenre],
      p_actor_user_id: await getUserIdForProfile(client, profileId),
      p_best_selling_books: [
        `${primaryGenre} Demo Bestseller`,
        `${secondaryGenre} Breakout List`,
      ],
      p_biography: null,
      p_editor_wishlist: `Looking for ${primaryGenre.toLocaleLowerCase(
        "tr",
      )} submissions with high-concept hooks, clean pacing, and a strong ${pick(
        THEMES,
        identity.index,
      )} engine.`,
      p_editorial_note: `Focused on readable, submission-ready ${primaryGenre.toLocaleLowerCase(
        "tr",
      )} and ${secondaryGenre.toLocaleLowerCase("tr")} projects.`,
      p_excluded_topics:
        identity.index % 3 === 0 ? ["graphic violence"] : ["hate speech"],
      p_focus_genres: [primaryGenre, secondaryGenre],
      p_imprint_tone: `Accessible, emotionally precise, and commercially aware.`,
      p_influences: null,
      p_logo_url: null,
      p_market_positioning: `Independent Turkish list with selective English-language crossover opportunities.`,
      p_preferred_languages: identity.index % 4 === 0 ? ["tr", "en"] : ["tr"],
      p_primary_genre: null,
      p_publisher_biography: `${identity.displayName} is a seeded demo publisher profile for matching and intro-request smoke tests.`,
      p_publisher_name: identity.displayName,
      p_recent_acquisitions: [
        `${primaryGenre} Spring List`,
        `${secondaryGenre} Autumn Lead`,
      ],
      p_role: "publisher",
      p_style_statement: null,
      p_submission_guidelines: `Send a concise pitch, metadata, and a processed sample. We prioritize ${primaryGenre.toLocaleLowerCase(
        "tr",
      )} projects for the current demo season.`,
      p_website_url: websiteUrl,
      p_what_we_are_looking_for: `Manuscripts with a confident premise, clear audience, and practical editorial fit.`,
      p_writing_languages: null,
    },
  );
  if (rpcError) throw rpcError;

  const { error: updateError } = await client
    .from("publisher_profiles")
    .update({
      logo_url: null,
      public_directory_status: "approved",
      website_url: websiteUrl,
    })
    .eq("profile_id", profileId);
  if (updateError) throw updateError;
}

async function ensureDemoManuscript(
  client: SupabaseClient,
  identity: DemoIdentity,
  authorId: string,
): Promise<void> {
  const genre = pick(GENRES, identity.index);
  const title = `Demo Manuscript ${String(identity.index).padStart(3, "0")}`;
  const sampleText = buildSampleText(identity, genre);
  const manuscriptPayload = {
    admin_review_status: "approved",
    arc_summary: `The protagonist leaves a familiar world, faces a costly midpoint reversal, and chooses a more honest public identity by the end.`,
    audience_categories: [pick(AUDIENCES, identity.index)],
    author_id: authorId,
    author_profile_visibility: "requestable_from_author_profile",
    chapter_summaries: [
      {
        chapter: 1,
        summary:
          "Opening pressure introduces the central promise and the first irreversible choice.",
      },
      {
        chapter: 2,
        summary:
          "A public setback reframes the goal and clarifies the emotional stakes.",
      },
    ],
    comp_titles: [`${genre} Comparable A`, `${genre} Comparable B`],
    declared_content_warnings:
      identity.index % 6 === 0 ? ["grief"] : ["none declared"],
    declared_themes: [
      pick(THEMES, identity.index),
      pick(THEMES, identity.index + 2),
    ],
    eligibility_status: "eligible",
    genre,
    language: identity.index % 4 === 0 ? "en" : "tr",
    logline: `A ${genre.toLocaleLowerCase(
      "tr",
    )} manuscript about ${pick(THEMES, identity.index)} colliding with ${pick(
      THEMES,
      identity.index + 1,
    )} during one decisive season.`,
    manuscript_form: pick(FORMS, identity.index),
    profile_teaser: `A polished demo ${genre.toLocaleLowerCase(
      "tr",
    )} submission with clear stakes and match-safe metadata.`,
    review_outcome: "auto_approved",
    status: "approved",
    subgenres: [genre, pick(GENRES, identity.index + 1)],
    synopsis: `This seeded manuscript is intentionally short and safe. It gives the matching worker enough metadata to test premise, voice, arc, audience, and publisher-fit behavior without storing a real private manuscript.`,
    target_age_max:
      pick(AUDIENCES, identity.index) === "middle_grade" ? 14 : null,
    target_age_min: pick(AUDIENCES, identity.index) === "middle_grade" ? 9 : 16,
    title,
    word_count: 42000 + identity.index * 750,
  };

  const existing = await maybeSingle<Record<string, unknown>>(
    client
      .from("manuscripts")
      .select("id, sample_document_id")
      .eq("author_id", authorId)
      .eq("title", title)
      .maybeSingle(),
  );

  const manuscriptId = existing?.id
    ? await updateRow(
        client,
        "manuscripts",
        String(existing.id),
        manuscriptPayload,
      )
    : await insertRow(client, "manuscripts", manuscriptPayload);

  const documentId = await ensureDemoDocument(
    client,
    {
      authorId,
      manuscriptId,
      sampleText,
      title,
    },
    typeof existing?.sample_document_id === "string"
      ? existing.sample_document_id
      : null,
  );

  const { error: sampleError } = await client
    .from("manuscripts")
    .update({ sample_document_id: documentId })
    .eq("id", manuscriptId);
  if (sampleError) throw sampleError;

  await ensureDemoDocumentChunk(client, documentId, sampleText);
  await ensureDemoProcessingJob(client, documentId);
}

async function ensureDemoDocument(
  client: SupabaseClient,
  input: {
    authorId: string;
    manuscriptId: string;
    sampleText: string;
    title: string;
  },
  currentDocumentId: string | null,
): Promise<string> {
  const fileName = `${slugify(input.title)}-sample.txt`;
  const documentPayload = {
    admin_review_status: "approved",
    author_id: input.authorId,
    eligibility_status: "eligible",
    file_size_bytes: Buffer.byteLength(input.sampleText, "utf8"),
    manuscript_id: input.manuscriptId,
    mime_type: "text/plain",
    original_file_name: fileName,
    processing_failure_code: null,
    processing_status: "succeeded",
    retention_expires_at: null,
    review_outcome: "auto_approved",
    storage_status: "uploaded",
    upload_id: `demo-seed-${input.manuscriptId.slice(0, 8)}`,
  };

  if (currentDocumentId) {
    return updateRow(client, "documents", currentDocumentId, documentPayload);
  }

  const existingUploaded = await maybeSingle<Record<string, unknown>>(
    client
      .from("documents")
      .select("id")
      .eq("manuscript_id", input.manuscriptId)
      .eq("storage_status", "uploaded")
      .limit(1)
      .maybeSingle(),
  );
  if (existingUploaded?.id) {
    return updateRow(
      client,
      "documents",
      String(existingUploaded.id),
      documentPayload,
    );
  }

  return insertRow(client, "documents", documentPayload);
}

async function ensureDemoDocumentChunk(
  client: SupabaseClient,
  documentId: string,
  sampleText: string,
): Promise<void> {
  const rows = [
    {
      chunk_index: 0,
      content: sampleText,
      document_id: documentId,
      metadata: { demoSeed: "marketplace_demo", section: "opening" },
      summary: "Safe demo opening sample for local matching smoke tests.",
    },
    {
      chunk_index: 1,
      content:
        "The closing movement resolves the public stakes while leaving a clear editorial promise for the publisher.",
      document_id: documentId,
      metadata: { demoSeed: "marketplace_demo", section: "arc" },
      summary: "Safe demo arc sample for local matching smoke tests.",
    },
  ];
  const { error } = await client
    .from("document_chunks")
    .upsert(rows, { onConflict: "document_id,chunk_index" });
  if (error) throw error;
}

async function ensureDemoProcessingJob(
  client: SupabaseClient,
  documentId: string,
): Promise<void> {
  const { error } = await client.from("document_processing_jobs").upsert(
    {
      attempt_count: 1,
      completed_at: new Date().toISOString(),
      document_id: documentId,
      error_message: null,
      idempotency_key: "demo-seed-processed-sample",
      max_attempts: 3,
      metadata: { demoSeed: "marketplace_demo" },
      started_at: new Date().toISOString(),
      status: "succeeded",
    },
    { onConflict: "document_id,idempotency_key" },
  );
  if (error) throw error;
}

async function getUserIdForProfile(
  client: SupabaseClient,
  profileId: string,
): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  if (error) throw error;
  return String(data.user_id);
}

async function insertRow(
  client: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

async function updateRow(
  client: SupabaseClient,
  table: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await client
    .from(table)
    .update(payload)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

async function maybeSingle<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function pick<T>(values: readonly T[], index: number): T {
  return values[(index - 1) % values.length]!;
}

function buildSampleText(identity: DemoIdentity, genre: string): string {
  return `${identity.displayName}'s ${genre} sample opens with a controlled scene, a visible desire, and a complication that points toward ${pick(
    THEMES,
    identity.index,
  )}. The voice is polished, concise, and suitable for deterministic demo matching.`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
