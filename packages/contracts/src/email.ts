import { z } from "zod";

export const ResendWebhookResponseSchema = z.object({
  received: z.literal(true),
});
