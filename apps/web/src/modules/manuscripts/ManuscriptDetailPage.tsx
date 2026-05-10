import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import {
  useManuscript,
  useDocument,
  useUpdateManuscript,
  useDownloadDocument,
} from "./useManuscripts";
import type { UpdateManuscriptRequest } from "@marketplace/contracts";
import { ManuscriptMetadataCard } from "./ManuscriptMetadataCard";
import { SampleDocumentCard } from "./SampleDocumentCard";

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

        <ManuscriptMetadataCard
          editing={editing}
          isSaving={updateMutation.isPending}
          manuscript={manuscript}
          onCancel={() => setEditing(false)}
          onEdit={() => setEditing(true)}
          onSave={handleSave}
        />

        <SampleDocumentCard
          doc={doc}
          documentQuery={documentQuery}
          downloadError={downloadError}
          isDownloading={downloadMutation.isPending}
          manuscript={manuscript}
          onDownload={(documentId) => void handleDownload(documentId)}
        />
      </main>
    </div>
  );
}
