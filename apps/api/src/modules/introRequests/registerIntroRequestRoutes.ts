import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AdminIntroRequestDetailResponseSchema,
  AdminIntroRequestListQuerySchema,
  AdminIntroRequestListResponseSchema,
  CreateIntroRequestRequestSchema,
  IntroRequestListQuerySchema,
  IntroRequestListResponseSchema,
  IntroRequestResponseSchema,
  RejectIntroRequestRequestSchema,
} from "@marketplace/contracts";
import {
  requireAdminUser,
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendConflict,
  sendForbidden,
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { MatchingTestState } from "../matching/testState.js";
import { assertEntitlementForAction } from "../billing/service.js";
import { BillingServiceError } from "../billing/errors.js";
import { sendBillingError } from "../billing/registerBillingRoutes.js";
import type { BillingTestState } from "../billing/testState.js";
import type { EmailTestState } from "../email/testState.js";
import { enqueueProductEmail } from "../email/outboxService.js";
import type { IntroRequestTestState } from "./testState.js";
import { IntroRequestServiceError } from "./errors.js";
import {
  createIntroRequest,
  getAdminIntroRequestDetail,
  listAdminIntroRequests,
  listIntroRequests,
  transitionIntroRequest,
} from "./service.js";

type RegisterIntroRequestRoutesOptions = {
  auth: AuthDependencies;
  billingTestState: BillingTestState;
  emailTestState: EmailTestState;
  introTestState: IntroRequestTestState;
  manuscriptTestState: ManuscriptTestState;
  matchingTestState: MatchingTestState;
  profileTestState: ProfileTestState;
};

export function registerIntroRequestRoutes(
  app: FastifyInstance,
  options: RegisterIntroRequestRoutesOptions,
) {
  app.post("/api/v1/intro-requests", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    const parsed = CreateIntroRequestRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendValidationError(
        reply,
        "Invalid intro request",
        parsed.error.issues,
      );
    }

    try {
      await assertEntitlementForAction({
        action: "send_intro_request",
        billingTestState: options.billingTestState,
        config: options.auth.config,
        manuscriptTestState: options.manuscriptTestState,
        profileTestState: options.profileTestState,
        user,
      });
      const response = await createIntroRequest({
        ...options,
        config: options.auth.config,
        body: parsed.data,
        user,
      });
      await enqueueIntroEmailSafely(app, options, response.request, "created");
      return reply.code(201).send(IntroRequestResponseSchema.parse(response));
    } catch (error) {
      return sendIntroError(app, reply, error);
    }
  });

  app.get("/api/v1/intro-requests", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;
    const query = IntroRequestListQuerySchema.parse(request.query ?? {});

    try {
      const response = await listIntroRequests({
        ...options,
        config: options.auth.config,
        query,
        user,
      });
      return reply.send(IntroRequestListResponseSchema.parse(response));
    } catch (error) {
      return sendIntroError(app, reply, error);
    }
  });

  app.post(
    "/api/v1/intro-requests/:requestId/accept",
    async (request, reply) => {
      return handleTransition(app, options, request, reply, "accept");
    },
  );

  app.post(
    "/api/v1/intro-requests/:requestId/reject",
    async (request, reply) => {
      return handleTransition(app, options, request, reply, "reject");
    },
  );

  app.post(
    "/api/v1/intro-requests/:requestId/cancel",
    async (request, reply) => {
      return handleTransition(app, options, request, reply, "cancel");
    },
  );

  app.get("/api/v1/admin/intro-requests", async (request, reply) => {
    const user = await requireAdminUser(request, reply, options.auth);
    if (!user) return;
    const query = AdminIntroRequestListQuerySchema.parse(request.query ?? {});

    try {
      const response = await listAdminIntroRequests({
        ...options,
        config: options.auth.config,
        query,
      });
      return reply.send(AdminIntroRequestListResponseSchema.parse(response));
    } catch (error) {
      return sendIntroError(app, reply, error);
    }
  });

  app.get("/api/v1/admin/intro-requests/:requestId", async (request, reply) => {
    const user = await requireAdminUser(request, reply, options.auth);
    if (!user) return;
    const requestId = parseUuidParam(request.params, "requestId", reply);
    if (!requestId) return;

    try {
      const response = await getAdminIntroRequestDetail({
        ...options,
        config: options.auth.config,
        requestId,
      });
      return reply.send(AdminIntroRequestDetailResponseSchema.parse(response));
    } catch (error) {
      return sendIntroError(app, reply, error);
    }
  });
}

