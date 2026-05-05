import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { AdminShell } from "./AdminShell";
import { getApiErrorMessage, webApiClient } from "../api/client";

export function AdminJobsPage() {
  const { t, i18n } = useTranslation();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );

  const jobsQuery = useQuery({
    queryKey: ["admin", "jobs-health"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.jobsHealth),
    retry: false,
  });

  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("admin.jobs.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.jobs.pageDescription")}
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.jobs.summaryQueued")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {jobsQuery.data?.summary.queued ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.jobs.summaryRunning")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {jobsQuery.data?.summary.running ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.jobs.summaryFailed")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {jobsQuery.data?.summary.failed ?? "-"}
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {jobsQuery.isPending ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("common.loading")}
            </div>
          ) : jobsQuery.isError ? (
            <div
              role="alert"
              className="px-4 py-8 text-sm font-medium text-rose-700"
            >
              {getApiErrorMessage(jobsQuery.error)}
            </div>
          ) : (jobsQuery.data?.runs.length ?? 0) === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("admin.jobs.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.jobs.type")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.jobs.status")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.jobs.updated")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(jobsQuery.data?.runs ?? []).map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {t(`admin.jobTypes.${run.jobType}`)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {run.source}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t(`admin.jobStatuses.${run.status}`)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {dateFormatter.format(new Date(run.updatedAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
