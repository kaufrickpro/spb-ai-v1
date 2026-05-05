import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES, manuscriptDetailPath } from "../routing/routes";
import { useManuscripts, useCreateManuscript } from "./useManuscripts";
import { ManuscriptForm } from "./ManuscriptForm";
import { SidePanel } from "../ui/SidePanel";
import type { CreateManuscriptRequest, Manuscript } from "@marketplace/contracts";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const colorMap: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-blue-100 text-blue-700",
    under_review: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    archived: "bg-slate-200 text-slate-500",
  };
  const { t } = useTranslation();
  const color = colorMap[status] ?? "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {t(`manuscripts.status.${status}`, { defaultValue: status })}
    </span>
  );
}

function EligibilityBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    eligible: "bg-green-100 text-green-700",
    limited: "bg-yellow-100 text-yellow-700",
    blocked: "bg-red-100 text-red-700",
    quarantined: "bg-red-100 text-red-700",
  };
  const { t } = useTranslation();
  const color = colorMap[status] ?? "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {t(`manuscripts.eligibilityStatus.${status}`, { defaultValue: status })}
    </span>
  );
}

function SampleBadge({ hasSample }: { hasSample: boolean }) {
  const { t } = useTranslation();
  const color = hasSample
    ? "bg-green-100 text-green-700"
    : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {hasSample
        ? t("manuscripts.sampleStatus.added")
        : t("manuscripts.sampleStatus.missing")}
    </span>
  );
}

function buildManuscriptSummary(manuscripts: Manuscript[]) {
  return {
    total: manuscripts.length,
    eligible: manuscripts.filter((m) => m.eligibilityStatus === "eligible").length,
    withSample: manuscripts.filter((m) => Boolean(m.sampleDocumentId)).length,
  };
}

// ─── Manuscript list page ─────────────────────────────────────────────────────

export function ManuscriptListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useManuscripts();
  const createMutation = useCreateManuscript();
  const [showCreate, setShowCreate] = useState(false);
  const manuscripts = data?.manuscripts ?? [];
  const summary = buildManuscriptSummary(manuscripts);

  async function handleCreate(values: CreateManuscriptRequest) {
    const result = await createMutation.mutateAsync(values);
    setShowCreate(false);
    void navigate(manuscriptDetailPath(result.manuscript.id));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t("manuscripts.pageTitle")}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("manuscripts.pageSubtitle")}
            </p>
          </div>
          <button
            type="button"
            id="new-manuscript-btn"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {t("manuscripts.createCta")}
          </button>
        </div>

        {/* Create form (in SidePanel) */}
        <SidePanel
          title={t("manuscripts.form.createTitle")}
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
        >
          <ManuscriptForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            isSaving={createMutation.isPending}
          />
        </SidePanel>

        {/* States */}
        {isLoading && (
          <p className="mt-8 text-sm text-slate-500">{t("common.loading")}</p>
        )}

        {isError && (
          <p className="mt-8 text-sm text-red-600">
            {t("common.retry")}
          </p>
        )}

        {!isLoading && !isError && data && data.manuscripts.length === 0 && (
          <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">{t("manuscripts.empty")}</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {t("manuscripts.createCta")}
            </button>
          </div>
        )}

        {!isLoading && !isError && manuscripts.length > 0 && (
          <div className="mt-8 space-y-6">
            <section aria-labelledby="manuscript-overview-title">
              <h2
                id="manuscript-overview-title"
                className="text-sm font-semibold uppercase tracking-wider text-slate-500"
              >
                {t("manuscripts.sections.overview")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <SummaryMetric
                  label={t("manuscripts.summary.total")}
                  value={summary.total.toLocaleString()}
                />
                <SummaryMetric
                  label={t("manuscripts.summary.withSample")}
                  value={summary.withSample.toLocaleString()}
                />
                <SummaryMetric
                  label={t("manuscripts.summary.eligible")}
                  value={summary.eligible.toLocaleString()}
                />
              </div>
            </section>

            <section aria-labelledby="manuscript-list-title">
              <h2
                id="manuscript-list-title"
                className="text-sm font-semibold uppercase tracking-wider text-slate-500"
              >
                {t("manuscripts.sections.list")}
              </h2>
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">{t("manuscripts.table.title")}</th>
                      <th className="px-4 py-3">{t("manuscripts.table.genre")}</th>
                      <th className="px-4 py-3">{t("manuscripts.table.language")}</th>
                      <th className="px-4 py-3">{t("manuscripts.table.status")}</th>
                      <th className="px-4 py-3">{t("manuscripts.table.sample")}</th>
                      <th className="px-4 py-3">{t("manuscripts.table.eligibility")}</th>
                      <th className="px-4 py-3">{t("manuscripts.table.words")}</th>
                      <th className="px-4 py-3"><span className="sr-only">{t("manuscripts.table.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {manuscripts.map((m) => (
                      <tr
                        key={m.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium">{m.title}</td>
                        <td className="px-4 py-3 text-slate-600">{m.genre}</td>
                        <td className="px-4 py-3 text-slate-600 uppercase">
                          {m.language}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="px-4 py-3">
                          <SampleBadge hasSample={Boolean(m.sampleDocumentId)} />
                        </td>
                        <td className="px-4 py-3">
                          <EligibilityBadge status={m.eligibilityStatus} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {m.wordCount?.toLocaleString() ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={manuscriptDetailPath(m.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            id={`manuscript-open-${m.id}`}
                          >
                            {t("manuscripts.openCta")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <div className="mt-6">
          <Link
            to={WEB_ROUTES.dashboard}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
