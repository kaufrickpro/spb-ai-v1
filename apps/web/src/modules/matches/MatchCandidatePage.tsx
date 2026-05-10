import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MatchCandidateDetail } from "@marketplace/contracts";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { getApiErrorCode, getApiErrorMessage } from "../api/client";
import { AxisBands } from "./MatchCandidateSummary";
import {
  shouldShowExplanation,
  visibleList,
  visibleText,
} from "./matchDisplay";
import { useMatchCandidate } from "./useMatches";
import { IntroRequestAction } from "../introRequests/IntroRequestAction";

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
            {query.data.run.stale ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">{t("matches.staleDetailTitle")}</p>
                <p className="mt-1">{t("matches.staleDetailDescription")}</p>
                <Link
                  className="mt-2 inline-block font-medium text-amber-950 underline"
                  to={WEB_ROUTES.profileHistory}
                >
                  {t("matches.rematchFromHistory")}
                </Link>
              </div>
            ) : null}
            <DetailTabs candidate={query.data.candidate} />
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
              {query.data.candidate.introTarget ? (
                <IntroRequestAction
                  introState={query.data.candidate.introState}
                  manuscriptId={query.data.candidate.introTarget.manuscriptId}
                  publisherProfileId={
                    query.data.candidate.introTarget.publisherProfileId
                  }
                />
              ) : null}
            </div>
          </article>
        ) : (
          <p className="mt-5 text-sm text-rose-700">{t("matches.notFound")}</p>
        )}
      </main>
    </div>
  );
}

function DetailTabs({ candidate }: { candidate: MatchCandidateDetail }) {
  const { t } = useTranslation();
  const detail = candidate.detail;
  const fitReasons = visibleList(detail.evidence.fitReasons);
  const watchOuts = visibleList(detail.evidence.watchOuts);
  const snippets = detail.evidence.safeSnippets
    .map((snippet) => ({
      ...snippet,
      label: visibleText(snippet.label),
      text: visibleText(snippet.text),
    }))
    .filter(
      (snippet): snippet is typeof snippet & { label: string; text: string } =>
        Boolean(snippet.label) && Boolean(snippet.text),
    );

  return (
    <div className="mt-5 space-y-5">
      <nav className="flex flex-wrap gap-2 text-xs font-semibold uppercase text-slate-500">
        <span>{t("matches.detailTabs.overview")}</span>
        <span>{t("matches.detailTabs.comparison")}</span>
        <span>{t("matches.detailTabs.evidence")}</span>
        <span>{t("matches.detailTabs.watchOuts")}</span>
      </nav>

      <section className="rounded-md border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t("matches.detailTabs.overview")}
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <DetailValue
            label={t("matches.detail.publisher")}
            value={detail.pair.publisherName}
          />
          <DetailValue
            label={t("matches.detail.manuscript")}
            value={detail.pair.manuscriptTitle}
          />
          <DetailValue
            label={t("matches.detail.genre")}
            value={detail.manuscriptContext?.genre ?? null}
          />
          <DetailValue
            label={t("matches.detail.form")}
            value={detail.manuscriptContext?.manuscriptForm ?? null}
          />
        </dl>
        <DetailSection title={t("matches.fitReasons")} values={fitReasons} />
      </section>

      <section className="rounded-md border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t("matches.detailTabs.comparison")}
        </h2>
        {detail.comparison.length ? (
          <div className="mt-3 divide-y divide-slate-100">
            {detail.comparison.map((row) => (
              <div
                className="grid gap-2 py-3 text-sm sm:grid-cols-4"
                key={row.key}
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {t(`matches.comparison.${row.key}`)}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(row.noteCode, row.noteParams)}
                  </p>
                </div>
                <span>{t(`matches.comparisonStatus.${row.status}`)}</span>
                <span className="text-slate-600">
                  {row.manuscriptValues.join(", ") || t("matches.unknown")}
                </span>
                <span className="text-slate-600">
                  {row.publisherValues.join(", ") || t("matches.unknown")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {t("matches.noComparison")}
          </p>
        )}
      </section>

      <section className="rounded-md border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t("matches.detailTabs.evidence")}
        </h2>
        <div className="mt-3 grid gap-3">
          {(["premise", "voice", "arc"] as const).map((axis) => {
            const evidence = detail.axisEvidence[axis];
            return (
              <div className="rounded border border-slate-100 p-3" key={axis}>
                <h3 className="text-sm font-semibold text-slate-900">
                  {t(`matches.axis.${axis}`)} ·{" "}
                  {t(`matches.scoreBand.${evidence.band}`)}
                </h3>
                <p className="mt-2 text-sm text-slate-700">
                  {visibleText(evidence.manuscriptSummary) ??
                    t("matches.unknown")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {visibleText(evidence.publisherSummary) ??
                    t("matches.unknown")}
                </p>
              </div>
            );
          })}
        </div>
        {snippets.length ? (
          <dl className="mt-4 space-y-3 text-sm">
            {snippets.map((snippet) => (
              <div
                key={`${snippet.sourceType}:${snippet.label}:${snippet.text}`}
              >
                <dt className="font-medium text-slate-900">
                  {snippet.label} ·{" "}
                  {t(`matches.sourceType.${snippet.sourceType}`)}
                </dt>
                <dd className="mt-1 leading-6 text-slate-700">
                  {snippet.text}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section className="rounded-md border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {t("matches.detailTabs.watchOuts")}
        </h2>
        <DetailSection title={t("matches.riskReasons")} values={watchOuts} />
        <DetailSection
          title={t("matches.limitations")}
          values={detail.limitations.map((item) =>
            t(`matches.limitation.${item}`),
          )}
        />
      </section>
    </div>
  );
}

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-800">
        {visibleText(value) ?? t("matches.unknown")}
      </dd>
    </div>
  );
}

function DetailSection({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