async function handleTransition(
  app: FastifyInstance,
  options: RegisterIntroRequestRoutesOptions,
  request: FastifyRequest,
  reply: FastifyReply,
  action: "accept" | "reject" | "cancel",
) {
  const user = await requireAuthenticatedUser(request, reply, options.auth);
  if (!user) return;
  const requestId = parseUuidParam(request.params, "requestId", reply);
  if (!requestId) return;
  const body =
    action === "reject"
      ? RejectIntroRequestRequestSchema.parse(request.body ?? {})
      : undefined;

  try {
    const response = await transitionIntroRequest({
      ...options,
      config: options.auth.config,
      action,
      body,
      requestId,
      user,
    });
    await enqueueIntroEmailSafely(app, options, response.request, action);
    return reply.send(IntroRequestResponseSchema.parse(response));
  } catch (error) {
    return sendIntroError(app, reply, error);
  }
}

async function enqueueIntroEmailSafely(
  app: FastifyInstance,
  options: RegisterIntroRequestRoutesOptions,
  request: {
    id: string;
    manuscriptTitle: string;
    requesterProfileId: string;
    requesterName: string;
    recipientProfileId: string;
    recipientName: string;
  },
  action: "created" | "accept" | "reject" | "cancel",
) {
  if (options.auth.config.authMode !== "test") return;
  const targetProfileId =
    action === "accept" || action === "reject"
      ? request.requesterProfileId
      : request.recipientProfileId;
  const actorLabel =
    action === "accept" || action === "reject"
      ? request.recipientName
      : request.requesterName;
  const templateKey =
    action === "created"
      ? "intro_request_created"
      : action === "accept"
        ? "intro_request_accepted"
        : action === "reject"
          ? "intro_request_rejected"
          : "intro_request_cancelled";
  try {
    await enqueueProductEmail({
      config: options.auth.config,
      email: {
        actorLabel,
        ctaPath:
          action === "created"
            ? "/app/requests?box=received"
            : "/app/requests?box=all",
        idempotencyKey: `intro_request:${request.id}:${templateKey}:${targetProfileId}`,
        recipientProfileId: targetProfileId,
        targetLabel: request.manuscriptTitle,
        templateKey,
      },
      emailTestState: options.emailTestState,
    });
  } catch (error) {
    app.log.warn(error, "Failed to enqueue intro request product email");
  }
}

function sendIntroError(
  app: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof IntroRequestServiceError) {
    if (error.kind === "not_found") return sendNotFound(reply, error.message);
    if (error.kind === "forbidden") return sendForbidden(reply, error.message);
    if (error.kind === "conflict") {
      return sendConflict(reply, "intro_request_conflict", error.message);
    }
    if (error.kind === "quota") {
      return sendConflict(reply, "intro_quota_exhausted", error.message);
    }
    if (error.kind === "not_eligible") {
      return sendValidationError(reply, error.message, [], "not_eligible");
    }
  }
  if (error instanceof BillingServiceError) {
    return sendBillingError(app, reply, error);
  }
  app.log.error(error, "Failed to handle intro request");
  return sendInternalServerError(reply);
}

function parseUuidParam(
  params: unknown,
  key: string,
  reply: FastifyReply,
): string | null {
  const raw = (params as Record<string, unknown>)[key];
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) {
    sendValidationError(reply, `Invalid ${key}`, []);
    return null;
  }
  return raw;
}
