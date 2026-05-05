import { describe, expect, it } from "vitest";
import {
  mapDbAdminAuditLog,
  mapDbAdminJobRun,
  mapDbAdminPaymentEvent,
  mapDbAdminReview,
  mapDbAdminTrustSignal,
} from "./mappers.js";

const POSTGRES_TIMESTAMP = "2026-05-04T14:28:55.992262+00:00";
const CONTRACT_TIMESTAMP = "2026-05-04T14:28:55.992Z";

describe("admin database mappers", () => {
  it("normalizes Postgres timestamptz values for review queue contracts", () => {
    const review = mapDbAdminReview({
      id: "00000000-0000-4000-8000-000000000111",
      entity_type: "manuscript",
      entity_id: "00000000-0000-4000-8000-000000000222",
      status: "pending",
      exception_queue: "needs_review",
      eligibility_status: "limited",
      review_outcome: "needs_review",
      risk_level: "medium",
      summary: "New manuscript submitted",
      source: "automated_checks",
      submitted_at: POSTGRES_TIMESTAMP,
      updated_at: POSTGRES_TIMESTAMP,
      last_signal_at: POSTGRES_TIMESTAMP,
    });

    expect(review.submittedAt).toBe(CONTRACT_TIMESTAMP);
    expect(review.updatedAt).toBe(CONTRACT_TIMESTAMP);
    expect(review.lastSignalAt).toBe(CONTRACT_TIMESTAMP);
  });

  it("normalizes Postgres timestamptz values for admin operational feeds", () => {
    expect(
      mapDbAdminAuditLog({
        id: "00000000-0000-4000-8000-000000000111",
        actor_user_id: "00000000-0000-4000-8000-000000000222",
        action: "review.approved",
        target_type: "profile",
        target_id: "00000000-0000-4000-8000-000000000333",
        metadata: {},
        created_at: POSTGRES_TIMESTAMP,
      }).createdAt,
    ).toBe(CONTRACT_TIMESTAMP);

    expect(
      mapDbAdminJobRun({
        id: "00000000-0000-4000-8000-000000000111",
        job_type: "document_ingestion",
        status: "failed",
        source: "worker",
        error_message: "Failed",
        created_at: POSTGRES_TIMESTAMP,
        updated_at: POSTGRES_TIMESTAMP,
      }).updatedAt,
    ).toBe(CONTRACT_TIMESTAMP);

    expect(
      mapDbAdminPaymentEvent({
        id: "00000000-0000-4000-8000-000000000111",
        provider: "paytr",
        event_type: "callback",
        status: "failed",
        failure_reason: "hash mismatch",
        occurred_at: POSTGRES_TIMESTAMP,
      }).occurredAt,
    ).toBe(CONTRACT_TIMESTAMP);

    expect(
      mapDbAdminTrustSignal({
        id: "00000000-0000-4000-8000-000000000111",
        profile_id: "00000000-0000-4000-8000-000000000222",
        signal_type: "fraud_report",
        severity: "high",
        status: "open",
        note: "Needs review",
        created_at: POSTGRES_TIMESTAMP,
      }).createdAt,
    ).toBe(CONTRACT_TIMESTAMP);
  });
});
