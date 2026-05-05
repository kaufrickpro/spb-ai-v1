import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const SEPARATOR = "~";

function legacyForgeToken(parts: string[]): string {
  const payload = parts.join(SEPARATOR);
  const signature = createHash("sha256")
    .update("local-dev-secret" + ":" + payload)
    .digest("hex")
    .slice(0, 32);
  return Buffer.from(payload + SEPARATOR + signature).toString("base64url");
}

function tamperToken(token: string, find: string, replace: string): string {
  const decoded = Buffer.from(token, "base64url").toString("utf8");
  return Buffer.from(decoded.replace(find, replace)).toString("base64url");
}

describe("local signed URL tokens", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("rejects upload tokens forged with the old hardcoded local fallback secret", async () => {
    vi.stubEnv("LOCAL_UPLOAD_SECRET", undefined);
    vi.resetModules();
    const { verifyLocalUploadToken } = await import("./localTokens.js");
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const forgedToken = legacyForgeToken([
      "upload",
      "document-1",
      "upload-1",
      "author-1",
      expiresAt,
    ]);

    expect(verifyLocalUploadToken(forgedToken)).toBeNull();
  });

  it("rejects upload tokens after signed payload tampering", async () => {
    const { createLocalUploadToken, verifyLocalUploadToken } =
      await import("./localTokens.js");
    const { token } = createLocalUploadToken(
      "document-1",
      "upload-1",
      "author-1",
    );

    const tamperedToken = tamperToken(token, "author-1", "author-2");

    expect(verifyLocalUploadToken(tamperedToken)).toBeNull();
  });

  it("rejects download tokens after signed payload tampering", async () => {
    const { createLocalDownloadToken, verifyLocalDownloadToken } =
      await import("./localTokens.js");
    const { token } = createLocalDownloadToken("document-1", "author-1");

    const tamperedToken = tamperToken(token, "author", "admin");

    expect(verifyLocalDownloadToken(tamperedToken)).toBeNull();
  });
});
