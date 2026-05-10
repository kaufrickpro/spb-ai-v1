import type { FastifyReply } from "fastify";
import { AdminReviewDecisionRequestSchema } from "@marketplace/contracts";
import { sendValidationError } from "../../lib/http/errors.js";

export function parseLegacyProfileReviewDecision(
  input: {
    decision: "approved" | "rejected";
    internalNote?: string;
    rejectionNote?: string;
  },
  reply: Parameters<typeof sendValidationError>[0],
) {
  const parsed = AdminReviewDecisionRequestSchema.safeParse({
    decision: input.decision,
    internalNote: input.internalNote,
    rejectionNote: input.rejectionNote,
  });
  if (!parsed.success) {
    sendValidationError(
      reply,
      "Invalid admin profile decision",
      parsed.error.issues,
    );
    return null;
  }

  return parsed.data;
}

export function parsePublisherProfileId(
  params: unknown,
  reply: FastifyReply,
): string | null {
  const raw = (params as { publisherProfileId?: string }).publisherProfileId;
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) {
    sendValidationError(reply, "Invalid publisher profile id", []);
    return null;
  }

  return raw;
}
