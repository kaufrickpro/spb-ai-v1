import { HealthResponseSchema } from "@marketplace/contracts";
import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () =>
    HealthResponseSchema.parse({ status: "ok", service: "api" }),
  );

  app.get("/ready", async () =>
    HealthResponseSchema.parse({ status: "ok", service: "api" }),
  );
}
