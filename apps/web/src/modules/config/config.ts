import { z } from "zod";

const WebConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
});

export type WebConfig = z.infer<typeof WebConfigSchema>;

export function getWebConfig(): WebConfig {
  return WebConfigSchema.parse({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000",
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
}
