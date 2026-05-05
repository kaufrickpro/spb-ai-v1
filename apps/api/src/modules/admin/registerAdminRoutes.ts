import { randomUUID } from "node:crypto";
import {
  AdminAccessResponseSchema,
  AdminAuditLogsResponseSchema,
  AdminDashboardResponseSchema,
  AdminJobHealthResponseSchema,
  AdminPendingProfilesResponseSchema,
  AdminPaymentHealthResponseSchema,
  AdminProfileDecisionRequestSchema,
  AdminReviewDecisionRequestSchema,
  AdminReviewDecisionResponseSchema,
  AdminReviewDetailResponseSchema,
  AdminReviewQueueQuerySchema,
  AdminReviewQueueResponseSchema,
  AdminTrustSafetyResponseSchema,
  type AdminReviewQueueQuery,
} from "@marketplace/contracts";
import type { FastifyInstance } from "fastify";
import {
  requireAuthenticatedUser,
  requireAdminUser,
  type AuthDependencies,
  resolveAdminAccess,
} from "../auth/requestAuth.js";
import {
  sendInternalServerError,
  sendNotFound,
} from "../../lib/http/errors.js";
import {
  AdminProfileReviewError,
  applyProfileDecision,
  applyTestProfileDecision,
  getPendingProfiles,
  getTestPendingProfiles,
} from "./profileReviews.js";
import {
  AdminReviewDecisionError,
  applyAdminReviewDecision,
  applyTestAdminReviewDecision,
  filterTestAdminReviews,
  getAdminAuditLogs,
  getAdminReviewAuditHistory,
  getAdminReviewQueue,
  toStringArray,
} from "./service.js";
import {
  getAdminDashboardSummary,
  getAdminJobHealth,
  getAdminPaymentHealth,
  getAdminTrustSafety,
  getTestAdminDashboardSummary,
  getTestAdminJobHealth,
  getTestAdminPaymentHealth,
  getTestAdminTrustSafety,
} from "./healthService.js";
import { mapDbAdminReview } from "./mappers.js";
import { getTestAdminReviewDetail } from "./reviewTestSupport.js";
import {
  buildReviewRelatedEvents,
  createAdminServiceDb,
  createAdminUserDb,
  parseProfileId,
  parseReviewId,
  sendAdminReviewDecisionError,
} from "./routeSupport.js";
import type { AdminTestState } from "./testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";

type RegisterAdminRoutesOptions = {
  auth: AuthDependencies;
  manuscriptTestState: ManuscriptTestState;
  testState: AdminTestState;
};

