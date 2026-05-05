import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  findAuthUserByEmail,
  normalizeAdminEmail,
} from "./bootstrapFirstAdmin.js";

export const LOCAL_ADMIN_NOTE = "local_admin_seed";
export const DEFAULT_LOCAL_ADMIN_EMAIL = "admin@example.com";
export const DEFAULT_LOCAL_ADMIN_PASSWORD = "local-admin-password";

export async function seedLocalAdmin(input: {
  appConfigMode: string;
  client: SupabaseClient;
  email?: string;
  password?: string;
}): Promise<{
  createdAuthUser: boolean;
  email: string;
  password: string;
  userId: string;
}> {
  if (input.appConfigMode !== "local") {
    throw new Error("admin:seed is allowed only when APP_CONFIG_MODE=local");
  }

  const email = normalizeAdminEmail(input.email ?? DEFAULT_LOCAL_ADMIN_EMAIL);
  const password = input.password ?? DEFAULT_LOCAL_ADMIN_PASSWORD;

  if (password.length < 6) {
    throw new Error("Local admin password must be at least 6 characters");
  }

  const { created, user } = await ensureLocalAuthUser({
    client: input.client,
    email,
    password,
  });

  const { data: existingProfile, error: profileError } = await input.client
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (existingProfile) {
    throw new Error(
      `User ${email} already has a marketplace profile and cannot become an admin`,
    );
  }

  const { error: upsertError } = await input.client.from("admin_users").upsert({
    note: LOCAL_ADMIN_NOTE,
    status: "active",
    user_id: user.id,
  });

  if (upsertError) {
    throw upsertError;
  }

  return {
    createdAuthUser: created,
    email,
    password,
    userId: user.id,
  };
}

async function ensureLocalAuthUser(input: {
  client: SupabaseClient;
  email: string;
  password: string;
}): Promise<{ created: boolean; user: User }> {
  const existingUser = await findAuthUserByEmail(input.client, input.email);

  if (existingUser?.id) {
    const { data, error } = await input.client.auth.admin.updateUserById(
      existingUser.id,
      {
        email: input.email,
        email_confirm: true,
        password: input.password,
      },
    );

    if (error) {
      throw error;
    }

    if (!data.user?.id) {
      throw new Error(`Failed to update local admin user for ${input.email}`);
    }

    return { created: false, user: data.user };
  }

  const { data, error } = await input.client.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    password: input.password,
  });

  if (error) {
    throw error;
  }

  if (!data.user?.id) {
    throw new Error(`Failed to create local admin user for ${input.email}`);
  }

  return { created: true, user: data.user };
}
