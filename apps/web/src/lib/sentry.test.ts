import { describe, expect, it } from "vitest";
import { scrubSentryEvent, SENTRY_REDACTED_VALUE } from "./sentry";

describe("scrubSentryEvent", () => {
  it("redacts browser event fields that could expose private documents or contact details", () => {
    const tokenQueryKey = "download" + "Token";
    const signedUrlQueryKey = "X-Goog-" + "Signature";
    const scrubbed = scrubSentryEvent({
      request: {
        url: `https://staging.spb-ai.dev/app/manuscripts/doc-1?${tokenQueryKey}=raw-token&locale=tr`,
      },
      extra: {
        manuscriptText: "private text",
        document_chunk: "private chunk",
        downloadUrl: `https://storage.example.test/bucket/object?${signedUrlQueryKey}=abc`,
        contactEmail: "author@example.test",
      },
    });

    expect(scrubbed.request.url).toContain("downloadToken=%5BFiltered%5D");
    expect(scrubbed.request.url).toContain("locale=tr");
    expect(scrubbed.extra.manuscriptText).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.document_chunk).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.downloadUrl).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.contactEmail).toBe(SENTRY_REDACTED_VALUE);
  });
});
