import type {
  AdminDashboardResponse,
  AdminJobHealthResponse,
  AdminPaymentHealthResponse,
  AdminTrustSafetyResponse,
} from "@marketplace/contracts";
import { Link } from "react-router-dom";
import { WEB_ROUTES } from "../routing/routes";

type DashboardSummary = AdminDashboardResponse["summary"];

const adminSectionLinks = [
  { to: WEB_ROUTES.adminReviews, key: "reviews" },
  { to: WEB_ROUTES.adminTrustSafety, key: "trustSafety" },
  { to: WEB_ROUTES.adminJobs, key: "jobs" },
  { to: WEB_ROUTES.adminPayments, key: "payments" },
  { to: WEB_ROUTES.adminAuditLogs, key: "auditLogs" },
  { to: WEB_ROUTES.adminSettings, key: "settings" },
] as const;

type T = (key: string, options?: Record<string, unknown>) => string;

export function AdminQuickNav({ t }: { t: T }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">{t("admin.quickNav")}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {adminSectionLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            {t(`adminNav.${item.key}`)}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function AdminSummaryCards({
  dashboard,
  t,
}: {
  dashboard: DashboardSummary | undefined;
  t: T;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        label={t("admin.cards.reviewQueue")}
        value={dashboard?.exceptionQueues.needsReview ?? "-"}
        detail={t("admin.cards.highRisk", {
          count: dashboard?.reviewQueue.highRiskCount ?? 0,
        })}
      />
      <SummaryCard
        label={t("admin.cards.quarantine")}
        value={dashboard?.exceptionQueues.quarantine ?? "-"}
        detail={t("admin.exceptionQueues.quarantine")}
      />
      <SummaryCard
        label={t("admin.cards.systemFailures")}
        value={dashboard?.exceptionQueues.systemFailures ?? "-"}
        detail={t("admin.cards.failures")}
      />
      <SummaryCard
        label={t("admin.cards.autoApprovalRate")}
        value={
          dashboard
            ? `${Math.round(dashboard.automationHealth.autoApprovalRate * 100)}%`
            : "-"
        }
        detail={t("admin.reviewOutcomes.auto_approved")}
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </article>
  );
}

export function AdminHealthTables({
  jobs,
  payments,
  t,
}: {
  jobs: AdminJobHealthResponse | undefined;
  payments: AdminPaymentHealthResponse | undefined;
  t: T;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("admin.jobs.title")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t("admin.jobs.type")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("admin.jobs.status")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("admin.jobs.updated")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(jobs?.runs ?? []).map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{run.jobType}</td>
                  <td className="px-3 py-2">{run.status}</td>
                  <td className="px-3 py-2">
                    {new Date(run.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">{t("admin.payments.title")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t("admin.payments.event")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("admin.payments.status")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("admin.payments.time")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(payments?.events ?? []).map((event) => (
                <tr key={event.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{event.eventType}</td>
                  <td className="px-3 py-2">{event.status}</td>
                  <td className="px-3 py-2">
                    {new Date(event.occurredAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export function AdminTrustTable({
  trust,
  t,
}: {
  trust: AdminTrustSafetyResponse | undefined;
  t: T;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">{t("admin.trust.title")}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("admin.trust.signal")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("admin.trust.severity")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("admin.trust.status")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("admin.trust.created")}
              </th>
            </tr>
          </thead>
          <tbody>
            {(trust?.signals ?? []).map((signal) => (
              <tr key={signal.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{signal.signalType}</td>
                <td className="px-3 py-2">{signal.severity}</td>
                <td className="px-3 py-2">{signal.status}</td>
                <td className="px-3 py-2">
                  {new Date(signal.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {(trust?.signals ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  {t("admin.trust.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminAuditTable({
  dashboard,
  t,
}: {
  dashboard: DashboardSummary | undefined;
  t: T;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">{t("admin.audit.title")}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("admin.audit.action")}
              </th>
              <th className="px-3 py-2 font-medium">
                {t("admin.audit.target")}
              </th>
              <th className="px-3 py-2 font-medium">{t("admin.audit.when")}</th>
            </tr>
          </thead>
          <tbody>
            {(dashboard?.recentAuditLogs ?? []).map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{log.action}</td>
                <td className="px-3 py-2">
                  {log.targetType}:{log.targetId}
                </td>
                <td className="px-3 py-2">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {(dashboard?.recentAuditLogs ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-4 text-center text-slate-500"
                >
                  {t("admin.audit.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
