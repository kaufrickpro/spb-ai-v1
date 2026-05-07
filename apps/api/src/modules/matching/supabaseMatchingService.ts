import type { MatchRunRequest } from "@marketplace/contracts";
import { MatchRunResponseSchema } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { runAiMatching } from "./aiClient.js";
import { mapDbCandidate, mapDbRun } from "./dbMappers.js";
import { MatchingServiceError } from "./errors.js";
import {
  ALGORITHM_VERSION,
  CONSTRAINT_POLICY_VERSION,
  EMBEDDING_MODEL,
  EXPLANATION_VERSION,
  safeManuscriptSnapshot,
  safePublisherSnapshot,
  WEIGHT_PROFILE,
} from "./snapshots.js";
import { fingerprint } from "./testState.js";
import { createDbTracerCandidates } from "./tracerCandidates.js";

type ServiceRoleDb = ReturnType<typeof createServiceRoleSupabaseClient>;

export async function runSupabaseMatch(input: {
  config: ApiConfig;
  request: MatchRunRequest;
  user: AuthenticatedUser;
}) {
  const db = createDb(input.config);
  const requester = await getDbProfileForUser(db, input.user.userId);
  if (!requester) {
    throw new MatchingServiceError("forbidden", "Marketplace profile required");
  }
  await enforceDbRateLimit(db, requester.id);

  const runInput = await buildDbRunInput(db, input.request, requester);
  const { data: runRow, error: runError } = await db
    .from("match_runs")
    .insert(runInput)
    .select()
    .single();
  if (runError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to create match run",
      runError,
    );
  }

  const aiResult = await runAiMatching({
    config: input.config,
    matchRunId: runRow.id,
  });
  if (aiResult.status === "failed") {
    await markRunFailed(db, runRow.id, aiResult.failure_code);
  } else {
    const candidateCount = await createDbTracerCandidates(db, runRow);
    await markRunSucceeded(db, runRow.id, candidateCount);
  }

  return getSupabaseMatchRun({
    config: input.config,
    matchRunId: runRow.id,
    user: input.user,
  });
}

export async function listSupabaseMatchRuns(input: {
  config: ApiConfig;
  user: AuthenticatedUser;
}) {
  const db = createDb(input.config);
  const viewer = await getDbProfileForUser(db, input.user.userId);
  if (!viewer) {
    throw new MatchingServiceError("forbidden", "Marketplace profile required");
  }

  const { data, error } = await db
    .from("match_runs")
    .select()
    .eq("requester_profile_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to list match runs",
      error,
    );
  }

  return { runs: (data ?? []).map(mapDbRun) };
}

export async function getSupabaseMatchRun(input: {
  config: ApiConfig;
  matchRunId: string;
  user: AuthenticatedUser;
}) {
  const db = createDb(input.config);
  const viewer = await getDbProfileForUser(db, input.user.userId);
  if (!viewer) {
    throw new MatchingServiceError("forbidden", "Marketplace profile required");
  }

  const { data: run, error: runError } = await db
    .from("match_runs")
    .select()
    .eq("id", input.matchRunId)
    .eq("requester_profile_id", viewer.id)
    .maybeSingle();
  if (runError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to fetch match run",
      runError,
    );
  }
  if (!run) {
    throw new MatchingServiceError("not_found", "Match run not found");
  }

  const { data: candidates, error: candidatesError } = await db
    .from("match_candidates")
    .select()
    .eq("match_run_id", run.id)
    .order("rank", { ascending: true });
  if (candidatesError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to fetch match candidates",
      candidatesError,
    );
  }

  return MatchRunResponseSchema.parse({
    run: mapDbRun(run),
    candidates: (candidates ?? []).map(mapDbCandidate),
  });
}

async function buildDbRunInput(
  db: ServiceRoleDb,
  request: MatchRunRequest,
  requester: Record<string, unknown>,
) {
  if (request.direction === "author_to_publisher") {
    return buildAuthorRunInput(db, request, requester);
  }
  return buildPublisherRunInput(db, request, requester);
}

async function buildAuthorRunInput(
  db: ServiceRoleDb,
  request: Extract<MatchRunRequest, { direction: "author_to_publisher" }>,
  requester: Record<string, unknown>,
) {
  if (
    requester.role !== "author" ||
    requester.eligibility_status !== "eligible"
  ) {
    throw new MatchingServiceError(
      "forbidden",
      "Only eligible authors can run this match",
    );
  }

  const { data: manuscript, error } = await db
    .from("manuscripts")
    .select()
    .eq("id", request.manuscriptId)
    .eq("author_id", requester.user_id)
    .maybeSingle();
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to fetch manuscript",
      error,
    );
  }
  if (!manuscript) {
    throw new MatchingServiceError("not_found", "Manuscript not found");
  }

  await assertDbManuscriptReady(db, manuscript);
  const snapshot = safeManuscriptSnapshot(manuscript);
  return buildRunInsert({
    direction: request.direction,
    requesterProfileId: requester.id,
    snapshot,
    sourceManuscriptId: manuscript.id,
    sourcePublisherProfileId: null,
  });
}

