import type { SupabaseClient, User } from "@supabase/supabase-js";

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseFirstAdminAllowlist(raw: string): string[] {
  return raw
    .split(",")
    .map(normalizeAdminEmail)
    .filter((value) => value.length > 0);
}

export function assertFirstAdminEmailAllowed(
  email: string,
  allowlist: string[],
): string {
  const normalizedEmail = normalizeAdminEmail(email);

  if (!allowlist.includes(normalizedEmail)) {
    throw new Error(
      `Email ${normalizedEmail} is not in FIRST_ADMIN_EMAIL_ALLOWLIST`,
    );
  }

  return normalizedEmail;
}

export async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalizedEmail = normalizeAdminEmail(email);
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => normalizeAdminEmail(user.email ?? "") === normalizedEmail,
    );

    if (match) {
      return match;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
}

async function ensureAuthUserForFirstAdmin(input: {
  client: SupabaseClient;
  email: string;
  redirectTo?: string;
}): Promise<{ created: boolean; user: User }> {
  const existingUser = await findAuthUserByEmail(input.client, input.email);
  if (existingUser?.id) {
    return { created: false, user: existingUser };
  }

  const { data, error } = await input.client.auth.admin.inviteUserByEmail(
    input.email,
    input.redirectTo ? { redirectTo: input.redirectTo } : {},
  );

  if (error) {
    throw error;
  }

  if (!data.user?.id) {
    throw new Error(`Failed to create invited auth user for ${input.email}`);
  }

  return { created: true, user: data.user };
}

export async function bootstrapFirstAdmin(input: {
  client: SupabaseClient;
  email: string;
  allowlist: string[];
  note?: string;
  redirectTo?: string;
}): Promise<{
  alreadyExisted: boolean;
  authUserCreated: boolean;
  userId: string;
}> {
  const normalizedEmail = assertFirstAdminEmailAllowed(
    input.email,
    input.allowlist,
  );
  const { created: authUserCreated, user } = await ensureAuthUserForFirstAdmin({
    client: input.client,
    email: normalizedEmail,
    redirectTo: input.redirectTo,
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
      `User ${normalizedEmail} already has a marketplace profile and cannot become an admin`,
    );
  }

  const { data: existingAdmin, error: existingAdminError } = await input.client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingAdminError) {
    throw existingAdminError;
  }

  if (existingAdmin) {
    return { alreadyExisted: true, authUserCreated, userId: user.id };
  }

  const { error: insertError } = await input.client.from("admin_users").insert({
    user_id: user.id,
    note: input.note ?? "first_admin_bootstrap",
    status: "active",
  });

  if (insertError) {
    throw insertError;
  }

  return { alreadyExisted: false, authUserCreated, userId: user.id };
}
