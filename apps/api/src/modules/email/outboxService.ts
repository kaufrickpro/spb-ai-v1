import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiConfig } from "../config/config.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import {
  enqueueTestEmail,
  type EmailOutboxRow,
  type EmailTestState,
} from "./testState.js";
import { renderEmailTemplate, type EmailTemplateKey } from "./templates.js";
import {
  createFixtureEmailAdapter,
  createResendEmailAdapter,
  type EmailAdapter,
} from "./resend.js";

type EnqueueInput = {
  ctaPath: string;
  idempotencyKey: string;
  locale?: "tr" | "en";
  recipientProfileId: string;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  targetLabel: string;
  templateKey: EmailTemplateKey;
  actorLabel?: string | null;
  planLabel?: string | null;
};

export async function enqueueProductEmail(input: {
  config: ApiConfig;
  emailTestState: EmailTestState;
  email: EnqueueInput;
}) {
  if (input.config.authMode === "test") {
    return enqueueTestEmail(input.emailTestState, {
      idempotencyKey: input.email.idempotencyKey,
      locale: input.email.locale ?? "tr",
      provider: "local_fake",
      recipientEmail:
        input.email.recipientEmail ??
        `${input.email.recipientProfileId}@example.test`,
      recipientProfileId: input.email.recipientProfileId,
      recipientUserId: input.email.recipientUserId ?? null,
      templateData: buildSafeTemplateData(input.email),
      templateKey: input.email.templateKey,
    });
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { error } = await db.from("email_outbox").upsert(
    {
      idempotency_key: input.email.idempotencyKey,
      locale: input.email.locale ?? "tr",
      provider:
        input.config.emailProviderMode === "resend" ? "resend" : "local_fake",
      recipient_email: input.email.recipientEmail,
      recipient_profile_id: input.email.recipientProfileId,
      recipient_user_id: input.email.recipientUserId ?? null,
      template_data: buildSafeTemplateData(input.email),
      template_key: input.email.templateKey,
    },
    { onConflict: "idempotency_key" },
  );
  if (error) {
    throw error;
  }
}

export async function processEmailOutbox(input: {
  adapter?: EmailAdapter;
  config: ApiConfig;
  emailTestState?: EmailTestState;
  limit: number;
}) {
  if (input.config.authMode === "test") {
    return processTestOutbox(input);
  }

  const db = createServiceRoleSupabaseClient(
    input.config.supabaseUrl!,
    input.config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db.rpc("claim_email_outbox", {
    p_limit: input.limit,
  });
  if (error) throw error;

  let processed = 0;
  for (const row of (data ?? []) as DbOutboxRow[]) {
    await processDbEmail(db, input, row);
    processed += 1;
  }
  return { processed };
}

async function processTestOutbox(input: {
  adapter?: EmailAdapter;
  config: ApiConfig;
  emailTestState?: EmailTestState;
  limit: number;
}) {
  const state = input.emailTestState;
  if (!state) return { processed: 0 };
  const adapter = input.adapter ?? createFixtureEmailAdapter();
  const pending = state.outbox
    .filter((item) => ["pending", "failed_retryable"].includes(item.status))
    .slice(0, input.limit);
  for (const row of pending) {
    await processTestEmail(input.config, state, adapter, row);
  }
  return { processed: pending.length };
}

async function processTestEmail(
  config: ApiConfig,
  state: EmailTestState,
  adapter: EmailAdapter,
  row: EmailOutboxRow,
) {
  const now = new Date().toISOString();
  row.status = "sending";
  row.attemptCount += 1;
  row.updatedAt = now;
  try {
    const rendered = renderEmailTemplate({
      appUrl: config.webAppUrl,
      data: row.templateData,
      locale: row.locale,
      templateKey: row.templateKey as EmailTemplateKey,
    });
    const result = await adapter.send({
      ...rendered,
      recipientEmail: row.recipientEmail,
    });
    row.providerMessageId = result.providerMessageId;
    row.status = "sent";
    row.sentAt = new Date().toISOString();
    row.updatedAt = row.sentAt;
    state.sent.push({ outboxId: row.id, ...rendered });
  } catch (error) {
    row.status =
      row.attemptCount >= 3 ? "failed_permanent" : "failed_retryable";
    row.lastErrorCode = "send_failed";
    row.lastErrorMessage =
      error instanceof Error ? error.message.slice(0, 500) : "Send failed";
    row.nextAttemptAt = new Date(Date.now() + 5 * 60_000).toISOString();
    row.updatedAt = new Date().toISOString();
  }
}

async function processDbEmail(
  db: SupabaseClient,
  input: { adapter?: EmailAdapter; config: ApiConfig },
  row: DbOutboxRow,
) {
  const adapter =
    input.adapter ??
    (input.config.emailProviderMode === "resend"
      ? createResendEmailAdapter(input.config)
      : createFixtureEmailAdapter());
  try {
    const rendered = renderEmailTemplate({
      appUrl: input.config.webAppUrl,
      data: row.template_data,
      locale: row.locale === "en" ? "en" : "tr",
      templateKey: row.template_key as EmailTemplateKey,
    });
    const result = await adapter.send({
      ...rendered,
      recipientEmail: row.recipient_email,
    });
    const { error: sentError } = await db
      .from("email_outbox")
      .update({
        provider_message_id: result.providerMessageId,
        sent_at: new Date().toISOString(),
        status: "sent",
      })
      .eq("id", row.id);
    if (sentError) {
      throw sentError;
    }
  } catch (error) {
    const { error: failureError } = await db
      .from("email_outbox")
      .update({
        last_error_code: "send_failed",
        last_error_message:
          error instanceof Error ? error.message.slice(0, 500) : "Send failed",
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        status:
          Number(row.attempt_count ?? 0) + 1 >= 3
            ? "failed_permanent"
            : "failed_retryable",
      })
      .eq("id", row.id);
    if (failureError) {
      throw failureError;
    }
  }
}

function buildSafeTemplateData(input: EnqueueInput): Record<string, string> {
  return {
    actorLabel: (input.actorLabel ?? "").slice(0, 160),
    ctaPath: input.ctaPath.slice(0, 300),
    planLabel: (input.planLabel ?? "").slice(0, 80),
    targetLabel: input.targetLabel.slice(0, 160),
  };
}

type DbOutboxRow = {
  id: string;
  attempt_count: number;
  locale: string;
  recipient_email: string;
  template_data: Record<string, unknown>;
  template_key: string;
};
