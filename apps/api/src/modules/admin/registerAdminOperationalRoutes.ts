import type { FastifyInstance } from "fastify";
import {
  AdminJobHealthResponseSchema,
  AdminPaymentHealthResponseSchema,
  AdminTrustSafetyResponseSchema,
} from "@marketplace/contracts";
import { requireAdminUser } from "../auth/requestAuth.js";
import { sendInternalServerError } from "../../lib/http/errors.js";
import {
  getAdminJobHealth,
  getAdminPaymentHealth,
  getAdminTrustSafety,
  getTestAdminJobHealth,
  getTestAdminPaymentHealth,
  getTestAdminTrustSafety,
} from "./healthService.js";
import { createAdminUserDb } from "./routeSupport.js";
import type { RegisterAdminRoutesOptions } from "./routeTypes.js";

export function registerAdminOperationalRoutes(
  app: FastifyInstance,
  options: RegisterAdminRoutesOptions,
) {
  const { auth, testState } = options;
  app.get("/api/v1/admin/jobs/health", async (request, reply) => {
    const user = await requireAdminUser(request, reply, auth);
    if (!user) {
      return;
    }

    if (auth.config.authMode === "test") {
      return reply.send(
        AdminJobHealthResponseSchema.parse(getTestAdminJobHealth(testState)),
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
