import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminShell } from "./AdminShell";
import { getApiErrorMessage } from "../api/client";
import {
  useAdminIntroRequestDetail,
  useAdminIntroRequests,
} from "../introRequests/useIntroRequests";

export function AdminIntroRequestsPage() {
  const { t, i18n } = useTranslation();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const query = useAdminIntroRequests();
  const detailQuery = useAdminIntroRequestDetail(selectedRequestId);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );

  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("admin.introRequests.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.introRequests.description")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            {query.isPending ? (
              <div className="px-4 py-8 text-sm text-slate-600">
                {t("common.loading")}
              </div>
            ) : query.isError ? (
              <div className="px-4 py-8 text-sm font-medium text-rose-700">
                {getApiErrorMessage(query.error)}
              </div>
            ) : query.data.requests.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-600">
                {t("admin.introRequests.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        {t("admin.introRequests.pair")}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t("admin.introRequests.status")}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t("admin.introRequests.unlock")}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t("admin.introRequests.created")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {query.data.requests.map((request) => (
                      <tr
                        className={
                          selectedRequestId === request.id
                            ? "bg-emerald-50/60"
                            : undefined
                        }
                        key={request.id}
                      >
                        <td className="px-4 py-3">
                          <button
                            className="text-left font-medium text-slate-900 hover:text-emerald-700"
                            onClick={() => setSelectedRequestId(request.id)}
                            type="button"
                          >
                            {request.manuscriptTitle}
                          </button>
                          <div className="text-xs text-slate-500">
                            {request.authorName} / {request.publisherName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {t(`requests.status.${request.status}`)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {request.currentUnlockStatus.contact
                            ? t("admin.introRequests.unlocked")
                            : t("admin.introRequests.locked")}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {dateFormatter.format(new Date(request.createdAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              {t("admin.introRequests.detail")}
            </h2>
            {!selectedRequestId ? (
              <p className="mt-3 text-sm text-slate-600">
                {t("admin.introRequests.select")}
              </p>
            ) : detailQuery.isPending ? (
              <p className="mt-3 text-sm text-slate-600">
                {t("common.loading")}
              </p>
            ) : detailQuery.isError ? (
              <p className="mt-3 text-sm font-medium text-rose-700">
                {getApiErrorMessage(detailQuery.error)}
              </p>
            ) : detailQuery.data ? (
              <div className="mt-4 space-y-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-slate-500">
                      {t("admin.introRequests.status")}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {t(`requests.status.${detailQuery.data.request.status}`)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {t("admin.introRequests.responded")}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {detailQuery.data.request.respondedAt
                        ? dateFormatter.format(
                            new Date(detailQuery.data.request.respondedAt),
                          )
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {t("admin.introRequests.contact")}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {detailQuery.data.request.currentUnlockStatus.contact
                        ? t("admin.introRequests.unlocked")
                        : t("admin.introRequests.locked")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      {t("admin.introRequests.sample")}
                    </dt>
                    <dd className="font-medium text-slate-900">
                      {detailQuery.data.request.currentUnlockStatus
                        .publisherSample
                        ? t("admin.introRequests.unlocked")
                        : t("admin.introRequests.locked")}
                    </dd>
                  </div>
                </dl>
                <div>
                  <h3 className="font-medium text-slate-900">
                    {t("admin.introRequests.timeline")}
                  </h3>
                  <div className="mt-2 space-y-3">
                    {detailQuery.data.timeline.map((event) => (
                      <div
                        className="rounded-md border border-slate-200 p-3"
                        key={event.id}
                      >
                        <div className="font-medium text-slate-900">
                          {event.action}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {dateFormatter.format(new Date(event.createdAt))}
                        </div>
                        <pre className="mt-2 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </AdminShell>
  );
}
