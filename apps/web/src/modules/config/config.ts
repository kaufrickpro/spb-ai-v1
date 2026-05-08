import { z } from "zod";

const optionalNonEmptyString = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(1).optional(),
  );

const WebConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  sentryDsn: optionalNonEmptyString(),
  sentryEnvironment: z.string().min(1),
  sentryRelease: optionalNonEmptyString(),
  sentryTracesSampleRate: z.coerce.number().min(0).max(1),
});

export type WebConfig = z.infer<typeof WebConfigSchema>;

export function getWebConfig(): WebConfig {
  return WebConfigSchema.parse({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000",
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    sentryDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
    sentryEnvironment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "local",
    sentryRelease: import.meta.env.VITE_SENTRY_RELEASE,
    sentryTracesSampleRate:
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ??
      (import.meta.env.MODE === "production" ? "0.1" : "0"),
  });
}
