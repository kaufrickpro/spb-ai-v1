import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import type { ApiConfig } from "./modules/config/config.js";
import {
  createSupabaseJwksVerifier,
  type JwtVerifyFn,
} from "./modules/auth/verifyJwt.js";
import { registerErrorHandler } from "./lib/http/errorHandler.js";
import { registerHealthRoutes } from "./modules/health/registerHealthRoutes.js";
import { registerProfileRoutes } from "./modules/profiles/registerProfileRoutes.js";
import { registerAdminRoutes } from "./modules/admin/registerAdminRoutes.js";
import { createAdminTestState } from "./modules/admin/testState.js";
import type { AdminTestState } from "./modules/admin/testState.js";
import { registerManuscriptRoutes } from "./modules/manuscripts/registerManuscriptRoutes.js";
import { createManuscriptTestState } from "./modules/manuscripts/testState.js";
import type { ManuscriptTestState } from "./modules/manuscripts/testState.js";
import { createProfileTestState } from "./modules/profiles/testState.js";
import type { ProfileTestState } from "./modules/profiles/testState.js";
import { registerMatchingRoutes } from "./modules/matching/registerMatchingRoutes.js";
import { createMatchingTestState } from "./modules/matching/testState.js";
import type { MatchingTestState } from "./modules/matching/testState.js";
import { registerIntroRequestRoutes } from "./modules/introRequests/registerIntroRequestRoutes.js";
import { createIntroRequestTestState } from "./modules/introRequests/testState.js";
import type { IntroRequestTestState } from "./modules/introRequests/testState.js";
import { registerNotificationRoutes } from "./modules/notifications/registerNotificationRoutes.js";
import { registerBillingRoutes } from "./modules/billing/registerBillingRoutes.js";
import { createBillingTestState } from "./modules/billing/testState.js";
import type { BillingTestState } from "./modules/billing/testState.js";
import { registerEmailWebhookRoutes } from "./modules/email/registerEmailWebhookRoutes.js";
import { createEmailTestState } from "./modules/email/testState.js";
import type { EmailTestState } from "./modules/email/testState.js";
import { initializeSentry } from "./lib/sentry/index.js";

type BuildAppOptions = {
  config: ApiConfig;
  /** Override the JWT verifier — used in tests to inject a local key set. */
  jwtVerify?: JwtVerifyFn;
  testState?: {
    admin?: AdminTestState;
    billing?: BillingTestState;
    email?: EmailTestState;
    introRequests?: IntroRequestTestState;
    manuscripts?: ManuscriptTestState;
    matching?: MatchingTestState;
    profiles?: ProfileTestState;
  };
};

function isAllowedOrigin(requestOrigin: string | undefined, config: ApiConfig) {
  if (!requestOrigin) {
    return false;
  }

  if (requestOrigin === config.webAppUrl) {
    return true;
  }

  if (config.appConfigMode !== "local") {
    return false;
  }

  try {
    const parsedOrigin = new URL(requestOrigin);

    if (
      parsedOrigin.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(parsedOrigin.hostname)
    ) {
      return false;
    }

    return parsedOrigin.port.length > 0;
  } catch {
    return false;
  }
}

export function buildApp({
  config,
  jwtVerify,
  testState: injectedTestState,
}: BuildAppOptions): FastifyInstance {
  initializeSentry(config);

  const app = Fastify({
    logger: config.logLevel === "silent" ? false : { level: config.logLevel },
    routerOptions: {
      maxParamLength: 1024,
    },
  });

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const params = new URLSearchParams(
        typeof body === "string" ? body : body.toString("utf8"),
      );
      done(
        null,
        Object.fromEntries(
          Array.from(params.entries()).map(([key, value]) => [key, value]),
        ),
      );
    },
  );

  // Resolve the JWT verifier once at startup.
  const verifyJwt: JwtVerifyFn | null =
    config.authMode === "supabase"
      ? (jwtVerify ?? createSupabaseJwksVerifier(config.supabaseUrl!))
      : null;

  const auth = { config, verifyJwt };
  const testState = injectedTestState?.admin ?? createAdminTestState();
  const manuscriptTestState =
    injectedTestState?.manuscripts ?? createManuscriptTestState();
  const profileTestState =
    injectedTestState?.profiles ?? createProfileTestState();
  const matchingTestState =
    injectedTestState?.matching ?? createMatchingTestState();
  const introRequestTestState =
    injectedTestState?.introRequests ?? createIntroRequestTestState();
  const billingTestState =
    injectedTestState?.billing ?? createBillingTestState();
  const emailTestState = injectedTestState?.email ?? createEmailTestState();

  app.addHook("onRequest", async (request, reply) => {
    const requestOrigin = request.headers.origin;

    if (isAllowedOrigin(requestOrigin, config)) {
      reply.header("access-control-allow-origin", requestOrigin);
      reply.header("vary", "Origin");
    }

    reply.header(
      "access-control-allow-methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    reply.header(
      "access-control-allow-headers",
      request.headers["access-control-request-headers"] ??
        "authorization,content-type",
    );

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  registerHealthRoutes(app);
  registerProfileRoutes(
    app,
    auth,
    billingTestState,
    profileTestState,
    manuscriptTestState,
    introRequestTestState,
    matchingTestState,
  );
  registerAdminRoutes(app, {
    auth,
    billingTestState,
    emailTestState,
    introTestState: introRequestTestState,
    manuscriptTestState,
    profileTestState,
    testState,
  });
  registerManuscriptRoutes(app, {
    auth,
    adminTestState: testState,
    billingTestState,
    introTestState: introRequestTestState,
    matchingTestState,
    profileTestState,
    testState: manuscriptTestState,
  });
  registerMatchingRoutes(app, {
    auth,
    billingTestState,
    introTestState: introRequestTestState,
    manuscriptTestState,
    profileTestState,
    testState: matchingTestState,
  });
  registerIntroRequestRoutes(app, {
    auth,
    billingTestState,
    emailTestState,
    introTestState: introRequestTestState,
    manuscriptTestState,
    matchingTestState,
    profileTestState,
  });
  registerNotificationRoutes(app, {
    auth,
    introTestState: introRequestTestState,
    profileTestState,
  });
  registerBillingRoutes(app, {
    auth,
    billingTestState,
    emailTestState,
    manuscriptTestState,
    profileTestState,
  });
  registerEmailWebhookRoutes(app, {
    config,
    emailTestState,
  });
  registerErrorHandler(app);

  return app;
}
