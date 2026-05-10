import type { FastifyInstance, FastifyReply } from "fastify";
import {
  MatchCandidateResponseSchema,
  MatchRunListResponseSchema,
  MatchRunRequestSchema,
  MatchRunResponseSchema,
} from "@marketplace/contracts";
import {
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendForbidden,
  sendInternalServerError,
  sendNotFound,
  sendTooManyRequests,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import { assertEntitlementForAction } from "../billing/service.js";
import { BillingServiceError } from "../billing/errors.js";
import { sendBillingError } from "../billing/registerBillingRoutes.js";
import type { BillingTestState } from "../billing/testState.js";
import { MatchingServiceError } from "./errors.js";
import {
  getMatchCandidate,
  getMatchRun,
  listMatchRuns,
  runMatch,
} from "./service.js";
import type { MatchingTestState } from "./testState.js";

type RegisterMatchingRoutesOptions = {
  auth: AuthDependencies;
  billingTestState: BillingTestState;
  introTestState: IntroRequestTestState;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  testState: MatchingTestState;
};

export function registerMatchingRoutes(
  app: FastifyInstance,
  {
    auth,
    billingTestState,
    introTestState,
    manuscriptTestState,
    profileTestState,
    testState,
  }: RegisterMatchingRoutesOptions,
) {
  app.post("/api/v1/matches/run", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const parsed = MatchRunRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(
        reply,
        "Invalid match run request",
        parsed.error.issues,
      );
    }

    try {
      await assertEntitlementForAction({
        action: "run_match",
        billingTestState,
        config: auth.config,
        manuscriptTestState,
        profileTestState,
        user,
      });
      const response = await runMatch({
        config: auth.config,
        introTestState,
        manuscriptTestState,
        profileTestState,
        request: parsed.data,
        testState,
        user,
      });
      return reply.send(MatchRunResponseSchema.parse(response));
    } catch (error) {
      return sendMatchingError(app, reply, error);
    }
  });

  app.get("/api/v1/matches", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    try {
      const response = await listMatchRuns({
        config: auth.config,
        introTestState,
        manuscriptTestState,
        profileTestState,
        testState,
        user,
      });
      return reply.send(MatchRunListResponseSchema.parse(response));
    } catch (error) {
      return sendMatchingError(app, reply, error);
    }
  });

  app.get("/api/v1/profile/history", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    try {
      const response = await listMatchRuns({
        config: auth.config,
        introTestState,
        manuscriptTestState,
        profileTestState,
        testState,
        user,
      });
      return reply.send(MatchRunListResponseSchema.parse(response));
    } catch (error) {
      return sendMatchingError(app, reply, error);
    }
  });

  app.get("/api/v1/matches/:matchRunId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const matchRunId = parseUuidParam(request.params, "matchRunId");
    if (!matchRunId) return sendNotFound(reply, "Match run not found");

    try {
      const response = await getMatchRun({
        config: auth.config,
        introTestState,
        matchRunId,
        manuscriptTestState,
        profileTestState,
        testState,
        user,
      });
      return reply.send(MatchRunResponseSchema.parse(response));
    } catch (error) {
      return sendMatchingError(app, reply, error);
    }
  });

  app.get(
    "/api/v1/matches/:matchRunId/candidates/:candidateId",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const matchRunId = parseUuidParam(request.params, "matchRunId");
      const candidateId = parseUuidParam(request.params, "candidateId");
      if (!matchRunId || !candidateId) {
        return sendNotFound(reply, "Match candidate not found");
      }

      try {
        const response = await getMatchCandidate({
          candidateId,
          config: auth.config,
          introTestState,
          matchRunId,
          manuscriptTestState,
          profileTestState,
          testState,
          user,
        });
        return reply.send(MatchCandidateResponseSchema.parse(response));
      } catch (error) {
        return sendMatchingError(app, reply, error);
      }
    },
  );
}

function sendMatchingError(
  app: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof MatchingServiceError) {
    if (error.kind === "forbidden") return sendForbidden(reply, error.message);
    if (error.kind === "not_found") return sendNotFound(reply, error.message);
    if (error.kind === "not_ready") {
      return sendValidationError(reply, error.message, [], "match_not_ready");
    }
    if (error.kind === "rate_limited") {
      return sendTooManyRequests(reply, "match_rate_limited", error.message);
    }
  }
  if (error instanceof BillingServiceError) {
    return sendBillingError(app, reply, error);
  }

  app.log.error(error, "Failed to handle match request");
  return sendInternalServerError(reply);
}

function parseUuidParam(params: unknown, key: string): string | null {
  const value = (params as Record<string, string | undefined>)[key];
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value;
}
