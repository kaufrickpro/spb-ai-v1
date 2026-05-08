import { afterEach, describe, expect, it, vi } from "vitest";
import { runAiMatching } from "./aiClient.js";

describe("runAiMatching", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only the match run id to the AI service", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "succeeded",
          candidate_count: 3,
          failure_code: null,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await runAiMatching({
      config: {
        aiInternalToken: "internal-token",
        aiServiceBaseUrl: "https://ai.internal",
      },
      matchRunId: "11111111-1111-4111-8111-111111111111",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({
      match_run_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("returns a failed result for AI service timeouts", async () => {
    const timeoutError = new Error("timed out");
    timeoutError.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));

    await expect(
      runAiMatching({
        config: { aiServiceBaseUrl: "https://ai.internal" },
        matchRunId: "11111111-1111-4111-8111-111111111111",
      }),
    ).resolves.toEqual({
      status: "failed",
      candidate_count: 0,
      failure_code: "ai_service_timeout",
    });
  });
});
