import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAuditLogsPage } from "./AdminAuditLogsPage";
import { AdminJobsPage } from "./AdminJobsPage";

const mockRequest = vi.fn();
const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

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

function renderPage(element: ReactElement) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
}

describe("admin operational feed pages", () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockUseQuery.mockReset();
  });

  it("renders an explicit audit-log API error instead of the empty state", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error("Audit feed unavailable"),
      isError: true,
      isPending: false,
    });

    const markup = renderPage(<AdminAuditLogsPage />);

    expect(markup).toContain("Audit feed unavailable");
    expect(markup).not.toContain("admin.audit.empty");
  });

  it("keeps the audit-log empty state for successful empty responses", () => {
    mockUseQuery.mockReturnValue({
      data: { logs: [] },
      error: null,
      isError: false,
      isPending: false,
    });

    const markup = renderPage(<AdminAuditLogsPage />);

    expect(markup).toContain("admin.audit.empty");
  });

  it("renders an explicit job health API error instead of an empty feed", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      error: new Error("Job health unavailable"),
      isError: true,
      isPending: false,
    });

    const markup = renderPage(<AdminJobsPage />);

    expect(markup).toContain("Job health unavailable");
    expect(markup).not.toContain("admin.jobs.empty");
  });
});
