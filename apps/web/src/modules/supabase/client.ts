import { createClient } from "@supabase/supabase-js";
import { getWebConfig } from "../config/config";

const config = getWebConfig();

/**
 * Shared Supabase browser client (anon key only).
 * Used for Auth session management.
 * Never contains the service-role key.
 */
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
