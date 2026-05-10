import type { FastifyInstance } from "fastify";
import {
  CreateManuscriptRequestSchema,
  ManuscriptListResponseSchema,
  ManuscriptResponseSchema,
  UpdateManuscriptRequestSchema,
} from "@marketplace/contracts";
import { requireAuthenticatedUser } from "../auth/requestAuth.js";
import { requireAuthorRequest } from "./access.js";
import {
  createAuthorManuscript,
  getAuthorManuscript,
  listAuthorManuscripts,
  updateAuthorManuscript,
} from "./service.js";
import { parseUuidParam, sendManuscriptServiceError } from "./routeSupport.js";
import type { RegisterManuscriptRoutesOptions } from "./routeTypes.js";

export function registerAuthorManuscriptRoutes(
  app: FastifyInstance,
  options: RegisterManuscriptRoutesOptions,
) {
  const { adminTestState, auth, testState } = options;
  app.get("/api/v1/manuscripts", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can access manuscripts",
    );
    if (!context) return;

    try {
      const manuscripts = await listAuthorManuscripts(
        context,
        testState,
        user.userId,
      );
      return reply.send(ManuscriptListResponseSchema.parse({ manuscripts }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.post("/api/v1/manuscripts", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const input = CreateManuscriptRequestSchema.parse(request.body);
    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can create manuscripts",
    );
    if (!context) return;

    try {
      const manuscript = await createAuthorManuscript(context, {
        adminTestState,
        authorId: user.userId,
        request: input,
        testState,
      });
      return reply
        .code(201)
        .send(ManuscriptResponseSchema.parse({ manuscript }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.get("/api/v1/manuscripts/:id", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const manuscriptId = parseUuidParam(request.params, "id", reply);
    if (!manuscriptId) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can access manuscripts",
    );
    if (!context) return;

    try {
      const manuscript = await getAuthorManuscript(context, testState, {
        authorId: user.userId,
        manuscriptId,
      });
      return reply.send(ManuscriptResponseSchema.parse({ manuscript }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.patch("/api/v1/manuscripts/:id", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const manuscriptId = parseUuidParam(request.params, "id", reply);
    if (!manuscriptId) return;

    const input = UpdateManuscriptRequestSchema.parse(request.body);
    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can update manuscripts",
    );
    if (!context) return;

    try {
      const manuscript = await updateAuthorManuscript(context, testState, {
        authorId: user.userId,
        manuscriptId,
        request: input,
      });
      return reply.send(ManuscriptResponseSchema.parse({ manuscript }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });
}
