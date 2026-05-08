import { z } from "zod";

const optionalNonEmptyString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(1).optional(),
  );

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
  documentProcessingProvider: z.enum(["local", "cloud_tasks"]),
  googleCloudProject: optionalNonEmptyString(),
  googleCloudRegion: optionalNonEmptyString(),
  gcsBucketPrivateUploads: optionalNonEmptyString(),
  cloudTasksIngestionQueue: optionalNonEmptyString(),
  cloudTasksServiceAccountEmail: optionalNonEmptyString(),
  webAppUrl: z.string().url(),
  sentryDsn: optionalNonEmptyString(),
  sentryEnvironment: z.string().min(1),
  sentryRelease: optionalNonEmptyString(),
  sentryTracesSampleRate: z.coerce.number().min(0).max(1),
  documentScannerMode: z.enum(["local_fake", "real"]),
  documentScannerProvider: optionalNonEmptyString(),
  documentScannerLaunchDecisionId: optionalNonEmptyString(),
  // Used to construct the JWKS endpoint: ${supabaseUrl}/auth/v1/.well-known/jwks.json
  // No JWT secret is needed — token verification uses the public key from JWKS.
  supabaseUrl: z.string().url().optional(),
  // Anon key used to create user-scoped Supabase clients (RLS enforced).
  supabaseAnonKey: z.string().min(1).optional(),
  // Service-role key used only by trusted server-side admin/bootstrap paths.
  supabaseServiceRoleKey: z.string().min(1).optional(),
  // Internal AI service endpoint used by local processors and production task workers.
  aiServiceBaseUrl: z.string().url().optional(),
  // Shared local/dev bearer token for trusted API -> AI service calls.
  aiInternalToken: z.string().min(1).optional(),
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
    documentProcessingProvider:
      env.DOCUMENT_PROCESSING_PROVIDER ??
      ((env.APP_CONFIG_MODE ?? "local") === "local" ? "local" : "cloud_tasks"),
    googleCloudProject: env.GOOGLE_CLOUD_PROJECT,
    googleCloudRegion: env.GOOGLE_CLOUD_REGION,
    gcsBucketPrivateUploads: env.GCS_BUCKET_PRIVATE_UPLOADS,
    cloudTasksIngestionQueue: env.CLOUD_TASKS_INGESTION_QUEUE,
    cloudTasksServiceAccountEmail: env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL,
    webAppUrl: env.WEB_APP_URL ?? "http://localhost:5173",
    sentryDsn: env.SENTRY_DSN,
    sentryEnvironment: env.SENTRY_ENVIRONMENT ?? env.APP_CONFIG_MODE ?? "local",
    sentryRelease: env.SENTRY_RELEASE,
    sentryTracesSampleRate:
      env.SENTRY_TRACES_SAMPLE_RATE ??
      ((env.APP_CONFIG_MODE ?? "local") === "local" ? "0" : "0.1"),
    documentScannerMode: env.DOCUMENT_SCANNER_MODE ?? "local_fake",
    documentScannerProvider: env.DOCUMENT_SCANNER_PROVIDER,
    documentScannerLaunchDecisionId: env.DOCUMENT_SCANNER_LAUNCH_DECISION_ID,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    aiServiceBaseUrl: env.AI_SERVICE_BASE_URL,
    aiInternalToken: env.AI_INTERNAL_TOKEN,
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

  if (parsed.appConfigMode !== "local") {
    if (
      parsed.documentScannerMode === "local_fake" &&
      !parsed.documentScannerLaunchDecisionId
    ) {
      throw new Error(
        "Staging/production cannot use DOCUMENT_SCANNER_MODE=local_fake without DOCUMENT_SCANNER_LAUNCH_DECISION_ID",
      );
    }

    if (
      parsed.documentScannerMode === "real" &&
      !parsed.documentScannerProvider
    ) {
      throw new Error(
        "DOCUMENT_SCANNER_PROVIDER is required when DOCUMENT_SCANNER_MODE=real",
      );
    }
  }

  if (parsed.storageProvider === "local" && parsed.appConfigMode !== "local") {
    throw new Error(
      "STORAGE_PROVIDER=local is allowed only when APP_CONFIG_MODE=local",
    );
  }

  if (
    parsed.documentProcessingProvider === "local" &&
    parsed.appConfigMode !== "local"
  ) {
    throw new Error(
      "DOCUMENT_PROCESSING_PROVIDER=local is allowed only when APP_CONFIG_MODE=local",
    );
  }

  if (parsed.storageProvider === "gcs") {
    z.object({
      gcsBucketPrivateUploads: z.string().min(1),
    }).parse(parsed);
  }

  if (parsed.documentProcessingProvider === "cloud_tasks") {
    z.object({
      aiServiceBaseUrl: z.string().url(),
      cloudTasksIngestionQueue: z.string().min(1),
      cloudTasksServiceAccountEmail: z.string().email(),
      googleCloudProject: z.string().min(1),
      googleCloudRegion: z.string().min(1),
    }).parse(parsed);
  }

  if (parsed.appConfigMode !== "local") {
    if (parsed.storageProvider !== "gcs") {
      throw new Error("Staging/production must use STORAGE_PROVIDER=gcs");
    }

    if (parsed.documentProcessingProvider !== "cloud_tasks") {
      throw new Error(
        "Staging/production must use DOCUMENT_PROCESSING_PROVIDER=cloud_tasks",
      );
    }
  }

  return parsed;
}
