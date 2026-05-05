import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { AdminShell } from "./AdminShell";
import { webApiClient } from "../api/client";

export function AdminTrustSafetyPage() {
  const { t, i18n } = useTranslation();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );

  const trustQuery = useQuery({
    queryKey: ["admin", "trust-safety"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.trustSafety),
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
            {t("admin.trust.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.trust.pageDescription")}
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.trust.pendingProfiles")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {trustQuery.data?.summary.pendingProfiles ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.trust.flaggedProfiles")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {trustQuery.data?.summary.flaggedProfiles ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.trust.rejectedProfiles")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {trustQuery.data?.summary.rejectedProfiles ?? "-"}
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {trustQuery.isPending ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("common.loading")}
            </div>
          ) : (trustQuery.data?.signals?.length ?? 0) === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("admin.trust.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.trust.signal")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.trust.severity")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.trust.status")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.trust.created")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(trustQuery.data?.signals ?? []).map((signal) => (
                    <tr key={signal.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {t(`admin.trustSignalTypes.${signal.signalType}`)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {signal.note}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t(`admin.riskLevels.${signal.severity}`)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t(`admin.trustStatuses.${signal.status}`)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {dateFormatter.format(new Date(signal.createdAt))}
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
