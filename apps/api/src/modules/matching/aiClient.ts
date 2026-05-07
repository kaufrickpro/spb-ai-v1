import { z } from "zod";
import type { ApiConfig } from "../config/config.js";

const AiMatchingRunResultSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  candidate_count: z.number().int().nonnegative().max(25),
  failure_code: z.string().max(80).nullable().optional(),
});

export type AiMatchingRunResult = z.infer<typeof AiMatchingRunResultSchema>;

export async function runAiMatching(input: {
  config: Pick<ApiConfig, "aiInternalToken" | "aiServiceBaseUrl">;
  matchRunId: string;
}): Promise<AiMatchingRunResult> {
  if (!input.config.aiServiceBaseUrl) {
    throw new Error("AI_SERVICE_BASE_URL is required to run matching");
  }

  const response = await fetch(
    new URL("/internal/matching/run", input.config.aiServiceBaseUrl),
    {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: {
        "content-type": "application/json",
        ...(input.config.aiInternalToken
          ? { authorization: `Bearer ${input.config.aiInternalToken}` }
          : {}),
      },
      body: JSON.stringify({ match_run_id: input.matchRunId }),
    },
  );

  if (!response.ok) {
    return {
      status: "failed",
      candidate_count: 0,
      failure_code: "ai_service_failed",
    };
  }

  return AiMatchingRunResultSchema.parse(await response.json());
}
