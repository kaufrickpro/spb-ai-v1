import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MatchRunResponse } from "@marketplace/contracts";
import { PlatformHeader } from "../layout/PlatformHeader";
import { getApiErrorMessage } from "../api/client";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";
import { matchCandidatePath } from "../routing/routes";
import { useManuscripts } from "../manuscripts/useManuscripts";
import { useMatchRuns, useRunMatch } from "./useMatches";

export function MatchesPage() {
  const { t } = useTranslation();
  const profile = useMarketplaceProfile();
  const runs = useMatchRuns();
  const runMatch = useRunMatch();
  const role = profile.data?.profile.role;
  const manuscripts = useManuscripts({ enabled: role === "author" });
  const firstReadyManuscript = manuscripts.data?.manuscripts.find(
    (manuscript) =>
      manuscript.eligibilityStatus === "eligible" &&
      manuscript.sampleDocumentId,
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{t("matches.title")}</h1>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {role === "author" ? (
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!firstReadyManuscript || runMatch.isPending}
              onClick={() =>
                firstReadyManuscript &&
                runMatch.mutate({
                  direction: "author_to_publisher",
                  manuscriptId: firstReadyManuscript.id,
                })
              }
              type="button"
            >
              {t("matches.runAuthor")}
            </button>
          ) : (
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={runMatch.isPending}
              onClick={() =>
                runMatch.mutate({ direction: "publisher_to_manuscript" })
              }
              type="button"
            >
              {t("matches.runPublisher")}
            </button>
          )}
          {runMatch.isError ? (
            <p className="mt-3 text-sm text-rose-700">
              {getApiErrorMessage(runMatch.error)}
            </p>
          ) : null}
        </section>

        {runMatch.data ? <CandidateList run={runMatch.data} /> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">{t("matches.history")}</h2>
          {runs.isPending ? (
            <p className="mt-3 text-sm text-slate-600">{t("common.loading")}</p>
          ) : runs.data?.runs.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {runs.data.runs.map((run) => (
                <Link
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:text-slate-600"
                  key={run.id}
                  to={`/app/matches/${run.id}`}
                >
                  <span>
                    <span className="font-medium">{run.sourceTitle}</span>
                    <span className="ml-2 text-slate-500">
                      {t(`matches.direction.${run.direction}`)}
                    </span>
                    {run.stale ? (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        {t("matches.stale")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-slate-500">
                    {run.candidateCount} {t("matches.candidates")}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">{t("matches.empty")}</p>
          )}
        </section>
      </main>
    </div>
  );
}

function CandidateList({ run }: { run: MatchRunResponse }) {
  const { t } = useTranslation();
  if (run.candidates.length === 0) {
    return null;
  }
  return (
    <section className="grid gap-3">
      {run.candidates.map((candidate) => (
        <article
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          key={candidate.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{candidate.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {candidate.subtitle}
              </p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {t(`matches.scoreBand.${candidate.scoreBand}`)}
            </span>
          </div>
          {candidate.explanation ? (
            <p className="mt-3 text-sm text-slate-700">
              {candidate.explanation}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              className="font-medium text-slate-900 hover:text-slate-600"
              to={candidate.profilePath}
            >
              {t("matches.openProfile")}
            </Link>
            {candidate.manuscriptProfilePath ? (
              <Link
                className="font-medium text-slate-900 hover:text-slate-600"
                to={candidate.manuscriptProfilePath}
              >
                {t("matches.openManuscript")}
              </Link>
            ) : null}
            <Link
              className="text-slate-600 hover:text-slate-900"
              to={matchCandidatePath({
                matchRunId: run.run.id,
                candidateId: candidate.id,
              })}
            >
              {t("matches.details")}
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
