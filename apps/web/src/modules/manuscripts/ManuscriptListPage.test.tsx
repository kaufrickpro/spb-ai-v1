import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManuscriptListPage } from "./ManuscriptListPage";

const mockUseManuscripts = vi.fn();
const mockUseCreateManuscript = vi.fn();

vi.mock("./useManuscripts", () => ({
  useManuscripts: () => mockUseManuscripts(),
  useCreateManuscript: () => mockUseCreateManuscript(),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <div>header</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

describe("ManuscriptListPage", () => {
  beforeEach(() => {
    mockUseManuscripts.mockReset();
    mockUseCreateManuscript.mockReset();
    mockUseCreateManuscript.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
  });

  it("shows manuscripts returned by the API in the author workspace", () => {
    mockUseManuscripts.mockReturnValue({
      data: {
        manuscripts: [
          {
            id: "10000000-0000-4000-8000-000000000001",
            authorId: "00000000-0000-4000-8000-000000000001",
            title: "Gece Yarisi Sehri",
            genre: "Speculative fiction",
            language: "tr",
            wordCount: 92000,
            synopsis: null,
            targetAgeMin: null,
            targetAgeMax: null,
            status: "draft",
            adminReviewStatus: "not_submitted",
            eligibilityStatus: "eligible",
            reviewOutcome: "auto_approved",
            sampleDocumentId: "20000000-0000-4000-8000-000000000001",
            createdAt: "2026-05-04T09:00:00.000Z",
            updatedAt: "2026-05-04T09:00:00.000Z",
          },
        ],
      },
      isError: false,
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ManuscriptListPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("Gece Yarisi Sehri");
    expect(markup).toContain("Speculative fiction");
    expect(markup).toContain("/app/manuscripts/10000000-0000-4000-8000-000000000001");
    expect(markup).not.toContain("manuscripts.empty");
  });
});
