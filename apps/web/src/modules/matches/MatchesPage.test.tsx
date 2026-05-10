import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Manuscript } from "@marketplace/contracts";
import {
  MatchesPage,
  isManuscriptMatchReady,
  resolveSelectedManuscriptId,
} from "./MatchesPage";

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

  it("renders an author manuscript selector before running a match", () => {
    mockUseMarketplaceProfile.mockReturnValue({
      data: { profile: { role: "author" } },
      isError: false,
      isPending: false,
    });
    mockUseManuscripts.mockReturnValue({
      data: {
        manuscripts: [
          createManuscript({
            id: "10000000-0000-4000-8000-000000000011",
            title: "First Ready Manuscript",
          }),
          createManuscript({
            id: "10000000-0000-4000-8000-000000000012",
            title: "Second Ready Manuscript",
          }),
        ],
      },
      isError: false,
      isPending: false,
    });

    const markup = renderMatchesPage();

    expect(markup).toContain("matches.selectManuscript");
    expect(markup).toContain("First Ready Manuscript");
    expect(markup).toContain("Second Ready Manuscript");
  });

  it("respects a manually selected manuscript id when resolving the run target", () => {
    const manuscripts = [
      createManuscript({
        id: "10000000-0000-4000-8000-000000000021",
        title: "First Ready Manuscript",
      }),
      createManuscript({
        id: "10000000-0000-4000-8000-000000000022",
        title: "Second Ready Manuscript",
      }),
    ];

    expect(
      resolveSelectedManuscriptId(
        manuscripts,
        "10000000-0000-4000-8000-000000000022",
      ),
    ).toBe("10000000-0000-4000-8000-000000000022");
  });

  it("allows matches only for eligible manuscripts with an uploaded sample", () => {
    expect(isManuscriptMatchReady(createManuscript())).toBe(true);
    expect(
      isManuscriptMatchReady(
        createManuscript({ eligibilityStatus: "limited" }),
      ),
    ).toBe(false);
    expect(
      isManuscriptMatchReady(createManuscript({ sampleDocumentId: null })),
    ).toBe(false);
  });
});

function renderMatchesPage() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MatchesPage />
    </MemoryRouter>,
  );
}

function createManuscript(
  input: Partial<{
    id: string;
    title: string;
    eligibilityStatus: Manuscript["eligibilityStatus"];
    sampleDocumentId: string | null;
  }> = {},
): Pick<Manuscript, "id" | "title" | "eligibilityStatus" | "sampleDocumentId"> &
  Record<string, unknown> {
  return {
    id: input.id ?? "10000000-0000-4000-8000-000000000001",
    authorId: "00000000-0000-4000-8000-000000000001",
    title: input.title ?? "Ready Manuscript",
    genre: "Roman",
    language: "tr",
    wordCount: 42000,
    synopsis: null,
    targetAgeMin: null,
    targetAgeMax: null,
    status: "draft",
    adminReviewStatus: "not_submitted",
    eligibilityStatus: input.eligibilityStatus ?? "eligible",
    reviewOutcome: "auto_approved",
    sampleDocumentId:
      input.sampleDocumentId !== undefined
        ? input.sampleDocumentId
        : "20000000-0000-4000-8000-000000000001",
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T09:00:00.000Z",
  };
}
