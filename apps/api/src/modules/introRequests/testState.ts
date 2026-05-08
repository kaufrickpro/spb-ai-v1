import { randomUUID } from "node:crypto";
import {
  type IntroRequest,
  type ProductAuditEvent,
  IntroRequestSchema,
} from "@marketplace/contracts";

export type IntroNotification = {
  id: string;
  recipientProfileId: string;
  actorProfileId: string | null;
  notificationType: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type IntroRequestTestState = {
  requests: IntroRequest[];
  notifications: IntroNotification[];
  productAuditEvents: ProductAuditEvent[];
};

export function createIntroRequestTestState(): IntroRequestTestState {
  return {
    requests: [],
    notifications: [],
    productAuditEvents: [],
  };
}

export function pushIntroNotification(
  state: IntroRequestTestState,
  input: Omit<IntroNotification, "id" | "createdAt">,
) {
  state.notifications.unshift({
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

export function pushProductAuditEvent(
  state: IntroRequestTestState,
  input: Omit<ProductAuditEvent, "id" | "createdAt">,
) {
  state.productAuditEvents.unshift({
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

export function parseIntroRequest(input: unknown): IntroRequest {
  return IntroRequestSchema.parse(input);
}
