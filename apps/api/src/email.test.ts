import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import {
  enqueueProductEmail,
  processEmailOutbox,
} from "./modules/email/outboxService.js";
import { createEmailTestState } from "./modules/email/testState.js";
import { renderEmailTemplate } from "./modules/email/templates.js";

const testConfig = {
  appConfigMode: "local" as const,
  authMode: "test" as const,
  documentProcessingProvider: "local" as const,
  documentScannerMode: "local_fake" as const,
  emailProviderMode: "local_fake" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  paytrProviderMode: "disabled" as const,
  paytrTokenUrl: "https://www.paytr.com/odeme/api/get-token",
  port: 4000,
  sentryEnvironment: "local",
  sentryTracesSampleRate: 0,
  storageProvider: "local" as const,
  webAppUrl: "http://localhost:5173",
};

describe("Step 14 product email", () => {
  it("enqueues idempotent intro emails and renders only safe template data", async () => {
    const emailState = createEmailTestState();
    const email = {
      actorLabel: "Publisher One",
      ctaPath: "/app/requests?box=received",
      idempotencyKey: "intro_request:req-1:intro_request_created:profile-1",
      recipientEmail: "author@example.com",
      recipientProfileId: "00000000-0000-4000-8000-000000000010",
      targetLabel: "Quiet Days",
      templateKey: "intro_request_created" as const,
    };

    await enqueueProductEmail({
      config: testConfig,
      email,
      emailTestState: emailState,
    });
    await enqueueProductEmail({
      config: testConfig,
      email,
      emailTestState: emailState,
    });

    expect(emailState.outbox).toHaveLength(1);
    expect(JSON.stringify(emailState.outbox[0].templateData)).not.toContain(
      "author@example.com",
    );
    const rendered = renderEmailTemplate({
      appUrl: testConfig.webAppUrl,
      data: emailState.outbox[0].templateData,
      locale: "en",
      templateKey: "intro_request_created",
    });
    expect(rendered.text).toContain("/app/requests?box=received");
    expect(rendered.text).not.toContain("signed_url");
    expect(rendered.text).not.toContain("token");
  });

  it("processes queued local emails without blocking product state on retryable failure", async () => {
    const emailState = createEmailTestState();
    await enqueueProductEmail({
      config: testConfig,
      email: {
        ctaPath: "/app/billing",
        idempotencyKey: "billing:payment-failed:1",
        recipientEmail: "user@example.com",
        recipientProfileId: "00000000-0000-4000-8000-000000000010",
        targetLabel: "Payment",
        templateKey: "payment_failed",
      },
      emailTestState: emailState,
    });

    const failed = await processEmailOutbox({
      adapter: {
        async send() {
          throw new Error("temporary provider failure");
        },
      },
      config: testConfig,
      emailTestState: emailState,
      limit: 10,
    });
    expect(failed.processed).toBe(1);
    expect(emailState.outbox[0].status).toBe("failed_retryable");

    const sent = await processEmailOutbox({
      config: testConfig,
      emailTestState: emailState,
      limit: 10,
    });
    expect(sent.processed).toBe(1);
    expect(emailState.outbox[0].status).toBe("sent");
  });

  it("denies invalid Resend webhook signatures and records delivery events idempotently", async () => {
    const emailState = createEmailTestState();
    const config = {
      ...testConfig,
      emailProviderMode: "resend" as const,
      resendApiKey: "re_test",
      resendFromAddress: "notifications@example.com",
      resendWebhookSecret: "whsec_dGVzdC1zZWNyZXQ=",
    };
    const app = buildApp({ config, testState: { email: emailState } });
    const payload = JSON.stringify({
      created_at: "2026-05-09T12:00:00.000Z",
      data: { email_id: "resend-msg-1" },
      id: "evt_1",
      type: "email.delivered",
    });

    const denied = await app.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload,
      url: "/api/v1/webhooks/resend",
    });
    expect(denied.statusCode).toBe(400);

    const headers = signPayload(payload, config.resendWebhookSecret);
    const accepted = await app.inject({
      headers,
      method: "POST",
      payload,
      url: "/api/v1/webhooks/resend",
    });
    const replay = await app.inject({
      headers,
      method: "POST",
      payload,
      url: "/api/v1/webhooks/resend",
    });

    expect(accepted.statusCode).toBe(200);
    expect(replay.statusCode).toBe(200);
    expect(emailState.deliveryEvents).toHaveLength(1);
  });
});

function signPayload(payload: string, secret: string) {
  const id = "msg_test";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = secret.slice("whsec_".length);
  const signature = createHmac("sha256", Buffer.from(key, "base64"))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return {
    "content-type": "application/json",
    "svix-id": id,
    "svix-signature": `v1,${signature}`,
    "svix-timestamp": timestamp,
  };
}
