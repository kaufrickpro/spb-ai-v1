import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import { AxisBands, CandidateDetails } from "./MatchCandidateSummary";
import { shouldShowExplanation, visibleText } from "./matchDisplay";
import { useMatchCandidate } from "./useMatches";

export function MatchCandidatePage() {
  const { t } = useTranslation();
  const { candidateId = "", matchRunId = "" } = useParams<{
    candidateId: string;
    matchRunId: string;
  }>();
  const query = useMatchCandidate(matchRunId, candidateId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
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
              ? t("matches.notFound")
              : getApiErrorMessage(query.error)}
          </p>
        ) : query.data ? (
          <article className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  {t("matches.rank", { rank: query.data.candidate.rank })}
                </p>
                <h1 className="text-xl font-semibold">
                  {visibleText(query.data.candidate.title) ??
                    t("matches.privateFallback")}
                </h1>
                {visibleText(query.data.candidate.subtitle) ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {visibleText(query.data.candidate.subtitle)}
                  </p>
                ) : null}
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {t(`matches.scoreBand.${query.data.candidate.scoreBand}`)}
              </span>
            </div>
            <AxisBands candidate={query.data.candidate} />
            {shouldShowExplanation(query.data.candidate) &&
            visibleText(query.data.candidate.explanation) ? (
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {visibleText(query.data.candidate.explanation)}
              </p>
            ) : null}
            <CandidateDetails candidate={query.data.candidate} />
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link
                className="font-medium text-slate-900 hover:text-slate-600"
                to={query.data.candidate.profilePath}
              >
                {t("matches.openProfile")}
              </Link>
              {query.data.candidate.manuscriptProfilePath ? (
                <Link
                  className="font-medium text-slate-900 hover:text-slate-600"
                  to={query.data.candidate.manuscriptProfilePath}
                >
                  {t("matches.openManuscript")}
                </Link>
              ) : null}
              <button
                className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400"
                disabled
                type="button"
              >
                {t("matches.step10IntroPlaceholder")}
              </button>
            </div>
          </article>
        ) : (
          <p className="mt-5 text-sm text-rose-700">{t("matches.notFound")}</p>
        )}
      </main>
    </div>
  );
}
