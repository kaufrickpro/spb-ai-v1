import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchCandidatePage } from "./MatchCandidatePage";
import {
  createMatchCandidateDetail,
  createMatchRun,
} from "./matchTestFixtures";

const mockUseMatchCandidate = vi.fn();
const mockGetApiErrorCode = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.rank ? `${key}:${values.rank}` : key,
  }),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <div>header</div>,
}));

vi.mock("./useMatches", () => ({
  useMatchCandidate: (matchRunId: string, candidateId: string) =>
    mockUseMatchCandidate(matchRunId, candidateId),
}));

vi.mock("../api/client", () => ({
  getApiErrorCode: (error: unknown) => mockGetApiErrorCode(error),
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "request failed",
}));

describe("MatchCandidatePage", () => {
  beforeEach(() => {
    mockGetApiErrorCode.mockReturnValue(null);
    mockUseMatchCandidate.mockReturnValue({
      data: {
        run: createMatchRun(),
        candidate: createMatchCandidateDetail(),
      },
      isError: false,
      isPending: false,
    });
  });

  it("distinguishes not-found errors from ordinary request errors", () => {
    mockGetApiErrorCode.mockReturnValue("not_found");
    mockUseMatchCandidate.mockReturnValue({
      data: null,
      error: new Error("404"),
      isError: true,
      isPending: false,
    });

    expect(renderCandidatePage()).toContain("matches.notFound");

    mockGetApiErrorCode.mockReturnValue("server_error");
    mockUseMatchCandidate.mockReturnValue({
      data: null,
      error: new Error("candidate service unavailable"),
      isError: true,
      isPending: false,
    });

    expect(renderCandidatePage()).toContain("candidate service unavailable");
  });

  it("shows structured details and hides rank eleven paragraphs", () => {
    mockUseMatchCandidate.mockReturnValue({
      data: {
        run: createMatchRun(),
        candidate: createMatchCandidateDetail({
          rank: 11,
          explanation: "Rank eleven paragraph should not render.",
        }),
      },
      isError: false,
      isPending: false,
    });

    const markup = renderCandidatePage();

    expect(markup).toContain("matches.axis.premise");
    expect(markup).toContain("Clear editorial overlap");
    expect(markup).toContain("Looks for literary fiction");
    expect(markup).toContain("matches.detailTabs.comparison");
    expect(markup).toContain("matches.detailTabs.evidence");
    expect(markup).not.toContain("Rank eleven paragraph should not render.");
  });

  it("shows stale detail warning and fallback limitations", () => {
    mockUseMatchCandidate.mockReturnValue({
      data: {
        run: createMatchRun({ stale: true }),
        candidate: createMatchCandidateDetail({
          detail: {
            ...createMatchCandidateDetail().detail,
            comparison: [],
            limitations: ["detail_snapshot_unavailable"],
          },
        }),
      },
      isError: false,
      isPending: false,
    });

    const markup = renderCandidatePage();

    expect(markup).toContain("matches.staleDetailTitle");
    expect(markup).toContain("matches.rematchFromHistory");
    expect(markup).toContain("matches.limitation.detail_snapshot_unavailable");
  });
});

function renderCandidatePage() {
  return renderToStaticMarkup(
    <MemoryRouter
      initialEntries={[
        "/app/matches/11111111-1111-4111-8111-111111111111/candidates/22222222-2222-4222-8222-222222222222",
      ]}
    >
      <Routes>
        <Route
          element={<MatchCandidatePage />}
          path="/app/matches/:matchRunId/candidates/:candidateId"
        />
      </Routes>
    </MemoryRouter>,
  );
}
