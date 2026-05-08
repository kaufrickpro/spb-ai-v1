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
import { initializeSentry } from "./lib/sentry/index.js";

type BuildAppOptions = {
  config: ApiConfig;
  /** Override the JWT verifier — used in tests to inject a local key set. */
  jwtVerify?: JwtVerifyFn;
  testState?: {
    admin?: AdminTestState;
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
  registerProfileRoutes(app, auth, profileTestState, manuscriptTestState);
  registerAdminRoutes(app, {
    auth,
    manuscriptTestState,
    profileTestState,
    testState,
  });
  registerManuscriptRoutes(app, {
    auth,
    adminTestState: testState,
    profileTestState,
    testState: manuscriptTestState,
  });
  registerMatchingRoutes(app, {
    auth,
    manuscriptTestState,
    profileTestState,
    testState: matchingTestState,
  });
  registerErrorHandler(app);

  return app;
}
