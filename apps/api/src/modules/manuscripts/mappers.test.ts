import { describe, expect, it } from "vitest";
import { mapDbDocument, mapDbManuscript } from "./mappers.js";

describe("manuscript mappers", () => {
  it("normalizes Supabase timestamp strings for manuscript contracts", () => {
    const manuscript = mapDbManuscript({
      id: "10000000-0000-4000-8000-000000000001",
      author_id: "00000000-0000-4000-8000-000000000010",
      title: "Gece Yarisi Sehri",
      genre: "Distopya",
      language: "tr",
      word_count: 80000,
      synopsis: null,
      target_age_min: 18,
      target_age_max: null,
      status: "draft",
      admin_review_status: "not_submitted",
      eligibility_status: "eligible",
      review_outcome: "auto_approved",
      sample_document_id: null,
      created_at: "2026-05-04T14:00:00.123456+00:00",
      updated_at: "2026-05-04T14:15:30+00:00",
    });

    expect(manuscript.createdAt).toBe("2026-05-04T14:00:00.123Z");
    expect(manuscript.updatedAt).toBe("2026-05-04T14:15:30.000Z");
  });

  it("normalizes Supabase timestamp strings for document contracts", () => {
    const document = mapDbDocument({
      id: "10000000-0000-4000-8000-000000000002",
      manuscript_id: "10000000-0000-4000-8000-000000000001",
      author_id: "00000000-0000-4000-8000-000000000010",
      original_file_name: "sample.txt",
      mime_type: "text/plain",
      file_size_bytes: 42,
      storage_status: "uploaded",
      processing_status: "queued",
      processing_failure_code: null,
      admin_review_status: "not_submitted",
      eligibility_status: "limited",
      review_outcome: "needs_review",
      upload_id: "upload-1",
      retention_expires_at: "2026-06-04T14:00:00.123456+00:00",
      created_at: "2026-05-04T14:00:00.123456+00:00",
      updated_at: "2026-05-04T14:15:30+00:00",
    });

    expect(document.retentionExpiresAt).toBe("2026-06-04T14:00:00.123Z");
    expect(document.createdAt).toBe("2026-05-04T14:00:00.123Z");
    expect(document.updatedAt).toBe("2026-05-04T14:15:30.000Z");
  });
});
