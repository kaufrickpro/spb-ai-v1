import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Manuscript } from "@marketplace/contracts";
import { PlatformHeader } from "../layout/PlatformHeader";
import { getApiErrorMessage } from "../api/client";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";
import { useManuscripts } from "../manuscripts/useManuscripts";
import { useMatchRuns, useRunMatch } from "./useMatches";
import { CandidateList } from "./MatchCandidateSummary";
import { getEntitlementDenial } from "../billing/useBilling";

export function isManuscriptMatchReady(
  manuscript: Pick<Manuscript, "eligibilityStatus" | "sampleDocumentId">,
) {
  return (
    manuscript.eligibilityStatus === "eligible" &&
    Boolean(manuscript.sampleDocumentId)
  );
}

export function resolveSelectedManuscriptId(
  manuscripts: Pick<
    Manuscript,
    "id" | "eligibilityStatus" | "sampleDocumentId"
  >[],
  selectedManuscriptId: string,
) {
  if (
    manuscripts.some((manuscript) => manuscript.id === selectedManuscriptId)
  ) {
    return selectedManuscriptId;
  }

  return (
    manuscripts.find((manuscript) => isManuscriptMatchReady(manuscript))?.id ??
    manuscripts[0]?.id ??
    ""
  );
}

export function MatchesPage() {
  const { t } = useTranslation();
  const [selectedManuscriptId, setSelectedManuscriptId] = useState("");
  const profile = useMarketplaceProfile();
  const runs = useMatchRuns();
  const runMatch = useRunMatch();
  const role = profile.data?.profile.role;
  const manuscripts = useManuscripts({ enabled: role === "author" });
  const authorManuscripts = manuscripts.data?.manuscripts ?? [];
  const activeSelectedManuscriptId = resolveSelectedManuscriptId(
    authorManuscripts,
    selectedManuscriptId,
  );
  const selectedManuscript = authorManuscripts.find(
    (manuscript) => manuscript.id === activeSelectedManuscriptId,
  );
  const selectedManuscriptReady = selectedManuscript
    ? isManuscriptMatchReady(selectedManuscript)
    : false;
  const runDenial = runMatch.isError
    ? getEntitlementDenial(runMatch.error)
    : null;

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
          {profile.isPending ? (
            <p className="text-sm text-slate-600">{t("common.loading")}</p>
          ) : profile.isError ? (
            <p className="text-sm text-rose-700">
              {getApiErrorMessage(profile.error)}
            </p>
          ) : role === "author" ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  className="text-sm font-medium text-slate-700"
                  htmlFor="match-manuscript"
                >
                  {t("matches.selectManuscript")}
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={
                    manuscripts.isPending || authorManuscripts.length === 0
                  }
                  id="match-manuscript"
                  onChange={(event) =>
                    setSelectedManuscriptId(event.target.value)
                  }
                  value={activeSelectedManuscriptId}
                >
                  {authorManuscripts.length === 0 ? (
                    <option value="">{t("matches.noManuscripts")}</option>
                  ) : null}
                  {authorManuscripts.map((manuscript) => (
                    <option key={manuscript.id} value={manuscript.id}>
                      {manuscript.title}
                    </option>
                  ))}
                </select>
                {manuscripts.isPending ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {t("common.loading")}
                  </p>
                ) : selectedManuscript && !selectedManuscriptReady ? (
                  <p className="mt-2 text-xs text-amber-700">
                    {t("matches.selectedManuscriptNotReady")}
                  </p>
                ) : null}
              </div>
              <button
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={
                  !selectedManuscript ||
                  !selectedManuscriptReady ||
                  runMatch.isPending
                }
                onClick={() =>
                  selectedManuscript &&
                  selectedManuscriptReady &&
                  runMatch.mutate({
                    direction: "author_to_publisher",
                    manuscriptId: selectedManuscript.id,
                  })
                }
                type="button"
              >
                {t("matches.runAuthor")}
              </button>
            </div>
          ) : role === "publisher" ? (
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
          ) : (
            <p className="text-sm text-slate-600">
              {t("matches.profileRequired")}
            </p>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {t("matches.step10IntroDescription")}
          </p>
          {runMatch.isError ? (
            <p className="mt-3 text-sm text-rose-700">
              {runDenial?.message ?? getApiErrorMessage(runMatch.error)}
            </p>
          ) : null}
        </section>

        {runMatch.data ? <CandidateList run={runMatch.data} /> : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold">{t("matches.history")}</h2>
          {runs.isPending ? (
            <p className="mt-3 text-sm text-slate-600">{t("common.loading")}</p>
          ) : runs.isError ? (
            <p className="mt-3 text-sm text-rose-700">
              {getApiErrorMessage(runs.error)}
            </p>
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
