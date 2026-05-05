import type { FastifyReply } from "fastify";
import { sendForbidden } from "../../lib/http/errors.js";
import type { AuthDependencies } from "../auth/requestAuth.js";
import { requireAuthenticatedUser } from "../auth/requestAuth.js";
import {
  createServiceRoleSupabaseClient,
  createUserSupabaseClient,
} from "../supabase/client.js";
import { isTestAuthorUser } from "./testState.js";

export type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof requireAuthenticatedUser>>
>;
export type UserSupabaseClient = ReturnType<typeof createUserSupabaseClient>;
export type ServiceRoleSupabaseClient = ReturnType<
  typeof createServiceRoleSupabaseClient
>;
export type AuthorRequestContext =
  | { mode: "test" }
  | {
      db: UserSupabaseClient;
      mode: "supabase";
      serviceDb: ServiceRoleSupabaseClient;
    };

export async function requireAuthorRequest(
  auth: AuthDependencies,
  user: AuthenticatedUser,
  reply: FastifyReply,
  forbiddenMessage: string,
): Promise<AuthorRequestContext | null> {
  if (auth.config.authMode === "test") {
    if (!isTestAuthorUser(user.userId)) {
      sendForbidden(reply, forbiddenMessage);
      return null;
    }

    return { mode: "test" };
  }

  const db = createUserSupabaseClient(
    auth.config.supabaseUrl!,
    auth.config.supabaseAnonKey!,
    user.jwt,
  );
  const serviceDb = createServiceRoleSupabaseClient(
    auth.config.supabaseUrl!,
    auth.config.supabaseServiceRoleKey!,
  );

  const role = await getMarketplaceRole(db, user.userId);
  if (role !== "author") {
    sendForbidden(reply, forbiddenMessage);
    return null;
  }

  return { db, mode: "supabase", serviceDb };
}

async function getMarketplaceRole(
  db: UserSupabaseClient,
  userId: string,
): Promise<"author" | "publisher" | null> {
  const { data, error } = await db
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role === "author" || data.role === "publisher"
    ? data.role
    : null;
}
