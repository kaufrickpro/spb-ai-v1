import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MatchCandidate, MatchRunResponse } from "@marketplace/contracts";
import { matchCandidatePath } from "../routing/routes";
import {
  shouldShowExplanation,
  visibleList,
  visibleText,
} from "./matchDisplay";
import { IntroRequestAction } from "../introRequests/IntroRequestAction";

const AXES = ["premise", "voice", "arc"] as const;

export function CandidateList({ run }: { run: MatchRunResponse }) {
  if (run.candidates.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3">
      {run.candidates.map((candidate) => (
        <MatchCandidateCard
          candidate={candidate}
          detailPath={matchCandidatePath({
            matchRunId: run.run.id,
            candidateId: candidate.id,
          })}
          key={candidate.id}
        />
      ))}
    </section>
  );
}

export function MatchCandidateCard({
  candidate,
  detailPath,
}: {
  candidate: MatchCandidate;
  detailPath: string;
}) {
  const { t } = useTranslation();
  const subtitle = visibleText(candidate.subtitle);
  const explanation = visibleText(candidate.explanation);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            {t("matches.rank", { rank: candidate.rank })}
          </p>
          <h2 className="mt-1 text-base font-semibold">
            {visibleText(candidate.title) ?? t("matches.privateFallback")}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          {t(`matches.scoreBand.${candidate.scoreBand}`)}
        </span>
      </div>

      <AxisBands candidate={candidate} />

      {shouldShowExplanation(candidate) && explanation ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">{explanation}</p>
      ) : null}

      <CandidateDetails candidate={candidate} />

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
        <Link className="text-slate-600 hover:text-slate-900" to={detailPath}>
          {t("matches.details")}
        </Link>
        {candidate.introTarget ? (
          <IntroRequestAction
            introState={candidate.introState}
            manuscriptId={candidate.introTarget.manuscriptId}
            publisherProfileId={candidate.introTarget.publisherProfileId}
          />
        ) : null}
      </div>
    </article>
  );
}

export function AxisBands({ candidate }: { candidate: MatchCandidate }) {
  const { t } = useTranslation();

  return (
    <dl className="mt-4 grid gap-2 sm:grid-cols-3">
      {AXES.map((axis) => (
        <div
          className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
          key={axis}
        >
          <dt className="text-xs font-medium text-slate-500">
            {t(`matches.axis.${axis}`)}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">
            {t(`matches.scoreBand.${candidate.axisBands[axis]}`)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CandidateDetails({ candidate }: { candidate: MatchCandidate }) {
  const { t } = useTranslation();
  const fitReasons = visibleList(candidate.fitReasons);
  const riskReasons = visibleList(candidate.riskReasons);
  const safeSnippets = candidate.safeSnippets
    .map((snippet) => ({
      label: visibleText(snippet.label),
      text: visibleText(snippet.text),
    }))
    .filter(
      (snippet): snippet is { label: string; text: string } =>
        Boolean(snippet.label) && Boolean(snippet.text),
    );
  const penalties = candidate.penalties
    .map((penalty) => ({
      ...penalty,
      label: visibleText(penalty.label),
    }))
    .filter((penalty): penalty is typeof penalty & { label: string } =>
      Boolean(penalty.label),
    );

  return (
    <div className="mt-4 space-y-2">
      <DetailSection title={t("matches.fitReasons")} values={fitReasons} />
      <DetailSection title={t("matches.riskReasons")} values={riskReasons} />
      <details className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          {t("matches.penalties")}
        </summary>
        {penalties.length ? (
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {penalties.map((penalty) => (
              <li key={`${penalty.code}:${penalty.label}`}>
                <span className="font-medium">{penalty.label}</span>
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  {t(`matches.penaltySeverity.${penalty.severity}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {t("matches.noWatchOuts")}
          </p>
        )}
      </details>
      <details className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          {t("matches.safeSnippets")}
        </summary>
        {safeSnippets.length ? (
          <dl className="mt-2 space-y-3 text-sm text-slate-700">
            {safeSnippets.map((snippet) => (
              <div key={`${snippet.label}:${snippet.text}`}>
                <dt className="font-medium text-slate-900">{snippet.label}</dt>
                <dd className="mt-1 leading-6">{snippet.text}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {t("matches.noSafeSnippets")}
          </p>
        )}
      </details>
    </div>
  );
}

function DetailSection({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <details className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        {title}
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </details>
  );
}
