import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  AdminDashboardResponseSchema,
  AdminPendingProfilesResponseSchema,
  AdminProfileDecisionRequestSchema,
} from "@marketplace/contracts";
import { requireAdminUser } from "../auth/requestAuth.js";
import {
  sendInternalServerError,
  sendNotFound,
} from "../../lib/http/errors.js";
import {
  AdminProfileReviewError,
  getPendingProfileReview,
  getPendingProfiles,
  getProfileById,
  getTestPendingProfileReview,
  getTestPendingProfiles,
} from "./profileReviews.js";
import {
  AdminReviewDecisionError,
  applyAdminReviewDecision,
  applyTestAdminReviewDecision,
} from "./service.js";
import {
  getAdminDashboardSummary,
  getTestAdminDashboardSummary,
} from "./healthService.js";
import {
  createAdminServiceDb,
  createAdminUserDb,
  parseProfileId,
  sendAdminReviewDecisionError,
} from "./routeSupport.js";
import { parseLegacyProfileReviewDecision } from "./adminRouteHelpers.js";
import type { RegisterAdminRoutesOptions } from "./routeTypes.js";

export function registerAdminDashboardRoutes(
  app: FastifyInstance,
  options: RegisterAdminRoutesOptions,
) {
  const { auth, manuscriptTestState, testState } = options;
  app.get("/api/v1/admin/dashboard", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminDashboardResponseSchema.parse({
          summary: getTestAdminDashboardSummary(testState),
        }),
      );
    }

    const db = createAdminUserDb(auth, user);

    try {
      return reply.send(
        AdminDashboardResponseSchema.parse({
          summary: await getAdminDashboardSummary(db),
        }),
      );
    } catch (error) {
      app.log.error(error, "Failed to fetch admin dashboard");
      return sendInternalServerError(reply);
    }
  });

  app.get("/api/v1/admin/pending-profiles", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminPendingProfilesResponseSchema.parse({
          profiles: getTestPendingProfiles(testState),
        }),
      );
    }

    const db = createAdminServiceDb(auth);

    try {
      return reply.send(
        AdminPendingProfilesResponseSchema.parse({
          profiles: await getPendingProfiles(db),
        }),
      );
    } catch (error) {
      app.log.error(error, "Failed to fetch pending profiles");
      return sendInternalServerError(reply);
    }
  });

  app.post(
    "/api/v1/admin/profiles/:profileId/decision",
    async (request, reply) => {
      const user = await requireAdminUser(request, reply, auth);
      if (!user) {
        return;
      }

      const profileId = parseProfileId(request.params, reply);
      if (!profileId) {
        return;
      }

      const decisionInput = AdminProfileDecisionRequestSchema.parse(
        request.body,
      );

      if (auth.config.authMode === "test") {
        try {
          const review = getTestPendingProfileReview(testState, profileId);
          const reviewDecisionInput = parseLegacyProfileReviewDecision(
            decisionInput,
            reply,
          );
          if (!reviewDecisionInput) {
            return;
          }

          applyTestAdminReviewDecision(testState, manuscriptTestState, {
            actorUserId: user.userId,
            auditLogId: randomUUID(),
            decision: reviewDecisionInput,
            now: new Date().toISOString(),
            reviewId: review.id,
          });
          const profile = testState.profiles.find(
            (item) => item.id === profileId,
          );
          if (!profile) {
            return sendNotFound(reply, "Profile not found");
          }

          return reply.send({ profile });
        } catch (error) {
          if (
            error instanceof AdminProfileReviewError &&
            error.kind === "not_found"
          ) {
            return sendNotFound(reply, error.message);
          }

          app.log.error(error, "Failed to apply test profile decision");
          return sendInternalServerError(reply);
        }
      }

      const db = createAdminUserDb(auth, user);

      try {
        const review = await getPendingProfileReview(db, profileId);
        const reviewDecisionInput = parseLegacyProfileReviewDecision(
          decisionInput,
          reply,
        );
        if (!reviewDecisionInput) {
          return;
        }

        await applyAdminReviewDecision(db, {
          actorUserId: user.userId,
          decision: reviewDecisionInput,
          reviewId: review.id,
        });
        const profile = await getProfileById(db, profileId);

        return reply.send({ profile });
      } catch (error) {
        if (
          error instanceof AdminProfileReviewError &&
          error.kind === "not_found"
        ) {
          return sendNotFound(reply, error.message);
        }
        if (error instanceof AdminReviewDecisionError) {
          const sent = sendAdminReviewDecisionError(reply, error);
          if (sent) return sent;
        }

        app.log.error(error, "Failed to apply profile decision");
        return sendInternalServerError(reply);
      }
    },
  );
}
