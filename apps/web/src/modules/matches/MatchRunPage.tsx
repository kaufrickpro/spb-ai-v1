import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import { CandidateList } from "./MatchCandidateSummary";
import { useMatchRun } from "./useMatches";

export function MatchRunPage() {
  const { t } = useTranslation();
  const { matchRunId = "" } = useParams<{ matchRunId: string }>();
  const query = useMatchRun(matchRunId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          className="text-sm text-slate-600 hover:text-slate-900"
          to={WEB_ROUTES.matches}
        >
          {t("matches.back")}
        </Link>

        {query.isPending ? (
          <p className="mt-5 text-sm text-slate-600">{t("common.loading")}</p>
        ) : query.isError ? (
          <p className="mt-5 text-sm text-rose-700">
            {getApiErrorCode(query.error) === "not_found"
              ? t("matches.runNotFound")
              : getApiErrorMessage(query.error)}
          </p>
        ) : query.data ? (
          <div className="mt-5 space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">
                {t(`matches.direction.${query.data.run.direction}`)}
              </p>
              <h1 className="mt-1 text-xl font-semibold">
                {query.data.run.sourceTitle}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded bg-slate-100 px-2 py-1">
                  {t(`matches.runStatus.${query.data.run.status}`)}
                </span>
                {query.data.run.stale ? (
                  <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                    {t("matches.stale")}
                  </span>
                ) : null}
                <span className="rounded bg-slate-100 px-2 py-1">
                  {query.data.run.candidateCount} {t("matches.candidates")}
                </span>
              </div>
            </section>
            {query.data.candidates.length ? (
              <CandidateList run={query.data} />
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
                {t("matches.noCandidates")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-5 text-sm text-rose-700">
            {t("matches.runNotFound")}
          </p>
        )}
      </main>
    </div>
  );
}
