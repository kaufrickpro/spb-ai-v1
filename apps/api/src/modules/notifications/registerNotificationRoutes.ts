import type { FastifyInstance, FastifyReply } from "fastify";
import {
  NotificationListQuerySchema,
  NotificationListResponseSchema,
  NotificationReadAllResponseSchema,
  NotificationReadResponseSchema,
} from "@marketplace/contracts";
import {
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import { NotificationServiceError } from "./errors.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./service.js";

type RegisterNotificationRoutesOptions = {
  auth: AuthDependencies;
  introTestState: IntroRequestTestState;
  profileTestState: ProfileTestState;
};

export function registerNotificationRoutes(
  app: FastifyInstance,
  options: RegisterNotificationRoutesOptions,
) {
  app.get("/api/v1/notifications", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    const query = NotificationListQuerySchema.parse(request.query ?? {});
    try {
      const response = await listNotifications({
        config: options.auth.config,
        introTestState: options.introTestState,
        profileTestState: options.profileTestState,
        query,
        user,
      });
      return reply.send(NotificationListResponseSchema.parse(response));
    } catch (error) {
      return sendNotificationError(app, reply, error);
    }
  });

  app.post(
    "/api/v1/notifications/:notificationId/read",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, options.auth);
      if (!user) return;

      const notificationId = parseNotificationId(request.params, reply);
      if (!notificationId) return;

      try {
        const response = await markNotificationRead({
          config: options.auth.config,
          introTestState: options.introTestState,
          notificationId,
          profileTestState: options.profileTestState,
          user,
        });
        return reply.send(NotificationReadResponseSchema.parse(response));
      } catch (error) {
        return sendNotificationError(app, reply, error);
      }
    },
  );

  app.post("/api/v1/notifications/read-all", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, options.auth);
    if (!user) return;

    try {
      const response = await markAllNotificationsRead({
        config: options.auth.config,
        introTestState: options.introTestState,
        profileTestState: options.profileTestState,
        user,
      });
      return reply.send(NotificationReadAllResponseSchema.parse(response));
    } catch (error) {
      return sendNotificationError(app, reply, error);
    }
  });
}

function sendNotificationError(
  app: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof NotificationServiceError) {
    if (error.kind === "not_found") return sendNotFound(reply, error.message);
  }

  app.log.error(error, "Failed to handle notifications");
  return sendInternalServerError(reply);
}

function parseNotificationId(params: unknown, reply: FastifyReply) {
  const raw = (params as { notificationId?: unknown }).notificationId;
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) {
    sendValidationError(reply, "Invalid notification id", []);
    return null;
  }
  return raw;
}
