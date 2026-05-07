import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../api/client";
import { PlatformHeader } from "../layout/PlatformHeader";
import {
  useDecideManuscriptAccessRequest,
  useManuscriptAccessRequests,
} from "../profiles/useProfileSurfaces";

export function RequestsPage() {
  const { t } = useTranslation();
  const query = useManuscriptAccessRequests();
  const decide = useDecideManuscriptAccessRequest();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{t("requests.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {t("requests.description")}
          </p>
        </div>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
          {query.isPending ? (
            <p className="p-6 text-sm text-slate-600">{t("common.loading")}</p>
          ) : query.isError ? (
            <p className="p-6 text-sm text-rose-700">
              {getApiErrorMessage(query.error)}
            </p>
          ) : query.data.requests.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">{t("requests.empty")}</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {query.data.requests.map((request) => (
                <article
                  className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto]"
                  key={request.id}
                >
                  <div>
                    <h2 className="font-semibold">{request.manuscriptTitle}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {request.publisherName} → {request.authorName}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      {t(`requests.status.${request.status}`)}
                    </p>
                  </div>
                  {request.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            requestId: request.id,
                            decision: "approve",
                          })
                        }
                        type="button"
                      >
                        {t("requests.approve")}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
                        disabled={decide.isPending}
                        onClick={() =>
                          decide.mutate({
                            requestId: request.id,
                            decision: "reject",
                          })
                        }
                        type="button"
                      >
                        {t("requests.reject")}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
