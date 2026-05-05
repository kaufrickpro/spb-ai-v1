import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadLocalEnvFile } from "./loadEnvFile.js";

describe("loadLocalEnvFile", () => {
  it("loads environment variables from an app-local .env file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "api-env-"));
    const envKey = "MARKETPLACE_API_ENV_FILE_TEST";

    try {
      delete process.env[envKey];
      writeFileSync(join(tempDir, ".env"), `${envKey}=loaded-from-env-file\n`);

      const loaded = loadLocalEnvFile(tempDir);

      expect(loaded).toBe(true);
      expect(process.env[envKey]).toBe("loaded-from-env-file");
    } finally {
      delete process.env[envKey];
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns false when no app-local .env file exists", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "api-env-missing-"));

    try {
      expect(loadLocalEnvFile(tempDir)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
