import type { FastifyReply, FastifyRequest } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccessStatus } from "@marketplace/contracts";
import type { ApiConfig } from "../config/config.js";
import type { AuthenticatedUser, JwtVerifyFn } from "./verifyJwt.js";
import { createUserSupabaseClient } from "../supabase/client.js";
import { sendForbidden, sendUnauthorized } from "../../lib/http/errors.js";

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000010";
export const TEST_PUBLISHER_USER_ID = "00000000-0000-4000-8000-000000000011";
export const TEST_OTHER_AUTHOR_USER_ID = "00000000-0000-4000-8000-000000000012";
export const TEST_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000020";
export const TEST_REVOKED_ADMIN_USER_ID =
  "00000000-0000-4000-8000-000000000021";

export type AuthDependencies = {
  config: ApiConfig;
  verifyJwt: JwtVerifyFn | null;
};

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthDependencies,
): Promise<AuthenticatedUser | null> {
  const user = await authenticateRequest(request, auth);
  if (!user) {
    sendUnauthorized(reply);
    return null;
  }

  return user;
}

export async function requireAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  auth: AuthDependencies,
): Promise<AuthenticatedUser | null> {
  const user = await requireAuthenticatedUser(request, reply, auth);
  if (!user) {
    return null;
  }

  const access = await resolveAdminAccess(user, auth.config);
  if (!access.access) {
    sendForbidden(reply);
    return null;
  }

  return user;
}

export async function authorizeAdminUser(
  user: AuthenticatedUser,
  config: ApiConfig,
): Promise<boolean> {
  const access = await resolveAdminAccess(user, config);
  return access.access;
}

export async function hasAdminMembership(
  user: AuthenticatedUser,
  config: ApiConfig,
): Promise<boolean> {
  const access = await resolveAdminAccess(user, config);
  return access.status !== "no_access";
}

export async function resolveAdminAccess(
  user: AuthenticatedUser,
  config: ApiConfig,
): Promise<{
  access: boolean;
  mfaVerified: boolean;
  status: AdminAccessStatus;
}> {
  if (config.authMode === "test") {
    if (user.userId === TEST_REVOKED_ADMIN_USER_ID) {
      return {
        access: false,
        status: "revoked",
        mfaVerified: isAdminMfaSatisfied(user),
      };
    }

    if (user.userId === TEST_ADMIN_USER_ID) {
      const mfaVerified = isAdminMfaSatisfied(user);
      return {
        access: mfaVerified,
        status: mfaVerified ? "allowed" : "mfa_required",
        mfaVerified,
      };
    }

    return {
      access: false,
      status: "no_access",
      mfaVerified: false,
    };
  }

  const db = createUserClient(config, user.jwt);
  const { data, error } = await db
    .from("admin_users")
    .select("status,note")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      access: false,
      status: "no_access",
      mfaVerified: false,
    };
  }

  if (data.status !== "active") {
    return {
      access: false,
      status: "revoked",
      mfaVerified: isAdminMfaSatisfied(user),
    };
  }

  const mfaVerified =
    isAdminMfaSatisfied(user) || isLocalSeededAdminAccess(config, data.note);
  return {
    access: mfaVerified,
    status: mfaVerified ? "allowed" : "mfa_required",
    mfaVerified,
  };
}

function isLocalSeededAdminAccess(config: ApiConfig, note: unknown): boolean {
  return config.appConfigMode === "local" && note === "local_admin_seed";
}

function createUserClient(config: ApiConfig, userJwt: string): SupabaseClient {
  return createUserSupabaseClient(
    config.supabaseUrl!,
    config.supabaseAnonKey!,
    userJwt,
  );
}

async function authenticateRequest(
  request: FastifyRequest,
  auth: AuthDependencies,
): Promise<AuthenticatedUser | null> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length);

  if (auth.config.authMode === "test") {
    if (token === "test-user") {
      return { userId: TEST_USER_ID, jwt: token, authAssuranceLevel: "aal1" };
    }
    if (token === "test-publisher") {
      return {
        userId: TEST_PUBLISHER_USER_ID,
        jwt: token,
        authAssuranceLevel: "aal1",
      };
    }
    if (token === "test-other-author") {
      return {
        userId: TEST_OTHER_AUTHOR_USER_ID,
        jwt: token,
        authAssuranceLevel: "aal1",
      };
    }
    if (token === "test-admin") {
      return {
        userId: TEST_ADMIN_USER_ID,
        jwt: token,
        authAssuranceLevel: "aal1",
      };
    }
    if (token === "test-admin-mfa") {
      return {
        userId: TEST_ADMIN_USER_ID,
        jwt: token,
        authAssuranceLevel: "aal2",
      };
    }
    if (token === "test-admin-revoked") {
      return {
        userId: TEST_REVOKED_ADMIN_USER_ID,
        jwt: token,
        authAssuranceLevel: "aal2",
      };
    }
    return null;
  }

  if (!auth.verifyJwt) {
    return null;
  }

  try {
    return await auth.verifyJwt(token);
  } catch {
    return null;
  }
}

function isAdminMfaSatisfied(user: AuthenticatedUser): boolean {
  return user.authAssuranceLevel === "aal2";
}
