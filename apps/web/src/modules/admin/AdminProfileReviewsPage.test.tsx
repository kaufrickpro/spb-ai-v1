import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminProfileReviewsPage } from "./AdminProfileReviewsPage";

const mockRequest = vi.fn();

vi.mock("../api/client", () => ({
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Something went wrong",
  webApiClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      typeof options?.count === "number" ? `${key}:${options.count}` : key,
    i18n: {
      resolvedLanguage: "en",
    },
  }),
}));

describe("AdminProfileReviewsPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("renders the moderation workspace shell", () => {
    mockRequest.mockImplementation((route: { path?: string }) => {
      if (route?.path === "/api/v1/admin/reviews") {
        return Promise.resolve({
          reviews: [
            {
              id: "00000000-0000-4000-8000-000000000111",
              entityType: "profile",
              entityId: "00000000-0000-4000-8000-000000000211",
              status: "pending",
              exceptionQueue: "needs_review",
              eligibilityStatus: "limited",
              reviewOutcome: "needs_review",
              riskLevel: "high",
              source: "automated_checks",
              summary: "Author profile awaiting review",
              assigneeUserId: null,
              decidedByUserId: null,
              decisionNote: null,
              lastSignalAt: "2026-05-01T08:00:00.000Z",
              submittedAt: "2026-05-01T08:00:00.000Z",
              updatedAt: "2026-05-01T08:00:00.000Z",
            },
          ],
        });
      }

      if (route?.path === "/api/v1/admin/reviews/:reviewId") {
        return Promise.resolve({
          review: {
            id: "00000000-0000-4000-8000-000000000111",
            entityType: "profile",
            entityId: "00000000-0000-4000-8000-000000000211",
            status: "pending",
            exceptionQueue: "needs_review",
            eligibilityStatus: "limited",
            reviewOutcome: "needs_review",
            riskLevel: "high",
            source: "automated_checks",
            summary: "Author profile awaiting review",
            assigneeUserId: null,
            decidedByUserId: null,
            decisionNote: null,
            lastSignalAt: "2026-05-01T08:00:00.000Z",
            submittedAt: "2026-05-01T08:00:00.000Z",
            updatedAt: "2026-05-01T08:00:00.000Z",
          },
          submittedFields: { displayName: "Ayşe Yılmaz" },
          riskWarnings: ["Identity check pending"],
          relatedEvents: [],
          auditHistory: [],
          decisionNotesRequired: true,
        });
      }

      return Promise.resolve({ reviews: [] });
    });

    const client = new QueryClient();
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminProfileReviewsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(markup).toContain("admin.reviews.title");
    expect(markup).toContain("admin.queue.title");
    expect(markup).toContain("admin.exceptionQueues.needs_review");
  });
});
