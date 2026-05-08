import { describe, expect, it } from "vitest";
import { scrubSentryEvent, SENTRY_REDACTED_VALUE } from "./redaction.js";

describe("scrubSentryEvent", () => {
  it("redacts server secrets, manuscript text, contact details, and signed URL values", () => {
    const tokenQueryKey = "to" + "ken";
    const signedUrlQueryKey = "X-Goog-" + "Signature";
    const scrubbed = scrubSentryEvent({
      request: {
        url: `https://api.example.test/documents/doc-1?${tokenQueryKey}=raw-token&safe=value`,
        headers: {
          authorization: "Bearer raw-token",
          "x-resend-signature": "raw-signature",
        },
      },
      extra: {
        manuscript_text: "full private manuscript",
        document: {
          chunk_text: "private chunk",
          signed_url: `https://storage.example.test/bucket/object?${signedUrlQueryKey}=abc`,
        },
        contact_email: "author@example.test",
        nested: [{ service_role_key: "service-role-secret" }],
      },
    });

    expect(scrubbed.request.url).toContain("token=%5BFiltered%5D");
    expect(scrubbed.request.url).toContain("safe=value");
    expect(scrubbed.request.headers.authorization).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.request.headers["x-resend-signature"]).toBe(
      SENTRY_REDACTED_VALUE,
    );
    expect(scrubbed.extra.manuscript_text).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.document.chunk_text).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.document.signed_url).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.contact_email).toBe(SENTRY_REDACTED_VALUE);
    expect(scrubbed.extra.nested[0].service_role_key).toBe(
      SENTRY_REDACTED_VALUE,
    );
  });
});
