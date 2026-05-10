import type { FastifyInstance, FastifyReply } from "fastify";
import {
  BillingSubscriptionResponseSchema,
  BillingUsageResponseSchema,
  PaytrCheckoutRequestSchema,
  PaytrCheckoutResponseSchema,
  StartTrialResponseSchema,
} from "@marketplace/contracts";
import {
  hasAdminMembership,
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendForbidden,
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { EmailTestState } from "../email/testState.js";
import { BillingServiceError } from "./errors.js";
import type { BillingTestState } from "./testState.js";
import {
  denial,
  getBillingSubscription,
  getBillingUsage,
  startBillingTrial,
} from "./service.js";
import {
  createPaytrCheckoutToken,
  processPaytrWebhook,
} from "./paytrBillingService.js";

type RegisterBillingRoutesOptions = {
  auth: AuthDependencies;
  billingTestState: BillingTestState;
  emailTestState?: EmailTestState;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
};

export function registerBillingRoutes(
  app: FastifyInstance,
  options: RegisterBillingRoutesOptions,
) {
  app.get("/api/v1/billing/subscription", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    try {
      const response = await getBillingSubscription({
        billingTestState: options.billingTestState,
        config: options.auth.config,
        manuscriptTestState: options.manuscriptTestState,
        profileTestState: options.profileTestState,
        user,
      });
      return reply.send(BillingSubscriptionResponseSchema.parse(response));
    } catch (error) {
      return sendBillingError(app, reply, error);
    }
  });

  app.get("/api/v1/billing/usage", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    try {
      const response = await getBillingUsage({
        billingTestState: options.billingTestState,
        config: options.auth.config,
        manuscriptTestState: options.manuscriptTestState,
        profileTestState: options.profileTestState,
        user,
      });
      return reply.send(BillingUsageResponseSchema.parse(response));
    } catch (error) {
      return sendBillingError(app, reply, error);
    }
  });

  app.post("/api/v1/billing/trial/start", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    if (await hasAdminMembership(user, options.auth.config)) {
      return sendForbidden(
        reply,
        "Admin accounts cannot start marketplace trials",
        "admin_marketplace_billing_forbidden",
      );
    }

    try {
      const response = await startBillingTrial({
        billingTestState: options.billingTestState,
        config: options.auth.config,
        manuscriptTestState: options.manuscriptTestState,
        profileTestState: options.profileTestState,
        user,
      });
      return reply.send(StartTrialResponseSchema.parse(response));
    } catch (error) {
      return sendBillingError(app, reply, error);
    }
  });

  app.post("/api/v1/billing/paytr/checkout-token", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    if (await hasAdminMembership(user, options.auth.config)) {
      return sendForbidden(
        reply,
        "Admin accounts cannot use marketplace checkout",
        "admin_marketplace_billing_forbidden",
      );
    }

    const input = PaytrCheckoutRequestSchema.parse(request.body);

    try {
      const response = await createPaytrCheckoutToken({
        billingTestState: options.billingTestState,
        config: options.auth.config,
        manuscriptTestState: options.manuscriptTestState,
        planSlug: input.planSlug,
        profileTestState: options.profileTestState,
        requestIp: request.ip,
        user,
      });
      return reply.send(PaytrCheckoutResponseSchema.parse(response));
    } catch (error) {
      return sendBillingError(app, reply, error);
    }
  });

  app.post("/api/v1/webhooks/paytr", async (request, reply) => {
    try {
      await processPaytrWebhook({
        billingTestState: options.billingTestState,
        config: options.auth.config,
        payload: request.body as Record<string, unknown>,
      });
      return reply.type("text/plain").send("OK");
    } catch (error) {
      if (error instanceof BillingServiceError && error.kind === "forbidden") {
        return sendForbidden(reply, error.message);
      }
      return sendBillingError(app, reply, error);
    }
  });
}

export function sendBillingError(
  app: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof BillingServiceError) {
    if (error.kind === "not_found") return sendNotFound(reply, error.message);
    if (error.kind === "forbidden") return sendForbidden(reply, error.message);
    if (error.kind === "entitlement_denied") {
      return sendValidationError(
        reply,
        error.message,
        error.details ?? denial("subscription_inactive"),
        "entitlement_denied",
      );
    }
    if (error.kind === "not_ready") {
      return sendValidationError(reply, error.message, error.details);
    }
  }

  app.log.error(error, "Failed to handle billing request");
  return sendInternalServerError(reply);
}
