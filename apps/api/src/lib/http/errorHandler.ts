import type { FastifyInstance } from "fastify";
import { captureApiException } from "../sentry/index.js";
import { sendInternalServerError, sendValidationError } from "./errors.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (isZodError(error)) {
      return sendValidationError(
        reply,
        "Request payload did not match the contract",
        error.issues,
      );
    }

    captureApiException(error, request);
    app.log.error(error);
    return sendInternalServerError(reply);
  });
}

function isZodError(error: unknown): error is { issues: unknown } {
  return typeof error === "object" && error !== null && "issues" in error;
}