async function buildPublisherRunInput(
  db: ServiceRoleDb,
  request: Extract<MatchRunRequest, { direction: "publisher_to_manuscript" }>,
  requester: Record<string, unknown>,
) {
  if (
    requester.role !== "publisher" ||
    requester.eligibility_status !== "eligible"
  ) {
    throw new MatchingServiceError(
      "forbidden",
      "Only eligible publishers can run this match",
    );
  }

  const { data: details, error } = await db
    .from("publisher_profiles")
    .select()
    .eq("profile_id", requester.id)
    .maybeSingle();
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to fetch publisher profile",
      error,
    );
  }
  if (!details) {
    throw new MatchingServiceError(
      "not_ready",
      "Publisher profile is incomplete",
    );
  }

  const snapshot = safePublisherSnapshot(requester, details);
  return buildRunInsert({
    direction: request.direction,
    requesterProfileId: requester.id,
    snapshot,
    sourceManuscriptId: null,
    sourcePublisherProfileId: requester.id,
  });
}

function buildRunInsert(input: {
  direction: MatchRunRequest["direction"];
  requesterProfileId: unknown;
  snapshot: Record<string, unknown>;
  sourceManuscriptId: unknown;
  sourcePublisherProfileId: unknown;
}) {
  return {
    direction: input.direction,
    requester_profile_id: input.requesterProfileId,
    source_manuscript_id: input.sourceManuscriptId,
    source_publisher_profile_id: input.sourcePublisherProfileId,
    status: "running",
    input_fingerprint: fingerprint(input.snapshot),
    input_snapshot: input.snapshot,
    matching_algorithm_version: ALGORITHM_VERSION,
    constraint_policy_version: CONSTRAINT_POLICY_VERSION,
    embedding_model: EMBEDDING_MODEL,
    explanation_version: EXPLANATION_VERSION,
    explanation_model: null,
    weight_profile: WEIGHT_PROFILE,
  };
}

async function enforceDbRateLimit(
  db: ServiceRoleDb,
  requesterProfileId: unknown,
) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("match_runs")
    .select("id", { count: "exact", head: true })
    .eq("requester_profile_id", requesterProfileId)
    .gte("created_at", since);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to check match rate limit",
      error,
    );
  }
  if ((count ?? 0) >= 10) {
    throw new MatchingServiceError("rate_limited", "Too many match runs");
  }
}

async function assertDbManuscriptReady(
  db: ServiceRoleDb,
  manuscript: Record<string, unknown>,
) {
  if (manuscript.eligibility_status !== "eligible") {
    throw new MatchingServiceError("not_ready", "Manuscript is not eligible");
  }
  if (!manuscript.sample_document_id) {
    throw new MatchingServiceError(
      "not_ready",
      "A processed sample is required",
    );
  }

  const { data: document, error } = await db
    .from("documents")
    .select("processing_status,eligibility_status")
    .eq("id", manuscript.sample_document_id)
    .maybeSingle();
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to fetch sample document",
      error,
    );
  }
  if (
    document?.processing_status !== "succeeded" ||
    document.eligibility_status !== "eligible"
  ) {
    throw new MatchingServiceError(
      "not_ready",
      "A processed sample is required",
    );
  }
}

async function getDbProfileForUser(db: ServiceRoleDb, userId: string) {
  const { data, error } = await db
    .from("profiles")
    .select()
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new MatchingServiceError("storage", "Failed to fetch profile", error);
  }
  return data;
}

async function markRunFailed(
  db: ServiceRoleDb,
  runId: unknown,
  failureCode: string | null | undefined,
) {
  const { error } = await db
    .from("match_runs")
    .update({
      status: "failed",
      failure_code: failureCode ?? "ai_service_failed",
      candidate_count: 0,
    })
    .eq("id", runId);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to mark match run failed",
      error,
    );
  }
}

async function markRunSucceeded(
  db: ServiceRoleDb,
  runId: unknown,
  candidateCount: number,
) {
  const { error } = await db
    .from("match_runs")
    .update({
      status: "succeeded",
      candidate_count: candidateCount,
      failure_code: null,
    })
    .eq("id", runId);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to mark match run succeeded",
      error,
    );
  }
}

function createDb(config: ApiConfig): ServiceRoleDb {
  return createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
}
