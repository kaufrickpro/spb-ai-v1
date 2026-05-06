import { describe, expect, it } from "vitest";
import { protos } from "@google-cloud/tasks";
import { createCloudTasksDocumentProcessingEnqueue } from "./documentProcessingQueue.js";

describe("createCloudTasksDocumentProcessingEnqueue", () => {
  it("enqueues job id only with Cloud Run OIDC service account auth", async () => {
    const createdTasks: unknown[] = [];
    const enqueue = createCloudTasksDocumentProcessingEnqueue(
      {
        aiServiceBaseUrl: "https://spb-ai-service.example.run.app",
        cloudTasksIngestionQueue: "document-processing-staging",
        cloudTasksServiceAccountEmail:
          "spb-cloud-tasks-staging@spb-ai.iam.gserviceaccount.com",
        googleCloudProject: "spb-ai",
        googleCloudRegion: "europe-west3",
      },
      {
        createTask: async (request) => {
          createdTasks.push(request);
          return [] as never;
        },
        queuePath: (project, location, queue) =>
          `projects/${project}/locations/${location}/queues/${queue}`,
      },
    );

    await enqueue({ jobId: "00000000-0000-4000-8000-000000000123" });

    expect(createdTasks).toEqual([
      {
        parent:
          "projects/spb-ai/locations/europe-west3/queues/document-processing-staging",
        task: {
          httpRequest: {
            body: Buffer.from(
              JSON.stringify({
                job_id: "00000000-0000-4000-8000-000000000123",
              }),
            ).toString("base64"),
            headers: {
              "content-type": "application/json",
            },
            httpMethod: protos.google.cloud.tasks.v2.HttpMethod.POST,
            oidcToken: {
              audience: "https://spb-ai-service.example.run.app",
              serviceAccountEmail:
                "spb-cloud-tasks-staging@spb-ai.iam.gserviceaccount.com",
            },
            url: "https://spb-ai-service.example.run.app/internal/ingestion/run",
          },
          name: "projects/spb-ai/locations/europe-west3/queues/document-processing-staging/tasks/document-processing-00000000-0000-4000-8000-000000000123",
        },
      },
    ]);
  });

  it("treats an existing deterministic task as idempotent", async () => {
    const enqueue = createCloudTasksDocumentProcessingEnqueue(
      {
        aiServiceBaseUrl: "https://spb-ai-service.example.run.app",
        cloudTasksIngestionQueue: "document-processing-staging",
        cloudTasksServiceAccountEmail:
          "spb-cloud-tasks-staging@spb-ai.iam.gserviceaccount.com",
        googleCloudProject: "spb-ai",
        googleCloudRegion: "europe-west3",
      },
      {
        createTask: async () => {
          throw { code: 6 };
        },
        queuePath: (project, location, queue) =>
          `projects/${project}/locations/${location}/queues/${queue}`,
      },
    );

    await expect(
      enqueue({ jobId: "00000000-0000-4000-8000-000000000123" }),
    ).resolves.toBeUndefined();
  });
});