export function registerAdminRoutes(
  app: FastifyInstance,
  { auth, manuscriptTestState, testState }: RegisterAdminRoutesOptions,
) {
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
          const profile = applyTestProfileDecision(testState, {
            decision: decisionInput.decision,
            now: new Date().toISOString(),
            profileId,
          });

          return reply.send({ profile });
        } catch (error) {
          if (
            error instanceof AdminProfileReviewError &&
            error.kind === "not_found"
          ) {
            return sendNotFound(reply, "Profile not found");
          }

          app.log.error(error, "Failed to apply test profile decision");
          return sendInternalServerError(reply);
        }
      }

      const db = createAdminServiceDb(auth);

      try {
        const profile = await applyProfileDecision(db, {
          decision: decisionInput.decision,
          profileId,
        });

        return reply.send({ profile });
      } catch (error) {
        if (
          error instanceof AdminProfileReviewError &&
          error.kind === "not_found"
        ) {
          return sendNotFound(reply, "Profile not found");
        }

        app.log.error(error, "Failed to apply profile decision");
        return sendInternalServerError(reply);
      }
    },
  );

  app.get("/api/v1/admin/reviews", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    const query = AdminReviewQueueQuerySchema.parse(
      (request.query ?? {}) as AdminReviewQueueQuery,
    );

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminReviewQueueResponseSchema.parse({
          reviews: filterTestAdminReviews(testState, query),
        }),
      );
    }

    const db = createAdminUserDb(auth, user);

    try {
      const reviews = await getAdminReviewQueue(db, query);
      return reply.send(AdminReviewQueueResponseSchema.parse({ reviews }));
    } catch (error) {
      app.log.error(error, "Failed to fetch admin review queue");
      return sendInternalServerError(reply);
    }
  });

  app.get("/api/v1/admin/reviews/:reviewId", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    const reviewId = parseReviewId(request.params, reply);
    if (!reviewId) {
      return;
    }

    if (auth.config.authMode === "test") {
      const reviewDetail = getTestAdminReviewDetail(
        testState,
        manuscriptTestState,
        reviewId,
      );
      if (!reviewDetail) {
        return sendNotFound(reply, "Review not found");
      }

      return reply.send(AdminReviewDetailResponseSchema.parse(reviewDetail));
    }

    const db = createAdminUserDb(auth, user);

    const { data: reviewRow, error: reviewError } = await db
      .from("admin_reviews")
      .select()
      .eq("id", reviewId)
      .single();

    if (reviewError) {
      if (reviewError.code === "PGRST116") {
        return sendNotFound(reply, "Review not found");
      }

      app.log.error(reviewError, "Failed to fetch admin review detail");
      return sendInternalServerError(reply);
    }

    try {
      const review = mapDbAdminReview(reviewRow);
      const auditHistory = await getAdminReviewAuditHistory(
        db,
        review.entityType,
        review.entityId,
      );

      return reply.send(
        AdminReviewDetailResponseSchema.parse({
          review,
          submittedFields:
            (reviewRow as Record<string, unknown>).submitted_fields ?? {},
          riskWarnings: toStringArray(
            (reviewRow as Record<string, unknown>).risk_warnings,
          ),
          relatedEvents: buildReviewRelatedEvents(reviewRow),
          auditHistory,
          decisionNotesRequired: true,
        }),
      );
    } catch (error) {
      app.log.error(error, "Failed to fetch admin review audit history");
      return sendInternalServerError(reply);
    }
  });

  app.post(
    "/api/v1/admin/reviews/:reviewId/decision",
    async (request, reply) => {
      const user = await requireAdminUser(request, reply, auth);
      if (!user) {
        return;
      }

      const reviewId = parseReviewId(request.params, reply);
      if (!reviewId) {
        return;
      }

      const decisionInput = AdminReviewDecisionRequestSchema.parse(
        request.body,
      );

      if (auth.config.authMode === "test") {
        try {
          return reply.send(
            AdminReviewDecisionResponseSchema.parse(
              applyTestAdminReviewDecision(testState, manuscriptTestState, {
                actorUserId: user.userId,
                auditLogId: randomUUID(),
                decision: decisionInput,
                now: new Date().toISOString(),
                reviewId,
              }),
            ),
          );
        } catch (error) {
          if (error instanceof AdminReviewDecisionError) {
            const sent = sendAdminReviewDecisionError(reply, error);
            if (sent) return sent;
          }

          app.log.error(error, "Failed to apply test admin review decision");
          return sendInternalServerError(reply);
        }
      }

      const db = createAdminUserDb(auth, user);

      try {
        return reply.send(
          AdminReviewDecisionResponseSchema.parse(
            await applyAdminReviewDecision(db, {
              actorUserId: user.userId,
              decision: decisionInput,
              reviewId,
            }),
          ),
        );
      } catch (error) {
        if (error instanceof AdminReviewDecisionError) {
          const sent = sendAdminReviewDecisionError(reply, error);
          if (sent) return sent;
        }

        app.log.error(error, "Failed to apply admin review decision");
        return sendInternalServerError(reply);
      }
    },
  );

  app.get("/api/v1/admin/audit-logs", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminAuditLogsResponseSchema.parse({
          logs: testState.auditLogs,
        }),
      );
    }

    const db = createAdminUserDb(auth, user);

    try {
      const logs = await getAdminAuditLogs(db);
      return reply.send(AdminAuditLogsResponseSchema.parse({ logs }));
    } catch (error) {
      app.log.error(error, "Failed to fetch admin audit logs");
      return sendInternalServerError(reply);
    }
  });

  app.get("/api/v1/admin/jobs/health", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminJobHealthResponseSchema.parse(
          getTestAdminJobHealth(testState, manuscriptTestState.ingestionJobs),
        ),
      );
    }

    const db = createAdminUserDb(auth, user);

    try {
      const jobsHealth = await getAdminJobHealth(db);
      return reply.send(AdminJobHealthResponseSchema.parse(jobsHealth));
    } catch (error) {
      app.log.error(error, "Failed to fetch admin jobs health");
      return sendInternalServerError(reply);
    }
  });

  app.get("/api/v1/admin/payments/health", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminPaymentHealthResponseSchema.parse(
          getTestAdminPaymentHealth(testState),
        ),
      );
    }

    const db = createAdminUserDb(auth, user);

    try {
      const paymentHealth = await getAdminPaymentHealth(db);
      return reply.send(AdminPaymentHealthResponseSchema.parse(paymentHealth));
    } catch (error) {
      app.log.error(error, "Failed to fetch admin payment health");
      return sendInternalServerError(reply);
    }
  });

  app.get("/api/v1/admin/trust-safety", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminTrustSafetyResponseSchema.parse(
          getTestAdminTrustSafety(testState),
        ),
      );
    }

    const db = createAdminUserDb(auth, user);

    try {
      const trustSafety = await getAdminTrustSafety(db);
      return reply.send(AdminTrustSafetyResponseSchema.parse(trustSafety));
    } catch (error) {
      app.log.error(error, "Failed to fetch admin trust safety");
      return sendInternalServerError(reply);
    }
  });
}
