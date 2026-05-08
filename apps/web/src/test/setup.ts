import { beforeEach } from "vitest";

function setTestWebConfig() {
  import.meta.env.VITE_API_BASE_URL = "http://localhost:4000";
  import.meta.env.VITE_SUPABASE_URL = "http://127.0.0.1:54321";
  import.meta.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
  import.meta.env.VITE_PUBLIC_SENTRY_DSN = "";
  import.meta.env.VITE_SENTRY_ENVIRONMENT = "local";
  import.meta.env.VITE_SENTRY_RELEASE = "";
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE = "0";
}

setTestWebConfig();

beforeEach(setTestWebConfig);
