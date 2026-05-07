import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import {
  useManuscript,
  useDocument,
  useUpdateManuscript,
  useDownloadDocument,
} from "./useManuscripts";
import { getDocumentCheckingState } from "./documentCheckingState";
import { ManuscriptForm } from "./ManuscriptForm";
import { UploadControl } from "./UploadControl";
import type { UpdateManuscriptRequest } from "@marketplace/contracts";

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatusBadge({
  colorMap,
  label,
  status,
}: {
  colorMap: Record<string, string>;
  label?: string;
  status: string;
}) {
  const color = colorMap[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

const manuscriptStatusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-slate-200 text-slate-500",
};

const eligibilityStatusColors: Record<string, string> = {
  eligible: "bg-green-100 text-green-700",
  limited: "bg-yellow-100 text-yellow-700",
  blocked: "bg-red-100 text-red-700",
  quarantined: "bg-red-100 text-red-700",
};

// ─── Detail page ──────────────────────────────────────────────────────────────

export function ManuscriptDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const { data, isLoading, isError } = useManuscript(id ?? "");
  const updateMutation = useUpdateManuscript(id ?? "");
  const downloadMutation = useDownloadDocument();
  const manuscript = data?.manuscript;

  const documentQuery = useDocument(manuscript?.sampleDocumentId ?? null);
  const doc = documentQuery.data?.document;
  const documentCheckingState = getDocumentCheckingState(
    doc ?? {
      processingFailureCode: null,
      processingStatus: "not_started",
    },
  );
  const hasSampleDocument = Boolean(manuscript?.sampleDocumentId);

  async function handleSave(values: UpdateManuscriptRequest) {
    await updateMutation.mutateAsync(values);
    setEditing(false);
  }

  async function handleDownload(documentId: string) {
    setDownloadError(false);
    try {
      await downloadMutation.mutateAsync(documentId);
    } catch {
      setDownloadError(true);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PlatformHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  if (isError || !manuscript) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PlatformHeader />
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <Link
            to={WEB_ROUTES.manuscripts}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            {t("manuscripts.detail.backToList")}
          </Link>
          <p className="mt-4 text-sm text-red-600">
            Manuscript not found or access denied.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          to={WEB_ROUTES.manuscripts}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          {t("manuscripts.detail.backToList")}
        </Link>

        {/* Manuscript metadata card */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">
                {manuscript.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={manuscript.status}
                  colorMap={manuscriptStatusColors}
                />
                <span className="text-xs text-slate-400">
                  {t("manuscripts.detail.eligibility")}:{" "}
                  {t(
                    `manuscripts.eligibilityStatus.${manuscript.eligibilityStatus}`,
                    { defaultValue: manuscript.eligibilityStatus },
                  )}
                </span>
              </div>
            </div>
            {!editing && (
              <button
                type="button"
                id="edit-manuscript-btn"
                onClick={() => setEditing(true)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("manuscripts.form.editTitle")}
              </button>
            )}
          </div>

          {/* View mode */}
          {!editing && (
            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetaField
                label={t("manuscripts.form.genre")}
                value={manuscript.genre}
              />
              <MetaField
                label={t("manuscripts.form.language")}
                value={manuscript.language.toUpperCase()}
              />
              <MetaField
                label={t("manuscripts.form.wordCount")}
                value={manuscript.wordCount?.toLocaleString() ?? "—"}
              />
              <MetaField
                label={t("manuscripts.form.targetAgeMin")}
                value={manuscript.targetAgeMin?.toString() ?? "—"}
              />
              <MetaField
                label={t("manuscripts.form.targetAgeMax")}
                value={manuscript.targetAgeMax?.toString() ?? "—"}
              />
              <MetaField
                label={t("manuscripts.form.manuscriptForm")}
                value={manuscript.manuscriptForm ?? "—"}
              />
              <MetaField
                label={t("manuscripts.form.requestable")}
                value={manuscript.requestable ? "Yes" : "No"}
              />
              <MetaField
                label={t("manuscripts.form.subgenres")}
                value={manuscript.subgenres?.join(", ") || "—"}
              />
              <MetaField
                label={t("manuscripts.form.audienceCategories")}
                value={manuscript.audienceCategories?.join(", ") || "—"}
              />
              <MetaField
                label={t("manuscripts.form.declaredThemes")}
                value={manuscript.declaredThemes?.join(", ") || "—"}
              />
              {manuscript.synopsis && (
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("manuscripts.form.synopsis")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                    {manuscript.synopsis}
                  </dd>
                </div>
              )}
              {manuscript.logline && (
                <TextBlock
                  label={t("manuscripts.form.logline")}
                  value={manuscript.logline}
                />
              )}
              {manuscript.arcSummary && (
                <TextBlock
                  label={t("manuscripts.form.arcSummary")}
                  value={manuscript.arcSummary}
                />
              )}
              {manuscript.shortTeaser && (
                <TextBlock
                  label={t("manuscripts.form.shortTeaser")}
                  value={manuscript.shortTeaser}
                />
              )}
            </dl>
          )}

          {/* Edit mode */}
          {editing && (
            <div className="mt-5">
              <ManuscriptForm
                defaultValues={{
                  title: manuscript.title,
                  genre: manuscript.genre,
                  language: manuscript.language,
                  wordCount: manuscript.wordCount ?? undefined,
                  synopsis: manuscript.synopsis ?? undefined,
                  logline: manuscript.logline ?? undefined,
                  subgenres: manuscript.subgenres,
                  audienceCategories: manuscript.audienceCategories,
                  manuscriptForm: manuscript.manuscriptForm ?? undefined,
                  compTitles: manuscript.compTitles,
                  declaredThemes: manuscript.declaredThemes,
                  declaredContentWarnings: manuscript.declaredContentWarnings,
                  arcSummary: manuscript.arcSummary ?? undefined,
                  shortTeaser: manuscript.shortTeaser ?? undefined,
                  requestable: manuscript.requestable,
                  targetAgeMin: manuscript.targetAgeMin ?? undefined,
                  targetAgeMax: manuscript.targetAgeMax ?? undefined,
                }}
                onSubmit={handleSave}
                onCancel={() => setEditing(false)}
                isSaving={updateMutation.isPending}
              />
            </div>
          )}
        </div>

        {/* Sample document card */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold">
            {t("manuscripts.detail.sampleDocument")}
          </h2>

          {hasSampleDocument ? (
            documentQuery.isLoading || documentQuery.isPending ? (
              <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm text-slate-600">
                  {t("manuscripts.detail.sampleLoading")}
                </p>
              </div>
            ) : documentQuery.isError ? (
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
            ) : doc ? (
              <div className="mt-4 space-y-3">
                {/* Document info */}
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {doc.originalFileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {doc.mimeType}
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
                      label={t(
                        `manuscripts.eligibilityStatus.${doc.eligibilityStatus}`,
                        { defaultValue: doc.eligibilityStatus },
                      )}
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
                    disabled={downloadMutation.isPending}
                    onClick={() => void handleDownload(doc.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {downloadMutation.isPending
                      ? t("manuscripts.detail.downloadingCta")
                      : t("manuscripts.detail.downloadCta")}
                  </button>
                  {downloadError && (
                    <p id="download-error-msg" className="text-sm text-red-600">
                      {t("manuscripts.detail.downloadError")}
                    </p>
                  )}
                </div>

                {/* Replace */}
                <UploadControl
                  manuscriptId={manuscript.id}
                  hasExistingDocument={true}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm text-slate-600">
                  {t("manuscripts.detail.sampleLoading")}
                </p>
              </div>
            )
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
      </main>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 sm:col-span-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
        {value}
      </dd>
    </div>
  );
}
