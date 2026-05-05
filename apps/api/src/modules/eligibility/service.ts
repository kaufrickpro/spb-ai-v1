import type { EligibilityStatus, ReviewOutcome } from "@marketplace/contracts";

export type EligibilityDecision = {
  eligibilityStatus: EligibilityStatus;
  reviewOutcome: ReviewOutcome;
  riskWarnings: string[];
};

export type ProfileEligibilityInput = {
  displayName: string;
  isAdminAccount: boolean;
  requiredDetailsComplete: boolean;
  role: "author" | "publisher";
  spamSignals?: string[];
};

export type DocumentEligibilityInput = {
  extractionSucceeded: boolean;
  fileSizeBytes: number;
  malwareDetected: boolean;
  mimeType: string;
  textLength: number;
};

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/epub+zip",
  "text/plain",
]);

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 250_000;

export function evaluateProfileEligibility(
  input: ProfileEligibilityInput,
): EligibilityDecision {
  if (input.isAdminAccount) {
    return blocked("admin accounts cannot enter marketplace eligibility");
  }

  const riskWarnings = [
    ...shortDisplayNameWarnings(input.displayName),
    ...(input.requiredDetailsComplete ? [] : ["required details are missing"]),
    ...(input.spamSignals ?? []),
  ];

  if (riskWarnings.length > 0) {
    return {
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskWarnings,
    };
  }

  return autoApproved();
}

export function evaluateDocumentEligibility(
  input: DocumentEligibilityInput,
): EligibilityDecision {
  if (input.malwareDetected) {
    return quarantined("malware signal detected");
  }

  const riskWarnings = [];

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(input.mimeType)) {
    riskWarnings.push("unsupported document type");
  }
  if (input.fileSizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    riskWarnings.push("document exceeds maximum size");
  }
  if (!input.extractionSucceeded) {
    riskWarnings.push("text extraction failed");
  }
  if (input.textLength > MAX_EXTRACTED_CHARACTERS) {
    riskWarnings.push("extracted text exceeds matching limit");
  }

  if (riskWarnings.length > 0) {
    return {
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      riskWarnings,
    };
  }

  return autoApproved();
}

function autoApproved(): EligibilityDecision {
  return {
    eligibilityStatus: "eligible",
    reviewOutcome: "auto_approved",
    riskWarnings: [],
  };
}

function blocked(reason: string): EligibilityDecision {
  return {
    eligibilityStatus: "blocked",
    reviewOutcome: "admin_rejected",
    riskWarnings: [reason],
  };
}

function quarantined(reason: string): EligibilityDecision {
  return {
    eligibilityStatus: "quarantined",
    reviewOutcome: "quarantined",
    riskWarnings: [reason],
  };
}

function shortDisplayNameWarnings(displayName: string) {
  return displayName.trim().length < 2 ? ["display name is too short"] : [];
}
