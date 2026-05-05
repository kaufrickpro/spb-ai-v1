import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManuscriptDetailPage } from "./ManuscriptDetailPage";
import { UploadControl } from "./UploadControl";

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

const manuscriptWithSample = {
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
};

function mockLoadedManuscript() {
  mockUseManuscript.mockReturnValue({
    data: {
      manuscript: manuscriptWithSample,
    },
    isError: false,
    isLoading: false,
  });
}

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
    mockLoadedManuscript();
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
      <MemoryRouter
        initialEntries={[
          "/app/manuscripts/10000000-0000-4000-8000-000000000001",
        ]}
      >
        <ManuscriptDetailPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("sample.txt");
    expect(markup).toContain("manuscripts.detail.downloadCta");
  });

  it("shows sample loading when a manuscript has a sample id and document details are pending", () => {
    mockLoadedManuscript();
    mockUseDocument.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: true,
      isPending: true,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter
        initialEntries={[
          "/app/manuscripts/10000000-0000-4000-8000-000000000001",
        ]}
      >
        <ManuscriptDetailPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("manuscripts.detail.sampleLoading");
    expect(markup).not.toContain("manuscripts.detail.noDocument");
    expect(markup).not.toContain("manuscripts.detail.uploadCta");
  });

  it("shows sample load error and retry when a manuscript has a sample id and document details fail", () => {
    mockLoadedManuscript();
    mockUseDocument.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      isPending: false,
      refetch: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter
        initialEntries={[
          "/app/manuscripts/10000000-0000-4000-8000-000000000001",
        ]}
      >
        <ManuscriptDetailPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("manuscripts.detail.sampleLoadError");
    expect(markup).toContain("common.retry");
    expect(markup).not.toContain("manuscripts.detail.noDocument");
    expect(markup).not.toContain("manuscripts.detail.uploadCta");
  });
});

describe("UploadControl", () => {
  beforeEach(() => {
    mockUseUploadSample.mockReset();
  });

  it("disables file selection while a sample upload is pending", () => {
    mockUseUploadSample.mockReturnValue({
      isPending: true,
      mutateAsync: vi.fn(),
    });

    const markup = renderToStaticMarkup(
      <UploadControl
        manuscriptId="10000000-0000-4000-8000-000000000001"
        hasExistingDocument={false}
      />,
    );

    expect(markup).toContain("manuscripts.upload.uploading");
    expect(markup).toContain('id="upload-file-input"');
    expect(markup).toContain("disabled");
  });
});
