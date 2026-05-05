import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a user-scoped Supabase client using the caller's access token.
 * Row Level Security is enforced — `auth.uid()` resolves to the token owner.
 * Never uses the service-role key. Safe to call per-request.
 */
export function createUserSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  userJwt: string,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${userJwt}` },
    },
  });
}

export function createServiceRoleSupabaseClient(
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
