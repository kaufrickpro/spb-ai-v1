import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManuscriptDetailPage } from "./ManuscriptDetailPage";

const mockUseManuscript = vi.fn();
const mockUseDocument = vi.fn();
const mockUseUpdateManuscript = vi.fn();
const mockUseDownloadDocument = vi.fn();
const mockUseUploadSample = vi.fn();

vi.mock("./useManuscripts", () => ({
  useDocument: () => mockUseDocument(),
  useDownloadDocument: () => mockUseDownloadDocument(),
  useManuscript: () => mockUseManuscript(),
  useUpdateManuscript: () => mockUseUpdateManuscript(),
  useUploadSample: () => mockUseUploadSample(),
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

describe("ManuscriptDetailPage", () => {
  beforeEach(() => {
    mockUseManuscript.mockReset();
    mockUseDocument.mockReset();
    mockUseUpdateManuscript.mockReset();
    mockUseDownloadDocument.mockReset();
    mockUseUploadSample.mockReset();

    mockUseUpdateManuscript.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    mockUseDownloadDocument.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
    mockUseUploadSample.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
  });

  it("shows a download action when a sample document is attached", () => {
    mockUseManuscript.mockReturnValue({
      data: {
        manuscript: {
          id: "10000000-0000-4000-8000-000000000001",
          authorId: "00000000-0000-4000-8000-000000000010",
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
      },
      isError: false,
      isLoading: false,
    });
    mockUseDocument.mockReturnValue({
      data: {
        document: {
          id: "20000000-0000-4000-8000-000000000001",
          manuscriptId: "10000000-0000-4000-8000-000000000001",
          authorId: "00000000-0000-4000-8000-000000000010",
          originalFileName: "sample.txt",
          mimeType: "text/plain",
          fileSizeBytes: 13,
          storageStatus: "uploaded",
          processingStatus: "queued",
          processingFailureCode: null,
          adminReviewStatus: "not_submitted",
          eligibilityStatus: "eligible",
          reviewOutcome: "auto_approved",
          uploadId: "upload-1",
          retentionExpiresAt: null,
          createdAt: "2026-05-04T09:00:00.000Z",
          updatedAt: "2026-05-04T09:00:00.000Z",
        },
      },
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/manuscripts/10000000-0000-4000-8000-000000000001"]}>
        <ManuscriptDetailPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("sample.txt");
    expect(markup).toContain("manuscripts.detail.downloadCta");
  });
});
