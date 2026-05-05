import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { AdminShell } from "./AdminShell";
import { webApiClient } from "../api/client";

export function AdminPaymentsPage() {
  const { t, i18n } = useTranslation();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments-health"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.paymentsHealth),
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
            {t("admin.payments.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.payments.pageDescription")}
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.payments.summaryFailures")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {paymentsQuery.data?.summary.recentFailures ?? "-"}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.payments.summaryLastEvent")}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {paymentsQuery.data?.summary.lastEventAt
                ? dateFormatter.format(
                    new Date(paymentsQuery.data.summary.lastEventAt),
                  )
                : "—"}
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {paymentsQuery.isPending ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("common.loading")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.payments.event")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.payments.status")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.payments.time")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(paymentsQuery.data?.events ?? []).map((event) => (
                    <tr key={event.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {event.eventType}
                        </div>
                        <div className="text-xs text-slate-500">
                          {event.provider}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t(`admin.paymentStatuses.${event.status}`)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {dateFormatter.format(new Date(event.occurredAt))}
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
