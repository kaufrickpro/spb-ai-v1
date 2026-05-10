import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  AdminAuditLogsResponseSchema,
  AdminReviewDecisionRequestSchema,
  AdminReviewDecisionResponseSchema,
  AdminReviewDetailResponseSchema,
  AdminReviewQueueQuerySchema,
  AdminReviewQueueResponseSchema,
  type AdminReviewQueueQuery,
} from "@marketplace/contracts";
import { requireAdminUser } from "../auth/requestAuth.js";
import {
  sendInternalServerError,
  sendNotFound,
} from "../../lib/http/errors.js";
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
import { mapDbAdminReview } from "./mappers.js";
import { getTestAdminReviewDetail } from "./reviewTestSupport.js";
import {
  buildReviewRelatedEvents,
  createAdminUserDb,
  parseReviewId,
  sendAdminReviewDecisionError,
} from "./routeSupport.js";
import { enqueueDecisionSideEffects } from "./decisionSideEffects.js";
import type { RegisterAdminRoutesOptions } from "./routeTypes.js";

export function registerAdminReviewRoutes(
  app: FastifyInstance,
  options: RegisterAdminRoutesOptions,
) {
  const {
    auth,
    emailTestState,
    introTestState,
    manuscriptTestState,
    profileTestState,
    testState,
  } = options;
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
          const response = applyTestAdminReviewDecision(
            testState,
            manuscriptTestState,
            {
              actorUserId: user.userId,
              auditLogId: randomUUID(),
              decision: decisionInput,
              now: new Date().toISOString(),
              reviewId,
            },
          );
          await enqueueDecisionSideEffects(app, {
            auth,
            emailTestState,
            introTestState,
            manuscriptTestState,
            profileTestState,
            response,
          });
          return reply.send(AdminReviewDecisionResponseSchema.parse(response));
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
}
