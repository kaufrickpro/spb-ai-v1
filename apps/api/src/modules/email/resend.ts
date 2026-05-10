import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApiConfig } from "../config/config.js";
import type { RenderedEmail } from "./templates.js";

export type EmailAdapter = {
  send(input: {
    html: string;
    recipientEmail: string;
    subject: string;
    text: string;
  }): Promise<{ providerMessageId: string }>;
};

export function createFixtureEmailAdapter(): EmailAdapter {
  return {
    async send() {
      return { providerMessageId: `local_${Date.now()}` };
    },
  };
}

export function createResendEmailAdapter(config: ApiConfig): EmailAdapter {
  return {
    async send(input: RenderedEmail & { recipientEmail: string }) {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from: config.resendFromAddress!,
          html: input.html,
          subject: input.subject,
          text: input.text,
          to: input.recipientEmail,
        }),
        headers: {
          authorization: `Bearer ${config.resendApiKey}`,
          "content-type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!response.ok || !body.id) {
        throw new Error(body.message ?? "Resend email send failed");
      }
      return { providerMessageId: body.id };
    },
  };
}

export function verifyResendWebhookSignature(input: {
  payload: string;
  secret: string;
  signature: string | undefined;
  timestamp: string | undefined;
  webhookId: string | undefined;
}): boolean {
  if (!input.signature || !input.timestamp || !input.webhookId) return false;

  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageMilliseconds = Math.abs(Date.now() - timestampSeconds * 1000);
  if (ageMilliseconds > 5 * 60_000) return false;

  const signed = `${input.webhookId}.${input.timestamp}.${input.payload}`;
  const secret = input.secret.startsWith("whsec_")
    ? input.secret.slice("whsec_".length)
    : input.secret;
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(signed)
    .digest("base64");

  return input.signature
    .split(" ")
    .some((candidate) =>
      constantTimeEqual(candidate.replace(/^v1,/, ""), expected),
    );
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
