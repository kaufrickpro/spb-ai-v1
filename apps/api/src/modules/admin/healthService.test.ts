import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getAdminRiskHotlist } from "./healthService.js";

describe("admin health service", () => {
  it("orders the risk hotlist by explicit risk rank and oldest submission", async () => {
    const query = createHotlistQuery([
      createReviewRow({
        id: "10000000-0000-4000-8000-000000000001",
        risk_level: "low",
        submitted_at: "2026-05-01T08:00:00.000Z",
      }),
      createReviewRow({
        id: "10000000-0000-4000-8000-000000000002",
        risk_level: "medium",
        submitted_at: "2026-05-01T08:05:00.000Z",
      }),
      createReviewRow({
        id: "10000000-0000-4000-8000-000000000003",
        risk_level: "high",
        submitted_at: "2026-05-01T08:20:00.000Z",
      }),
      createReviewRow({
        id: "10000000-0000-4000-8000-000000000004",
        risk_level: "high",
        submitted_at: "2026-05-01T08:10:00.000Z",
      }),
      createReviewRow({
        id: "10000000-0000-4000-8000-000000000005",
        risk_level: "medium",
        submitted_at: "2026-05-01T08:01:00.000Z",
      }),
      createReviewRow({
        id: "10000000-0000-4000-8000-000000000006",
        risk_level: "low",
        submitted_at: "2026-05-01T08:02:00.000Z",
      }),
    ]);
    const db = {
      from: (table: string) => {
        expect(table).toBe("admin_reviews");
        return query;
      },
    } as unknown as SupabaseClient;

    await expect(getAdminRiskHotlist(db)).resolves.toMatchObject([
      { id: "10000000-0000-4000-8000-000000000004", riskLevel: "high" },
      { id: "10000000-0000-4000-8000-000000000003", riskLevel: "high" },
      { id: "10000000-0000-4000-8000-000000000005", riskLevel: "medium" },
      { id: "10000000-0000-4000-8000-000000000002", riskLevel: "medium" },
      { id: "10000000-0000-4000-8000-000000000001", riskLevel: "low" },
    ]);
    expect(query.limitCalls).toEqual([]);
  });
});

function createHotlistQuery(data: Array<Record<string, unknown>>) {
  return {
    limitCalls: [] as number[],
    eq(column: string, value: string) {
      expect({ column, value }).toEqual({ column: "status", value: "pending" });
      return this;
    },
    limit(value: number) {
      this.limitCalls.push(value);
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      expect({ column, options }).toEqual({
        column: "submitted_at",
        options: { ascending: true },
      });
      return this;
    },
    select() {
      return this;
    },
    then<TResult1 = { data: Array<Record<string, unknown>>; error: null }>(
      onfulfilled?:
        | ((
            value: { data: Array<Record<string, unknown>>; error: null },
          ) => TResult1 | PromiseLike<TResult1>)
        | null,
    ) {
      return Promise.resolve({ data, error: null }).then(onfulfilled);
    },
  };
}

function createReviewRow(
  overrides: Pick<Record<string, string>, "id" | "risk_level" | "submitted_at">,
) {
  return {
    assignee_user_id: null,
    decided_by_user_id: null,
    eligibility_status: "limited",
    entity_id: "20000000-0000-4000-8000-000000000001",
    entity_type: "profile",
    exception_queue: "needs_review",
    last_signal_at: null,
    rejection_note: null,
    review_outcome: "needs_review",
    source: "automated_checks",
    status: "pending",
    summary: "Needs staff review",
    updated_at: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}
