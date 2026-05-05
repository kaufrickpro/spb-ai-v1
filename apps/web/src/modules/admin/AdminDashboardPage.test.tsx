import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./AdminDashboardPage";

const mockRequest = vi.fn();

vi.mock("../api/client", () => ({
  getApiErrorCode: () => null,
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Something went wrong",
  webApiClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; title?: string }) =>
      typeof options?.count === "number" ? `${key}:${options.count}` : key,
    i18n: {
      resolvedLanguage: "tr",
    },
  }),
}));

function renderPage() {
  const client = new QueryClient();
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("shows a loading queue state before rendering the empty queue state", () => {
    mockRequest.mockReturnValue(new Promise(() => undefined));

    const markup = renderPage();

    expect(markup).toContain("common.loading");
    expect(markup).not.toContain("admin.queue.empty");
  });
});
