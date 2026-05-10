import type { FastifyInstance } from "fastify";
import { registerAdminAccessRoutes } from "./registerAdminAccessRoutes.js";
import { registerAdminDashboardRoutes } from "./registerAdminDashboardRoutes.js";
import { registerAdminOperationalRoutes } from "./registerAdminOperationalRoutes.js";
import { registerAdminReviewRoutes } from "./registerAdminReviewRoutes.js";
import type { RegisterAdminRoutesOptions } from "./routeTypes.js";

export function registerAdminRoutes(
  app: FastifyInstance,
  options: RegisterAdminRoutesOptions,
) {
  registerAdminAccessRoutes(app, options);
  registerAdminDashboardRoutes(app, options);
  registerAdminReviewRoutes(app, options);
  registerAdminOperationalRoutes(app, options);
}
