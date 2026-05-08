import { createHash } from "node:crypto";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { EMBEDDING_MODEL } from "./snapshots.js";
import { MatchingServiceError } from "./errors.js";

type ServiceRoleDb = ReturnType<typeof createServiceRoleSupabaseClient>;
type SignalType =
  | "premise"
  | "voice"
  | "arc"
  | "guidelines"
  | "wishlist"
  | "catalog";

export async function upsertManuscriptSignals(
  db: ServiceRoleDb,
  input: {
    manuscript: Record<string, unknown>;
    manuscriptId: unknown;
    ownerProfileId: unknown;
  },
) {
  const signals = [
    buildSignal("premise", input.manuscript, [
      "title",
      "genre",
      "subgenres",
      "audienceCategories",
      "manuscriptForm",
      "logline",
      "synopsis",
    ]),
    buildSignal("voice", input.manuscript, [
      "styleStatement",
      "influences",
      "declaredThemes",
      "shortTeaser",
      "profileTeaser",
    ]),
    buildSignal("arc", input.manuscript, [
      "arcSummary",
      "chapterSummaries",
      "declaredContentWarnings",
    ]),
  ];

  for (const signal of signals) {
    await upsertSignal(db, {
      ...signal,
      manuscriptId: input.manuscriptId,
      ownerProfileId: input.ownerProfileId,
      publisherProfileId: null,
      sourceType: "manuscript",
      sourceId: input.manuscriptId,
    });
  }
}

export async function upsertPublisherSignals(
  db: ServiceRoleDb,
  input: {
    ownerProfileId: unknown;
    publisher: Record<string, unknown>;
    publisherProfileId: unknown;
  },
) {
  const signals = [
    buildSignal("guidelines", input.publisher, [
      "publisherName",
      "displayName",
      "focusGenres",
      "acceptedPrimaryGenres",
      "acceptedAudienceCategories",
      "acceptedManuscriptForms",
      "submissionGuidelines",
      "whatWeAreLookingFor",
      "excludedTopics",
    ]),
    buildSignal("wishlist", input.publisher, [
      "editorWishlist",
      "imprintTone",
      "marketPositioning",
    ]),
    buildSignal("catalog", input.publisher, [
      "recentAcquisitions",
      "bestSellingBooks",
    ]),
  ].filter((signal) => signal.summary !== null);

  for (const signal of signals) {
    await upsertSignal(db, {
      ...signal,
      manuscriptId: null,
      ownerProfileId: input.ownerProfileId,
      publisherProfileId: input.publisherProfileId,
      sourceType: "publisher_profile",
      sourceId: input.publisherProfileId,
    });
  }
}

function buildSignal(
  signalType: SignalType,
  source: Record<string, unknown>,
  keys: string[],
) {
  const summary = keys.flatMap((key) => normalizeValues(source[key])).join(" ");
  if (!summary.trim() && signalType !== "guidelines") {
    return {
      fingerprint: fingerprint({ signalType, summary }),
      signalType,
      summary: null,
    };
  }
  const boundedSummary = summary.replace(/\s+/g, " ").trim().slice(0, 900);
  return {
    fingerprint: fingerprint({ signalType, summary: boundedSummary }),
    signalType,
    summary: boundedSummary || "No declared signal text yet.",
  };
}

async function upsertSignal(
  db: ServiceRoleDb,
  input: {
    fingerprint: string;
    manuscriptId: unknown;
    ownerProfileId: unknown;
    publisherProfileId: unknown;
    signalType: SignalType;
    sourceId: unknown;
    sourceType: "manuscript" | "publisher_profile";
    summary: string | null;
  },
) {
  if (!input.summary) return;
  const embeddingRecordId = await upsertEmbeddingReference(db, input);
  const row = {
    owner_profile_id: input.ownerProfileId,
    manuscript_id: input.manuscriptId,
    publisher_profile_id: input.publisherProfileId,
    signal_type: input.signalType,
    fingerprint: input.fingerprint,
    source_fingerprint: input.fingerprint,
    status: "current",
    summary: input.summary,
    embedding_record_id: embeddingRecordId,
    metadata: {
      provider: "api-reference",
      source_type: input.sourceType,
      vector_storage: "external_reference_only",
      has_vector_array: false,
    },
  };
  let query = db
    .from("match_signal_sources")
    .select("id")
    .eq("owner_profile_id", input.ownerProfileId)
    .eq("signal_type", input.signalType)
    .limit(1);
  query =
    input.manuscriptId == null
      ? query.is("manuscript_id", null)
      : query.eq("manuscript_id", input.manuscriptId);
  query =
    input.publisherProfileId == null
      ? query.is("publisher_profile_id", null)
      : query.eq("publisher_profile_id", input.publisherProfileId);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to inspect match signal source",
      existingError,
    );
  }
  const write =
    existing == null
      ? db.from("match_signal_sources").insert(row)
      : db.from("match_signal_sources").update(row).eq("id", existing.id);
  const { error } = await write;
  if (!error) return;
  throw new MatchingServiceError(
    "storage",
    "Failed to upsert match signal source",
    error,
  );
}

async function upsertEmbeddingReference(
  db: ServiceRoleDb,
  input: {
    fingerprint: string;
    signalType: SignalType;
    sourceId: unknown;
    sourceType: "manuscript" | "publisher_profile";
  },
) {
  const vectorDatapointId =
    `match-signal-${input.signalType}-${String(input.sourceId)}-${input.fingerprint}`.slice(
      0,
      200,
    );
  const row = {
    source_type: input.sourceType,
    source_id: input.sourceId,
    vector_index_name: "match-signal-reference-index",
    vector_datapoint_id: vectorDatapointId,
    embedding_model: EMBEDDING_MODEL,
    metadata: {
      provider: "api-reference",
      signal_type: input.signalType,
      has_vector_array: false,
    },
  };
  const { data, error } = await db
    .from("embedding_records")
    .upsert(row, { onConflict: "vector_index_name,vector_datapoint_id" })
    .select("id")
    .single();
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to upsert match embedding reference",
      error,
    );
  }
  return data.id;
}

function normalizeValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeValues(item));
  }
  if (typeof value === "number") {
    return [String(value)];
  }
  if (typeof value !== "string") {
    return [];
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? [trimmed] : [];
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 32);
}
