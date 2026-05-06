import type { ApiConfig } from "../config/config.js";
import {
  AiIngestionResultSchema,
  type DocumentProcessingDispatch,
} from "./documentProcessingTypes.js";

export function createAiServiceDocumentProcessingDispatch(
  config: Pick<ApiConfig, "aiInternalToken" | "aiServiceBaseUrl">,
): DocumentProcessingDispatch {
  if (!config.aiServiceBaseUrl) {
    throw new Error(
      "AI_SERVICE_BASE_URL is required to run document processing",
    );
  }

  return async ({ jobId }) => {
    const timeoutMs = 5 * 60 * 1000;
    const response = await fetch(
      new URL("/internal/ingestion/run", config.aiServiceBaseUrl),
      {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "content-type": "application/json",
          ...(config.aiInternalToken
            ? { authorization: `Bearer ${config.aiInternalToken}` }
            : {}),
        },
        body: JSON.stringify({ job_id: jobId }),
      },
    );

    if (!response.ok) {
      return {
        status: "failed",
        failure_code: "unexpected_processing_error",
        metadata: {
          failure_code: "unexpected_processing_error",
          failure_category: "system",
          worker_status_code: response.status,
        },
      };
    }

    return AiIngestionResultSchema.parse(await response.json());
  };
}
