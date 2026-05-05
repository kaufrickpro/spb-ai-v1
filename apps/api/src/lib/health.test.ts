import { describe, expect, it } from "vitest";
import { buildHealthPayload } from "./health.js";

describe("buildHealthPayload", () => {
  it("returns the API health payload", () => {
    expect(buildHealthPayload()).toEqual({
      status: "ok",
      service: "api",
    });
  });
});
