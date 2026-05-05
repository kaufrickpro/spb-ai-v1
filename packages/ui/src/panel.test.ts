import { describe, expect, it } from "vitest";
import { buildPanelClassName } from "./panel";

describe("buildPanelClassName", () => {
  it("builds a stable scaffold class name", () => {
    expect(buildPanelClassName("workspace-panel")).toBe(
      "workspace-panel panel--scaffold",
    );
  });
});
