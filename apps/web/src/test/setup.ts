import { beforeEach } from "vitest";

function setTestWebConfig() {
  import.meta.env.VITE_API_BASE_URL = "http://localhost:4000";
  import.meta.env.VITE_SUPABASE_URL = "http://127.0.0.1:54321";
  import.meta.env.VITE_SUPABASE_ANON_KEY = "test-anon-key";
}

setTestWebConfig();

beforeEach(setTestWebConfig);
