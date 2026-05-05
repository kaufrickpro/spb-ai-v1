import { describe, expect, it } from "vitest";
import { buildReviewRelatedEvents } from "./routeSupport.js";

describe("admin route support", () => {
  it("normalizes Postgres timestamps in review detail related events", () => {
    const events = buildReviewRelatedEvents({
      entity_type: "manuscript",
      status: "pending",
      submitted_at: "2026-05-04T14:28:55.992262+00:00",
    });

    expect(events).toEqual([
      {
        label: "Metadata submitted",
        createdAt: "2026-05-04T14:28:55.992Z",
      },
    ]);
  });
});
