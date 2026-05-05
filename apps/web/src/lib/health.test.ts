import { describe, expect, it } from "vitest";
import { fetchApiHealth, getWebHealthMessage } from "./health";

describe("getWebHealthMessage", () => {
  it("returns scaffold health text", () => {
    expect(getWebHealthMessage()).toBe("Publisher-Author Marketplace Web");
  });
});

describe("fetchApiHealth", () => {
  it("returns a validated health response", async () => {
    const response = await fetchApiHealth(async (input, init) => {
      expect(input).toBe("http://localhost:4000/health");
      expect(init.method).toBe("GET");

      return {
        ok: true,
        status: 200,
        json: async () => ({
          service: "api",
          status: "ok",
        }),
      };
    });

    expect(response).toEqual({
      service: "api",
      status: "ok",
    });
  });

  it("throws a validated API error payload", async () => {
    await expect(
      fetchApiHealth(async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          error: {
            code: "service_unavailable",
            message: "Down",
          },
        }),
      })),
    ).rejects.toEqual({
      error: {
        code: "service_unavailable",
        message: "Down",
      },
    });
  });
});
