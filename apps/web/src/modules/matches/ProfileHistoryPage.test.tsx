import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileHistoryPage } from "./ProfileHistoryPage";
import { createMatchRun } from "./matchTestFixtures";

const mockUseProfileHistory = vi.fn();
const mockUseRunMatch = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <div>header</div>,
}));

vi.mock("./useMatches", () => ({
  useProfileHistory: () => mockUseProfileHistory(),
  useRunMatch: () => mockUseRunMatch(),
}));

vi.mock("../api/client", () => ({
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "request failed",
}));

describe("ProfileHistoryPage", () => {
  beforeEach(() => {
    mockUseRunMatch.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
    mockUseProfileHistory.mockReturnValue({
      data: { runs: [] },
      isError: false,
      isPending: false,
    });
  });

  it("shows loading, error, and empty states", () => {
    mockUseProfileHistory.mockReturnValue({
      data: null,
      isError: false,
      isPending: true,
    });
    expect(renderProfileHistory()).toContain("common.loading");

    mockUseProfileHistory.mockReturnValue({
      data: null,
      error: new Error("history failed"),
      isError: true,
      isPending: false,
    });
    expect(renderProfileHistory()).toContain("history failed");

    mockUseProfileHistory.mockReturnValue({
      data: { runs: [] },
      isError: false,
      isPending: false,
    });
    expect(renderProfileHistory()).toContain("profileHistory.empty");
  });

  it("shows stale/current labels and rematch/run-again actions", () => {
    mockUseProfileHistory.mockReturnValue({
      data: {
        runs: [
          createMatchRun({
            id: "11111111-1111-4111-8111-111111111111",
            sourceTitle: "Old manuscript",
            stale: true,
          }),
          createMatchRun({
            id: "99999999-9999-4999-8999-999999999999",
            direction: "publisher_to_manuscript",
            sourceManuscriptId: null,
            sourcePublisherProfileId: "33333333-3333-4333-8333-333333333333",
            sourceTitle: "Current publisher profile",
            stale: false,
          }),
        ],
      },
      isError: false,
      isPending: false,
    });

    const markup = renderProfileHistory();

    expect(markup).toContain("profileHistory.stale");
    expect(markup).toContain("profileHistory.current");
    expect(markup).toContain("profileHistory.rematch");
    expect(markup).toContain("profileHistory.runAgain");
    expect(markup).toContain(
      "/app/matches/11111111-1111-4111-8111-111111111111",
    );
  });
});

function renderProfileHistory() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ProfileHistoryPage />
    </MemoryRouter>,
  );
}
