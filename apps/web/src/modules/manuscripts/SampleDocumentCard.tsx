import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Document, Manuscript } from "@marketplace/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { getDocumentCheckingState } from "./documentCheckingState";
import { eligibilityStatusColors, StatusBadge } from "./ManuscriptBadges";
import { UploadControl } from "./UploadControl";

type SampleDocumentCardProps = {
  doc: Document | undefined;
  documentQuery: UseQueryResult<{ document: Document }, Error>;
  downloadError: boolean;
  isDownloading: boolean;
  manuscript: Manuscript;
  onDownload: (documentId: string) => void;
};

export function SampleDocumentCard({
  doc,
  documentQuery,
  downloadError,
  isDownloading,
  manuscript,
  onDownload,
}: SampleDocumentCardProps) {
  const { t } = useTranslation();
  const hasSampleDocument = Boolean(manuscript.sampleDocumentId);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">
        {t("manuscripts.detail.sampleDocument")}
      </h2>

      {hasSampleDocument ? (
        <ExistingSampleDocument
          doc={doc}
          documentQuery={documentQuery}
          downloadError={downloadError}
          isDownloading={isDownloading}
          manuscript={manuscript}
          onDownload={onDownload}
        />
      ) : (
        <div className="mt-4">
          <p className="mb-4 text-sm text-slate-500">
            {t("manuscripts.detail.noDocument")}
          </p>
          <UploadControl
            manuscriptId={manuscript.id}
            hasExistingDocument={false}
          />
        </div>
      )}
    </div>
  );
}

function ExistingSampleDocument({
  doc,
  documentQuery,
  downloadError,
  isDownloading,
  manuscript,
  onDownload,
}: SampleDocumentCardProps) {
  const { t } = useTranslation();

  if (documentQuery.isLoading || documentQuery.isPending) {
    return <SampleLoading />;
  }

  if (documentQuery.isError) {
    return (
      <div className="mt-4 rounded-md border border-red-100 bg-red-50 p-3">
        <p className="text-sm text-red-700">
          {t("manuscripts.detail.sampleLoadError")}
        </p>
        <button
          type="button"
          id="retry-sample-document-btn"
          onClick={() => void documentQuery.refetch()}
          className="mt-3 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (!doc) {
    return <SampleLoading />;
  }

  return (
    <SampleDocumentReady
      doc={doc}
      downloadError={downloadError}
      isDownloading={isDownloading}
      manuscript={manuscript}
      onDownload={onDownload}
    />
  );
}

function SampleDocumentReady({
  doc,
  downloadError,
  isDownloading,
  manuscript,
  onDownload,
}: Omit<SampleDocumentCardProps, "documentQuery"> & { doc: Document }) {
  const { t } = useTranslation();
  const documentCheckingState = getDocumentCheckingState(doc);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {doc.originalFileName}
          </p>
          <p className="text-xs text-slate-500">
            {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB · {doc.mimeType}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            status={documentCheckingState.kind}
            label={t(documentCheckingState.titleKey)}
            colorMap={{
              [documentCheckingState.kind]:
                documentCheckingState.badgeClassName,
            }}
          />
          <StatusBadge
            status={doc.eligibilityStatus}
            label={t(`manuscripts.eligibilityStatus.${doc.eligibilityStatus}`, {
              defaultValue: doc.eligibilityStatus,
            })}
            colorMap={eligibilityStatusColors}
          />
        </div>
      </div>
      <div
        className={`rounded-md border px-3 py-2 ${documentCheckingState.panelClassName}`}
      >
        <p className="text-sm font-medium">
          {t(documentCheckingState.titleKey)}
        </p>
        <p className="mt-1 text-sm">
          {t(documentCheckingState.descriptionKey)}
        </p>
        {documentCheckingState.failureMessageKey && (
          <p className="mt-2 text-sm">
            {t(documentCheckingState.failureMessageKey)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          id="download-sample-btn"
          disabled={isDownloading}
          onClick={() => onDownload(doc.id)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {isDownloading
            ? t("manuscripts.detail.downloadingCta")
            : t("manuscripts.detail.downloadCta")}
        </button>
        {downloadError && (
          <p id="download-error-msg" className="text-sm text-red-600">
            {t("manuscripts.detail.downloadError")}
          </p>
        )}
      </div>

      <UploadControl manuscriptId={manuscript.id} hasExistingDocument={true} />
    </div>
  );
}

function SampleLoading() {
  const { t } = useTranslation();

  return (
    <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm text-slate-600">
        {t("manuscripts.detail.sampleLoading")}
      </p>
    </div>
  );
}
