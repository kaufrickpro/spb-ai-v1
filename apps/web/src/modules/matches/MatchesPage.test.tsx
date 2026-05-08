import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchesPage } from "./MatchesPage";

const mockUseMarketplaceProfile = vi.fn();
const mockUseManuscripts = vi.fn();
const mockUseMatchRuns = vi.fn();
const mockUseRunMatch = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <div>header</div>,
}));

vi.mock("../profile/useMarketplaceProfile", () => ({
  useMarketplaceProfile: () => mockUseMarketplaceProfile(),
}));

vi.mock("../manuscripts/useManuscripts", () => ({
  useManuscripts: () => mockUseManuscripts(),
}));

vi.mock("./useMatches", () => ({
  useMatchRuns: () => mockUseMatchRuns(),
  useRunMatch: () => mockUseRunMatch(),
}));

vi.mock("../api/client", () => ({
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "request failed",
}));

describe("MatchesPage states", () => {
  beforeEach(() => {
    mockUseMarketplaceProfile.mockReturnValue({
      data: { profile: { role: "publisher" } },
      isError: false,
      isPending: false,
    });
    mockUseManuscripts.mockReturnValue({ data: { manuscripts: [] } });
    mockUseMatchRuns.mockReturnValue({
      data: { runs: [] },
      isError: false,
      isPending: false,
    });
    mockUseRunMatch.mockReturnValue({
      data: null,
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
  });

  it("shows loading while run history loads", () => {
    mockUseMatchRuns.mockReturnValue({
      data: null,
      isError: false,
      isPending: true,
    });

    expect(renderMatchesPage()).toContain("common.loading");
  });

  it("shows run history errors explicitly", () => {
    mockUseMatchRuns.mockReturnValue({
      data: null,
      error: new Error("history unavailable"),
      isError: true,
      isPending: false,
    });

    expect(renderMatchesPage()).toContain("history unavailable");
  });

  it("shows an empty state when there are no match runs", () => {
    expect(renderMatchesPage()).toContain("matches.empty");
  });
});

function renderMatchesPage() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MatchesPage />
    </MemoryRouter>,
  );
}
