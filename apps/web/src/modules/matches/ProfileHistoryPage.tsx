import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { getApiErrorMessage } from "../api/client";
import { useRunMatch, useProfileHistory } from "./useMatches";

export function ProfileHistoryPage() {
  const { t } = useTranslation();
  const history = useProfileHistory();
  const runMatch = useRunMatch();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("profileHistory.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("profileHistory.description")}
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {history.isPending ? (
            <p className="text-sm text-slate-600">{t("common.loading")}</p>
          ) : history.isError ? (
            <p className="text-sm text-rose-700">
              {getApiErrorMessage(history.error)}
            </p>
          ) : history.data?.runs.length ? (
            <div className="divide-y divide-slate-100">
              {history.data.runs.map((run) => (
                <div
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={run.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-950">
                        {run.sourceTitle}
                      </h2>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {t(`matches.direction.${run.direction}`)}
                      </span>
                      {run.stale ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          {t("profileHistory.stale")}
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                          {t("profileHistory.current")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Date(run.createdAt).toLocaleDateString()} {" / "}
                      {t(`matches.runStatus.${run.status}`)} {" / "}
                      {run.candidateCount} {t("matches.candidates")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      className="font-medium text-slate-900 hover:text-slate-600"
                      to={`/app/matches/${run.id}`}
                    >
                      {t("profileHistory.viewResults")}
                    </Link>
                    <button
                      className="font-medium text-slate-900 hover:text-slate-600 disabled:text-slate-400"
                      disabled={runMatch.isPending || run.status === "running"}
                      onClick={() => {
                        if (run.direction === "author_to_publisher") {
                          if (!run.sourceManuscriptId) return;
                          runMatch.mutate({
                            direction: "author_to_publisher",
                            manuscriptId: run.sourceManuscriptId,
                          });
                          return;
                        }

                        runMatch.mutate({
                          direction: "publisher_to_manuscript",
                        });
                      }}
                      type="button"
                    >
                      {run.stale
                        ? t("profileHistory.rematch")
                        : t("profileHistory.runAgain")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {t("profileHistory.empty")}
            </p>
          )}
          {runMatch.isError ? (
            <p className="mt-3 text-sm text-rose-700">
              {getApiErrorMessage(runMatch.error)}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
