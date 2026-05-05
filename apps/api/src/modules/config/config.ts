import { z } from "zod";

const ApiConfigSchema = z.object({
  appConfigMode: z.enum(["local", "staging", "production"]),
  authMode: z.enum(["test", "supabase"]),
  host: z.string().min(1),
  logLevel: z.enum([
    "silent",
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
  ]),
  port: z.coerce.number().int().positive(),
  storageProvider: z.enum(["local", "gcs"]),
  webAppUrl: z.string().url(),
  // Used to construct the JWKS endpoint: ${supabaseUrl}/auth/v1/.well-known/jwks.json
  // No JWT secret is needed — token verification uses the public key from JWKS.
  supabaseUrl: z.string().url().optional(),
  // Anon key used to create user-scoped Supabase clients (RLS enforced).
  supabaseAnonKey: z.string().min(1).optional(),
  // Service-role key used only by trusted server-side admin/bootstrap paths.
  supabaseServiceRoleKey: z.string().min(1).optional(),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const authMode = env.API_AUTH_MODE ?? "test";
  const parsed = ApiConfigSchema.parse({
    appConfigMode: env.APP_CONFIG_MODE ?? "local",
    authMode,
    host: env.HOST ?? "0.0.0.0",
    logLevel: env.LOG_LEVEL ?? "info",
    port: env.PORT ?? "4000",
    storageProvider:
      env.STORAGE_PROVIDER ??
      ((env.APP_CONFIG_MODE ?? "local") === "local" ? "local" : "gcs"),
    webAppUrl: env.WEB_APP_URL ?? "http://localhost:5173",
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  // Fail fast: supabase mode requires the project URL, anon key, and trusted service-role key.
  if (parsed.authMode === "supabase") {
    z.object({
      supabaseUrl: z.string().url(),
      supabaseAnonKey: z.string().min(1),
      supabaseServiceRoleKey: z.string().min(1),
    }).parse(parsed);
  }

  if (parsed.authMode === "test") {
    const errors: string[] = [];

    if (env.APP_CONFIG_MODE !== "local") {
      errors.push("APP_CONFIG_MODE=local must be set explicitly");
    }

    if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
      errors.push("NODE_ENV must not be production");
    }

    if (parsed.appConfigMode !== "local") {
      errors.push("app config mode must be local");
    }

    if (errors.length > 0) {
      throw new Error(
        `API_AUTH_MODE=test is allowed only in local development: ${errors.join(", ")}`,
      );
    }
  }

  if (parsed.storageProvider === "local" && parsed.appConfigMode !== "local") {
    throw new Error(
      "STORAGE_PROVIDER=local is allowed only when APP_CONFIG_MODE=local",
    );
  }

  if (parsed.storageProvider !== "local") {
    throw new Error(
      `STORAGE_PROVIDER=${parsed.storageProvider} is not implemented yet for Step 8`,
    );
  }

  return parsed;
}
