import { randomUUID } from "node:crypto";

export type EmailOutboxStatus =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed_retryable"
  | "failed_permanent"
  | "bounced"
  | "complained";

export type EmailOutboxRow = {
  id: string;
  idempotencyKey: string;
  recipientProfileId: string;
  recipientUserId: string | null;
  recipientEmail: string;
  templateKey: string;
  locale: "tr" | "en";
  templateData: Record<string, unknown>;
  status: EmailOutboxStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  provider: "local_fake" | "resend";
  providerMessageId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type EmailDeliveryEvent = {
  id: string;
  provider: "resend";
  providerEventId: string;
  providerMessageId: string | null;
  emailOutboxId: string | null;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
  signatureVerified: boolean;
  createdAt: string;
};

export type EmailTestState = {
  outbox: EmailOutboxRow[];
  deliveryEvents: EmailDeliveryEvent[];
  sent: Array<{
    outboxId: string;
    subject: string;
    html: string;
    text: string;
  }>;
};

export function createEmailTestState(): EmailTestState {
  return {
    deliveryEvents: [],
    outbox: [],
    sent: [],
  };
}

export function enqueueTestEmail(
  state: EmailTestState,
  input: Omit<
    EmailOutboxRow,
    | "attemptCount"
    | "createdAt"
    | "id"
    | "lastErrorCode"
    | "lastErrorMessage"
    | "nextAttemptAt"
    | "providerMessageId"
    | "sentAt"
    | "status"
    | "updatedAt"
  >,
): EmailOutboxRow {
  const existing = state.outbox.find(
    (item) => item.idempotencyKey === input.idempotencyKey,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const row: EmailOutboxRow = {
    ...input,
    attemptCount: 0,
    createdAt: now,
    id: randomUUID(),
    lastErrorCode: null,
    lastErrorMessage: null,
    nextAttemptAt: null,
    providerMessageId: null,
    sentAt: null,
    status: "pending",
    updatedAt: now,
  };
  state.outbox.unshift(row);
  return row;
}
