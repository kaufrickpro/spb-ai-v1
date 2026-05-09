import type {
  IntroState,
  MatchCandidate,
  MatchRunRequest,
} from "@marketplace/contracts";
import {
  IntroStateSchema,
  MatchCandidateSchema,
  MatchRunResponseSchema,
} from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { runAiMatching } from "./aiClient.js";
import { mapDbCandidate, mapDbCandidateDetail, mapDbRun } from "./dbMappers.js";
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
    const candidateCount = await countPersistedCandidates(db, runRow.id);
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

  const mappedRun = mapDbRun(run);
  const mappedCandidates = [];
  for (const candidate of candidates ?? []) {
    mappedCandidates.push(
      await decorateDbCandidate(
        db,
        viewer.id,
        mappedRun,
        mapDbCandidate(candidate),
      ),
    );
  }

  return MatchRunResponseSchema.parse({
    run: mappedRun,
    candidates: mappedCandidates,
  });
}

export async function getSupabaseMatchCandidate(input: {
  config: ApiConfig;
  candidateId: string;
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

  const { data: candidate, error: candidateError } = await db
    .from("match_candidates")
    .select()
    .eq("id", input.candidateId)
    .eq("match_run_id", run.id)
    .maybeSingle();
  if (candidateError) {
    throw new MatchingServiceError(
      "storage",
      "Failed to fetch match candidate",
      candidateError,
    );
  }
  if (!candidate) {
    throw new MatchingServiceError("not_found", "Match candidate not found");
  }

  const mappedRun = mapDbRun(run);
  const mappedCandidate = await decorateDbCandidate(
    db,
    viewer.id,
    mappedRun,
    mapDbCandidateDetail(candidate, mappedRun),
  );

  return { run: mappedRun, candidate: mappedCandidate };
}

async function decorateDbCandidate<TCandidate extends MatchCandidate>(
  db: ServiceRoleDb,
  viewerProfileId: unknown,
  run: ReturnType<typeof mapDbRun>,
  candidate: TCandidate,
): Promise<TCandidate> {
  const introTarget = getIntroTarget(run, candidate);
  if (!introTarget || typeof viewerProfileId !== "string") {
    MatchCandidateSchema.parse(candidate);
    return candidate;
  }
  const decorated = {
    ...candidate,
    introTarget,
    introState: await getDbIntroState(db, {
      ...introTarget,
      viewerProfileId,
    }),
  };
  MatchCandidateSchema.parse(decorated);
  return decorated;
}

function getIntroTarget(
  run: ReturnType<typeof mapDbRun>,
  candidate: MatchCandidate,
) {
  if (
    run.direction === "author_to_publisher" &&
    run.sourceManuscriptId &&
    candidate.candidateType === "publisher"
  ) {
    return {
      manuscriptId: run.sourceManuscriptId,
      publisherProfileId: candidate.candidateProfileId,
    };
  }
  if (
    run.direction === "publisher_to_manuscript" &&
    run.sourcePublisherProfileId &&
    candidate.candidateManuscriptId
  ) {
    return {
      manuscriptId: candidate.candidateManuscriptId,
      publisherProfileId: run.sourcePublisherProfileId,
    };
  }
  return null;
}

async function getDbIntroState(
  db: ServiceRoleDb,
  pair: {
    manuscriptId: string;
    publisherProfileId: string;
    viewerProfileId: string;
  },
): Promise<IntroState> {
  const { data } = await db
    .from("intro_requests")
    .select()
    .eq("manuscript_id", pair.manuscriptId)
    .eq("publisher_profile_id", pair.publisherProfileId)
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const accepted = rows.find((row) => row.status === "accepted");
  if (accepted) {
    return IntroStateSchema.parse({
      status: "accepted",
      requestId: accepted.id,
    });
  }
  const pending = rows.find((row) => row.status === "pending");
  if (pending) {
    const sent = pending.requester_profile_id === pair.viewerProfileId;
    return IntroStateSchema.parse({
      status: sent ? "pending_sent" : "pending_received",
      requestId: pending.id,
      viewerCanAccept: !sent,
      viewerCanReject: !sent,
      viewerCanCancel: sent,
    });
  }
  const cooldown = rows.find(
    (row) => row.status === "rejected" || row.status === "cancelled",
  );
  if (cooldown) {
    const until = new Date(
      String(cooldown.responded_at ?? cooldown.updated_at),
    );
    until.setUTCDate(until.getUTCDate() + 14);
    if (until.getTime() > Date.now()) {
      return IntroStateSchema.parse({
        status:
          cooldown.status === "rejected"
            ? "rejected_cooldown"
            : "cancelled_cooldown",
        requestId: cooldown.id,
        cooldownUntil: until.toISOString(),
      });
    }
  }
  const { count } = await db
    .from("intro_request_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", pair.viewerProfileId)
    .eq("usage_date", new Date().toISOString().slice(0, 10));
  const remaining = Math.max(0, 10 - (count ?? 0));
  return IntroStateSchema.parse({
    status: remaining === 0 ? "quota_exhausted" : "can_request",
    requestId: null,
    quotaRemaining: remaining,
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

async function countPersistedCandidates(db: ServiceRoleDb, runId: unknown) {
  const { count, error } = await db
    .from("match_candidates")
    .select("id", { count: "exact", head: true })
    .eq("match_run_id", runId);
  if (error) {
    throw new MatchingServiceError(
      "storage",
      "Failed to count persisted match candidates",
      error,
    );
  }
  return count ?? 0;
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
