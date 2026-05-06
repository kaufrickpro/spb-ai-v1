import { CloudTasksClient, protos } from "@google-cloud/tasks";
import type { ApiConfig } from "../config/config.js";

export type DocumentProcessingEnqueue = (input: {
  jobId: string;
}) => Promise<void>;

type CloudTasksClientLike = Pick<CloudTasksClient, "createTask" | "queuePath">;

export function createDocumentProcessingEnqueue(
  config: ApiConfig,
): DocumentProcessingEnqueue | null {
  if (config.documentProcessingProvider !== "cloud_tasks") {
    return null;
  }

  return createCloudTasksDocumentProcessingEnqueue(config);
}

export function createCloudTasksDocumentProcessingEnqueue(
  config: Pick<
    ApiConfig,
    | "aiServiceBaseUrl"
    | "cloudTasksIngestionQueue"
    | "cloudTasksServiceAccountEmail"
    | "googleCloudProject"
    | "googleCloudRegion"
  >,
  client: CloudTasksClientLike = new CloudTasksClient(),
): DocumentProcessingEnqueue {
  const parent = client.queuePath(
    config.googleCloudProject!,
    config.googleCloudRegion!,
    config.cloudTasksIngestionQueue!,
  );
  const url = new URL(
    "/internal/ingestion/run",
    config.aiServiceBaseUrl!,
  ).toString();

  return async ({ jobId }) => {
    const body = Buffer.from(JSON.stringify({ job_id: jobId })).toString(
      "base64",
    );
    const task: protos.google.cloud.tasks.v2.ITask = {
      httpRequest: {
        body,
        headers: {
          "content-type": "application/json",
        },
        httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
        oidcToken: {
          audience: config.aiServiceBaseUrl!,
          serviceAccountEmail: config.cloudTasksServiceAccountEmail!,
        },
        url,
      },
      name: `${parent}/tasks/document-processing-${jobId}`,
    };

    try {
      await client.createTask({ parent, task });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return;
      }
      throw error;
    }
  };
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 6
  );
}
