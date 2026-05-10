import type { FastifyInstance } from "fastify";
import { ResendWebhookResponseSchema } from "@marketplace/contracts";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import type { ApiConfig } from "../config/config.js";
import type { EmailTestState } from "./testState.js";
import { verifyResendWebhookSignature } from "./resend.js";

type RegisterEmailWebhookRoutesOptions = {
  config: ApiConfig;
  emailTestState: EmailTestState;
};

const VISIBLE_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
]);

export function registerEmailWebhookRoutes(
  app: FastifyInstance,
  options: RegisterEmailWebhookRoutesOptions,
) {
  app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_request, body, done) => {
        done(null, typeof body === "string" ? body : body.toString("utf8"));
      },
    );

    webhookApp.post("/api/v1/webhooks/resend", async (request, reply) => {
      const payload =
        typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body ?? {});
      if (
        options.config.emailProviderMode === "resend" &&
        !verifyResendWebhookSignature({
          payload,
          secret: options.config.resendWebhookSecret!,
          signature: readHeader(request.headers["svix-signature"]),
          timestamp: readHeader(request.headers["svix-timestamp"]),
          webhookId: readHeader(request.headers["svix-id"]),
        })
      ) {
        return reply.code(400).send({ error: { code: "invalid_signature" } });
      }

      const event = parseWebhookPayload(payload);
      if (event && VISIBLE_EVENTS.has(event.type)) {
        await recordDeliveryEvent(options, event);
      }
      return reply.send(ResendWebhookResponseSchema.parse({ received: true }));
    });
  });
}

function parseWebhookPayload(payload: string): {
  createdAt: string;
  data: Record<string, unknown>;
  id: string;
  type: string;
} | null {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (typeof parsed.id !== "string" || typeof parsed.type !== "string") {
      return null;
    }
    return {
      createdAt:
        typeof parsed.created_at === "string"
          ? parsed.created_at
          : new Date().toISOString(),
      data:
        parsed.data && typeof parsed.data === "object"
          ? (parsed.data as Record<string, unknown>)
          : {},
      id: parsed.id,
      type: parsed.type,
    };
  } catch {
    return null;
  }
}

async function recordDeliveryEvent(
  options: RegisterEmailWebhookRoutesOptions,
  event: {
    createdAt: string;
    data: Record<string, unknown>;
    id: string;
    type: string;
  },
) {
  const messageId =
    pickString(event.data.email_id) ?? pickString(event.data.id);
  const status = mapEventToStatus(event.type);
  if (options.config.authMode === "test") {
    if (
      options.emailTestState.deliveryEvents.some(
        (item) => item.providerEventId === event.id,
      )
    ) {
      return;
    }
    const outbox = messageId
      ? options.emailTestState.outbox.find(
          (item) => item.providerMessageId === messageId,
        )
      : null;
    if (outbox && status) {
      outbox.status = status;
      outbox.updatedAt = new Date().toISOString();
    }
    options.emailTestState.deliveryEvents.push({
      createdAt: new Date().toISOString(),
      emailOutboxId: outbox?.id ?? null,
      eventType: event.type,
      id: event.id,
      metadata: messageId ? { provider_message_id: messageId } : {},
      occurredAt: event.createdAt,
      provider: "resend",
      providerEventId: event.id,
      providerMessageId: messageId,
      signatureVerified: options.config.emailProviderMode === "resend",
    });
    return;
  }

  const db = createServiceRoleSupabaseClient(
    options.config.supabaseUrl!,
    options.config.supabaseServiceRoleKey!,
  );
  const { data: outbox } = messageId
    ? await db
        .from("email_outbox")
        .select("id")
        .eq("provider_message_id", messageId)
        .maybeSingle()
    : { data: null };
  const { error: eventError } = await db.from("email_delivery_events").upsert(
    {
      email_outbox_id: outbox?.id ?? null,
      event_type: event.type,
      metadata: messageId ? { provider_message_id: messageId } : {},
      occurred_at: event.createdAt,
      provider: "resend",
      provider_event_id: event.id,
      provider_message_id: messageId,
      signature_verified: true,
    },
    { onConflict: "provider,provider_event_id" },
  );
  if (eventError) {
    throw eventError;
  }
  if (outbox?.id && status) {
    const { error: updateError } = await db
      .from("email_outbox")
      .update({ status })
      .eq("id", outbox.id);
    if (updateError) {
      throw updateError;
    }
  }
}

function mapEventToStatus(type: string) {
  if (type === "email.delivered") return "delivered";
  if (type === "email.bounced") return "bounced";
  if (type === "email.complained") return "complained";
  if (type === "email.failed") return "failed_retryable";
  if (type === "email.sent") return "sent";
  return null;
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
