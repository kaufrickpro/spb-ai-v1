import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { AdminShell } from "./AdminShell";
import { webApiClient } from "../api/client";

export function AdminAuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );

  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.auditLogs),
    retry: false,
  });

  const logs = (auditQuery.data?.logs ?? []).filter((log) => {
    const matchesAction =
      actionFilter.trim().length === 0 ||
      log.action.includes(actionFilter.trim());
    const matchesTarget =
      targetFilter.trim().length === 0 ||
      log.targetType.includes(targetFilter.trim()) ||
      log.targetId.includes(targetFilter.trim());
    return matchesAction && matchesTarget;
  });

  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("admin.audit.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.audit.pageDescription")}
          </p>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              placeholder={t("admin.audit.filterAction")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
              placeholder={t("admin.audit.filterTarget")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {auditQuery.isPending ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("common.loading")}
            </div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              {t("admin.audit.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.audit.action")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.audit.target")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.audit.actor")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("admin.audit.when")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {t(`admin.entityTypes.${log.targetType}`)} ·{" "}
                        {log.targetId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {log.actorUserId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {dateFormatter.format(new Date(log.createdAt))}
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
