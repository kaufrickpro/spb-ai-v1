import type { FastifyInstance } from "fastify";
import { registerAuthorManuscriptRoutes } from "./registerAuthorManuscriptRoutes.js";
import { registerDocumentRoutes } from "./registerDocumentRoutes.js";
import { registerManuscriptProfileRoutes } from "./registerManuscriptProfileRoutes.js";
import { registerSampleContentTypeParsers } from "./routeSupport.js";
import type { RegisterManuscriptRoutesOptions } from "./routeTypes.js";

export function registerManuscriptRoutes(
  app: FastifyInstance,
  options: RegisterManuscriptRoutesOptions,
) {
  registerSampleContentTypeParsers(app);
  registerAuthorManuscriptRoutes(app, options);
  registerDocumentRoutes(app, options);
  registerManuscriptProfileRoutes(app, options);
}
