import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
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
        ) : query.data ? (
          <article className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">
                  {query.data.candidate.title}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {query.data.candidate.subtitle}
                </p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {t(`matches.scoreBand.${query.data.candidate.scoreBand}`)}
              </span>
            </div>
            {query.data.candidate.explanation ? (
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {query.data.candidate.explanation}
              </p>
            ) : null}
            <ReasonList
              title={t("matches.fitReasons")}
              values={query.data.candidate.fitReasons}
            />
            <ReasonList
              title={t("matches.riskReasons")}
              values={query.data.candidate.riskReasons}
            />
          </article>
        ) : (
          <p className="mt-5 text-sm text-rose-700">{t("matches.notFound")}</p>
        )}
      </main>
    </div>
  );
}

function ReasonList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </section>
  );
}
