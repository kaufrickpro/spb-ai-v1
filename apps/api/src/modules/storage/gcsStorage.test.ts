import { describe, expect, it, vi } from "vitest";
import {
  buildGcsObjectName,
  createGcsSignedDownloadUrl,
  createGcsSignedUploadUrl,
  hasGcsUpload,
} from "./gcsStorage.js";

describe("gcsStorage", () => {
  it("builds storage object names without leaking bucket privileges", () => {
    expect(
      buildGcsObjectName({
        documentId: "doc-1",
        fileName: "../Örnek Draft!.txt",
        uploadId: "upload-1",
      }),
    ).toBe("doc-1/upload-1-rnek-Draft-.txt");
  });

  it("creates signed upload and download URLs for the private bucket object", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T10:00:00.000Z"));

    const signedUrlCalls: unknown[] = [];
    const fakeStorage = {
      bucket: (bucketName: string) => ({
        file: (objectName: string) => ({
          getSignedUrl: async (options: unknown) => {
            signedUrlCalls.push({ bucketName, objectName, options });
            return [`https://storage.example/${objectName}`];
          },
        }),
      }),
    };

    await expect(
      createGcsSignedUploadUrl(
        { gcsBucketPrivateUploads: "spb-ai-staging-manuscripts" },
        {
          contentType: "text/plain",
          documentId: "doc-1",
          fileName: "Sample.txt",
          uploadId: "upload-1",
        },
        fakeStorage,
      ),
    ).resolves.toEqual({
      expiresAt: "2026-05-06T10:15:00.000Z",
      uploadUrl: "https://storage.example/doc-1/upload-1-Sample.txt",
    });

    await expect(
      createGcsSignedDownloadUrl(
        { gcsBucketPrivateUploads: "spb-ai-staging-manuscripts" },
        {
          documentId: "doc-1",
          fileName: "Sample.txt",
          uploadId: "upload-1",
        },
        fakeStorage,
      ),
    ).resolves.toEqual({
      downloadUrl: "https://storage.example/doc-1/upload-1-Sample.txt",
      expiresAt: "2026-05-06T10:15:00.000Z",
    });

    expect(signedUrlCalls).toEqual([
      {
        bucketName: "spb-ai-staging-manuscripts",
        objectName: "doc-1/upload-1-Sample.txt",
        options: {
          action: "write",
          contentType: "text/plain",
          expires: new Date("2026-05-06T10:15:00.000Z"),
          version: "v4",
        },
      },
      {
        bucketName: "spb-ai-staging-manuscripts",
        objectName: "doc-1/upload-1-Sample.txt",
        options: {
          action: "read",
          expires: new Date("2026-05-06T10:15:00.000Z"),
          version: "v4",
        },
      },
    ]);

    vi.useRealTimers();
  });

  it("checks private object existence server-side", async () => {
    const fakeStorage = {
      bucket: () => ({
        file: () => ({
          exists: async () => [true],
        }),
      }),
    };

    await expect(
      hasGcsUpload(
        { gcsBucketPrivateUploads: "spb-ai-staging-manuscripts" },
        {
          documentId: "doc-1",
          fileName: "Sample.txt",
          uploadId: "upload-1",
        },
        fakeStorage,
      ),
    ).resolves.toBe(true);
  });
});
