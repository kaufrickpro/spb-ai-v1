import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("allows test auth mode only in explicit local config mode", () => {
    const config = loadConfig({
      API_AUTH_MODE: "test",
      APP_CONFIG_MODE: "local",
      NODE_ENV: "development",
    });

    expect(config.authMode).toBe("test");
    expect(config.appConfigMode).toBe("local");
    expect(config.storageProvider).toBe("local");
    expect(config.webAppUrl).toBe("http://localhost:5173");
  });

  it("rejects test auth mode when app config mode is not local", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "test",
        APP_CONFIG_MODE: "production",
        NODE_ENV: "production",
      }),
    ).toThrow(/API_AUTH_MODE=test is allowed only in local development/);
  });

  it("rejects test auth mode when app config mode is missing", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "test",
        NODE_ENV: "development",
      }),
    ).toThrow(/APP_CONFIG_MODE=local/);
  });

  it("rejects test auth mode in production node environments", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "test",
        APP_CONFIG_MODE: "local",
        NODE_ENV: "production",
      }),
    ).toThrow(/NODE_ENV must not be production/);
  });

  it("requires Supabase settings in supabase auth mode", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "supabase",
        APP_CONFIG_MODE: "staging",
        NODE_ENV: "production",
        WEB_APP_URL: "http://localhost:5173",
      }),
    ).toThrow();
  });

  it("rejects local storage outside local app config mode", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "supabase",
        APP_CONFIG_MODE: "staging",
        NODE_ENV: "development",
        STORAGE_PROVIDER: "local",
        WEB_APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toThrow(/STORAGE_PROVIDER=local is allowed only/);
  });

  it("fails fast for non-local storage providers until GCS is implemented", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "supabase",
        APP_CONFIG_MODE: "staging",
        NODE_ENV: "development",
        STORAGE_PROVIDER: "gcs",
        WEB_APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toThrow(/is not implemented yet for Step 8/);
  });
});
