import type { FastifyInstance } from "fastify";
import {
  AdminAccessResponseSchema,
  AdminBillingRepairRequestSchema,
  AdminBillingRepairResponseSchema,
  PublicDirectoryDecisionRequestSchema,
  PublicDirectoryDecisionResponseSchema,
} from "@marketplace/contracts";
import {
  requireAdminUser,
  requireAuthenticatedUser,
  resolveAdminAccess,
} from "../auth/requestAuth.js";
import {
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import { repairBillingFromAdmin } from "../billing/paytrBillingService.js";
import { sendBillingError } from "../billing/registerBillingRoutes.js";
import {
  applyPublicDirectoryDecision,
  MatchProfileServiceError,
} from "../profiles/matchProfileService.js";
import { parsePublisherProfileId } from "./adminRouteHelpers.js";
import type { RegisterAdminRoutesOptions } from "./routeTypes.js";

export function registerAdminAccessRoutes(
  app: FastifyInstance,
  options: RegisterAdminRoutesOptions,
) {
  const { auth, billingTestState, profileTestState } = options;
  app.get("/api/v1/admin/access", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) {
      return;
    }

    try {
      const access = await resolveAdminAccess(user, auth.config);
      return reply.send(AdminAccessResponseSchema.parse(access));
    } catch (error) {
      app.log.error(error, "Failed to resolve admin access");
      return sendInternalServerError(reply);
    }
  });

  app.post("/api/v1/admin/billing/repair", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    const input = AdminBillingRepairRequestSchema.parse(request.body);
    try {
      const result = await repairBillingFromAdmin({
        action: input.action,
        actorUserId: user.userId,
        billingTestState,
        config: auth.config,
        internalNote: input.internalNote,
        paymentEventId: input.paymentEventId,
        paytrSubscriptionRef: input.paytrSubscriptionRef,
        status: input.status,
        subscriptionId: input.subscriptionId,
      });
      return reply.send(
        AdminBillingRepairResponseSchema.parse({
          repaired: Boolean(
            (result as { repaired?: boolean } | null)?.repaired ?? true,
          ),
        }),
      );
    } catch (error) {
      return sendBillingError(app, reply, error);
    }
  });

  app.post(
    "/api/v1/admin/publishers/:publisherProfileId/public-directory",
    async (request, reply) => {
      const user = await requireAdminUser(request, reply, auth);
      if (!user) {
        return;
      }

      const publisherProfileId = parsePublisherProfileId(request.params, reply);
      if (!publisherProfileId) {
        return;
      }

      const input = PublicDirectoryDecisionRequestSchema.parse(request.body);

      try {
        const response = await applyPublicDirectoryDecision({
          config: auth.config,
          publisherProfileId,
          status: input.status,
          testState: profileTestState,
          user,
        });
        return reply.send(
          PublicDirectoryDecisionResponseSchema.parse(response),
        );
      } catch (error) {
        if (
          error instanceof MatchProfileServiceError &&
          error.kind === "not_found"
        ) {
          return sendNotFound(reply, error.message);
        }
        if (
          error instanceof MatchProfileServiceError &&
          error.kind === "not_ready"
        ) {
          return sendValidationError(reply, error.message, [], "not_ready");
        }

        app.log.error(error, "Failed to update public directory visibility");
        return sendInternalServerError(reply);
      }
    },
  );
}
