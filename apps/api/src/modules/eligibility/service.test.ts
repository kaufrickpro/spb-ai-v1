import { describe, expect, it } from "vitest";
import {
  evaluateDocumentEligibility,
  evaluateProfileEligibility,
} from "./service.js";

describe("automated eligibility checks", () => {
  it("auto-approves clean marketplace profiles", () => {
    expect(
      evaluateProfileEligibility({
        displayName: "Ayşe Yılmaz",
        isAdminAccount: false,
        requiredDetailsComplete: true,
        role: "author",
      }),
    ).toEqual({
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
      riskWarnings: [],
    });
  });

  it("limits profiles with incomplete or risky signals", () => {
    expect(
      evaluateProfileEligibility({
        displayName: "A",
        isAdminAccount: false,
        requiredDetailsComplete: false,
        role: "publisher",
        spamSignals: ["suspicious website URL"],
      }),
    ).toMatchObject({
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskWarnings: [
        "display name is too short",
        "required details are missing",
        "suspicious website URL",
      ],
    });
  });

  it("quarantines malware-positive documents", () => {
    expect(
      evaluateDocumentEligibility({
        extractionSucceeded: true,
        fileSizeBytes: 10_000,
        malwareDetected: true,
        mimeType: "application/pdf",
        textLength: 50_000,
      }),
    ).toEqual({
      eligibilityStatus: "quarantined",
      reviewOutcome: "quarantined",
      riskWarnings: ["malware signal detected"],
    });
  });

  it("auto-approves clean processed documents", () => {
    expect(
      evaluateDocumentEligibility({
        extractionSucceeded: true,
        fileSizeBytes: 10_000,
        malwareDetected: false,
        mimeType: "application/pdf",
        textLength: 50_000,
      }),
    ).toEqual({
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
      riskWarnings: [],
    });
  });
});
