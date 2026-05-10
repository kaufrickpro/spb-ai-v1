import type { FastifyInstance } from "fastify";
import {
  ManuscriptAccessRequestListResponseSchema,
  ManuscriptAccessRequestResponseSchema,
  ManuscriptProfileResponseSchema,
} from "@marketplace/contracts";
import { requireAuthenticatedUser } from "../auth/requestAuth.js";
import {
  createManuscriptAccessRequest,
  decideManuscriptAccessRequest,
  getManuscriptProfilePage,
  listManuscriptAccessRequests,
} from "./profileAccessService.js";
import {
  parseUuidParam,
  sendManuscriptProfileAccessError,
} from "./routeSupport.js";
import type { RegisterManuscriptRoutesOptions } from "./routeTypes.js";

export function registerManuscriptProfileRoutes(
  app: FastifyInstance,
  options: RegisterManuscriptRoutesOptions,
) {
  const {
    auth,
    introTestState,
    matchingTestState,
    profileTestState,
    testState,
  } = options;
  app.get(
    "/api/v1/profiles/manuscripts/:manuscriptId",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const manuscriptId = parseUuidParam(
        request.params,
        "manuscriptId",
        reply,
      );
      if (!manuscriptId) return;

      try {
        const response = await getManuscriptProfilePage({
          config: auth.config,
          introTestState,
          manuscriptId,
          manuscriptTestState: testState,
          matchingTestState,
          profileTestState: profileTestState,
          user,
        });
        return reply.send(ManuscriptProfileResponseSchema.parse(response));
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.post(
    "/api/v1/manuscripts/:manuscriptId/access-requests",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const manuscriptId = parseUuidParam(
        request.params,
        "manuscriptId",
        reply,
      );
      if (!manuscriptId) return;

      try {
        const response = await createManuscriptAccessRequest({
          config: auth.config,
          manuscriptId,
          manuscriptTestState: testState,
          profileTestState,
          user,
        });
        return reply
          .code(201)
          .send(ManuscriptAccessRequestResponseSchema.parse(response));
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.get("/api/v1/manuscript-access-requests", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    try {
      const response = await listManuscriptAccessRequests({
        config: auth.config,
        manuscriptTestState: testState,
        profileTestState,
        user,
      });
      return reply.send(
        ManuscriptAccessRequestListResponseSchema.parse(response),
      );
    } catch (error) {
      return sendManuscriptProfileAccessError(app, reply, error);
    }
  });

  app.post(
    "/api/v1/manuscript-access-requests/:requestId/approve",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const requestId = parseUuidParam(request.params, "requestId", reply);
      if (!requestId) return;

      try {
        const response = await decideManuscriptAccessRequest({
          config: auth.config,
          decision: "approved",
          manuscriptTestState: testState,
          profileTestState,
          requestId,
          user,
        });
        return reply.send(
          ManuscriptAccessRequestResponseSchema.parse(response),
        );
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.post(
    "/api/v1/manuscript-access-requests/:requestId/reject",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const requestId = parseUuidParam(request.params, "requestId", reply);
      if (!requestId) return;

      try {
        const response = await decideManuscriptAccessRequest({
          config: auth.config,
          decision: "rejected",
          manuscriptTestState: testState,
          profileTestState,
          requestId,
          user,
        });
        return reply.send(
          ManuscriptAccessRequestResponseSchema.parse(response),
        );
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );
}
