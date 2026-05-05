import { describe, expect, it } from "vitest";
import { mapDbProfile } from "./mappers.js";

describe("mapDbProfile", () => {
  it("normalizes Supabase timestamptz strings to API ISO datetimes", () => {
    const profile = mapDbProfile({
      id: "00000000-0000-4000-8000-000000000010",
      user_id: "00000000-0000-4000-8000-000000000011",
      role: "author",
      display_name: "Test User",
      profile_photo_url: null,
      signup_intent: "find_publisher",
      approval_status: "pending",
      eligibility_status: "eligible",
      review_outcome: "auto_approved",
      locale: "tr",
      created_at: "2026-05-04T14:00:00.123456+00:00",
      updated_at: "2026-05-04T14:15:30+00:00",
    });

    expect(profile.createdAt).toBe("2026-05-04T14:00:00.123Z");
    expect(profile.updatedAt).toBe("2026-05-04T14:15:30.000Z");
    expect(profile.eligibilityStatus).toBe("eligible");
    expect(profile.reviewOutcome).toBe("auto_approved");
  });
});
