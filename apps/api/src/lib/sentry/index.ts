import * as Sentry from "@sentry/node";
import type { FastifyRequest } from "fastify";
import type { ApiConfig } from "../../modules/config/config.js";
import { scrubSentryEvent } from "./redaction.js";

let initialized = false;

export function initializeSentry(config: ApiConfig): void {
  if (!config.sentryDsn || initialized) {
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    release: config.sentryRelease,
    sendDefaultPii: false,
    tracesSampleRate: config.sentryTracesSampleRate,
    integrations: [Sentry.fastifyIntegration()],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });

  Sentry.setTag("service", "api");
  initialized = true;
}

export function captureApiException(
  error: unknown,
  request: FastifyRequest,
): void {
  if (!initialized) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("service", "api");
    scope.setTag("request_id", request.id);
    scope.setContext("request", {
      method: request.method,
      route: request.routeOptions.url,
      url: request.url,
    });
    Sentry.captureException(error);
  });
}
