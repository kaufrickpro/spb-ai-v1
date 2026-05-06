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
    expect(config.documentProcessingProvider).toBe("local");
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

  it("rejects fake scanner mode in deployed config without a launch decision", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "supabase",
        APP_CONFIG_MODE: "staging",
        CLOUD_TASKS_INGESTION_QUEUE: "document-processing-staging",
        CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
          "spb-cloud-tasks-staging@example.iam.gserviceaccount.com",
        DOCUMENT_PROCESSING_PROVIDER: "cloud_tasks",
        NODE_ENV: "development",
        AI_SERVICE_BASE_URL: "https://spb-ai-service.example.run.app",
        GCS_BUCKET_PRIVATE_UPLOADS: "spb-ai-staging-manuscripts",
        GOOGLE_CLOUD_PROJECT: "spb-ai",
        GOOGLE_CLOUD_REGION: "europe-west3",
        STORAGE_PROVIDER: "gcs",
        WEB_APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        DOCUMENT_SCANNER_MODE: "local_fake",
      }),
    ).toThrow(/DOCUMENT_SCANNER_LAUNCH_DECISION_ID/);
  });

  it("requires a provider name for real scanner mode in deployed config", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "supabase",
        APP_CONFIG_MODE: "staging",
        CLOUD_TASKS_INGESTION_QUEUE: "document-processing-staging",
        CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
          "spb-cloud-tasks-staging@example.iam.gserviceaccount.com",
        DOCUMENT_PROCESSING_PROVIDER: "cloud_tasks",
        NODE_ENV: "development",
        AI_SERVICE_BASE_URL: "https://spb-ai-service.example.run.app",
        GCS_BUCKET_PRIVATE_UPLOADS: "spb-ai-staging-manuscripts",
        GOOGLE_CLOUD_PROJECT: "spb-ai",
        GOOGLE_CLOUD_REGION: "europe-west3",
        STORAGE_PROVIDER: "gcs",
        WEB_APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        DOCUMENT_SCANNER_MODE: "real",
      }),
    ).toThrow(/DOCUMENT_SCANNER_PROVIDER/);
  });

  it("accepts explicit deployed Cloud Tasks and GCS config", () => {
    const config = loadConfig(deployedConfigEnv());

    expect(config.appConfigMode).toBe("staging");
    expect(config.storageProvider).toBe("gcs");
    expect(config.documentProcessingProvider).toBe("cloud_tasks");
    expect(config.gcsBucketPrivateUploads).toBe("spb-ai-staging-manuscripts");
    expect(config.cloudTasksIngestionQueue).toBe("document-processing-staging");
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
        DOCUMENT_SCANNER_LAUNCH_DECISION_ID:
          "ADR-STEP9-SCANNER-LAUNCH-DECISION",
      }),
    ).toThrow(/STORAGE_PROVIDER=local is allowed only/);
  });

  it("rejects local document processing outside local app config mode", () => {
    expect(() =>
      loadConfig({
        API_AUTH_MODE: "supabase",
        APP_CONFIG_MODE: "staging",
        DOCUMENT_PROCESSING_PROVIDER: "local",
        NODE_ENV: "development",
        STORAGE_PROVIDER: "gcs",
        WEB_APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        DOCUMENT_SCANNER_MODE: "real",
        DOCUMENT_SCANNER_PROVIDER: "gcs-malware-scanner",
      }),
    ).toThrow(/DOCUMENT_PROCESSING_PROVIDER=local is allowed only/);
  });

  it("requires Cloud Tasks settings when Cloud Tasks processing is selected", () => {
    expect(() =>
      loadConfig({
        ...deployedConfigEnv(),
        CLOUD_TASKS_INGESTION_QUEUE: undefined,
      }),
    ).toThrow();
  });
});

function deployedConfigEnv(): NodeJS.ProcessEnv {
  return {
    AI_SERVICE_BASE_URL: "https://spb-ai-service.example.run.app",
    API_AUTH_MODE: "supabase",
    APP_CONFIG_MODE: "staging",
    CLOUD_TASKS_INGESTION_QUEUE: "document-processing-staging",
    CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL:
      "spb-cloud-tasks-staging@example.iam.gserviceaccount.com",
    DOCUMENT_PROCESSING_PROVIDER: "cloud_tasks",
    DOCUMENT_SCANNER_MODE: "real",
    DOCUMENT_SCANNER_PROVIDER: "gcs-malware-scanner",
    GCS_BUCKET_PRIVATE_UPLOADS: "spb-ai-staging-manuscripts",
    GOOGLE_CLOUD_PROJECT: "spb-ai",
    GOOGLE_CLOUD_REGION: "europe-west3",
    NODE_ENV: "development",
    STORAGE_PROVIDER: "gcs",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_URL: "https://example.supabase.co",
    WEB_APP_URL: "https://example.com",
  };
}
