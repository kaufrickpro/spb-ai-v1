import type { MatchRunRequest } from "@marketplace/contracts";

import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import type { ApiConfig } from "../config/config.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import { MatchingServiceError } from "./errors.js";
import {
  getSupabaseMatchRun,
  listSupabaseMatchRuns,
  runSupabaseMatch,
} from "./supabaseMatchingService.js";
import {
  getTestMatchRun,
  listTestMatchRuns,
  runTestMatch,
} from "./testMatchingService.js";
import type { MatchingTestState } from "./testState.js";

type MatchingContext = {
  config: ApiConfig;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  testState: MatchingTestState;
  user: AuthenticatedUser;
};

export async function runMatch(
  input: MatchingContext & { request: MatchRunRequest },
) {
  if (input.config.authMode === "test") {
    return runTestMatch(input);
  }

  return runSupabaseMatch({
    config: input.config,
    request: input.request,
    user: input.user,
  });
}

export async function listMatchRuns(input: MatchingContext) {
  if (input.config.authMode === "test") {
    return listTestMatchRuns(input);
  }

  return listSupabaseMatchRuns({
    config: input.config,
    user: input.user,
  });
}

export async function getMatchRun(
  input: MatchingContext & { matchRunId: string },
) {
  if (input.config.authMode === "test") {
    return getTestMatchRun(input);
  }

  return getSupabaseMatchRun({
    config: input.config,
    matchRunId: input.matchRunId,
    user: input.user,
  });
}

export async function getMatchCandidate(
  input: MatchingContext & { candidateId: string; matchRunId: string },
) {
  const response = await getMatchRun(input);
  const candidate = response.candidates.find(
    (item) => item.id === input.candidateId,
  );

  if (!candidate) {
    throw new MatchingServiceError("not_found", "Match candidate not found");
  }

  return { candidate, run: response.run };
}
