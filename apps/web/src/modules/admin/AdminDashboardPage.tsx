import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiRoutes, type AdminEntityType } from "@marketplace/contracts";
import { Link } from "react-router-dom";
import {
  getApiErrorCode,
  getApiErrorMessage,
  webApiClient,
} from "../api/client";
import { WEB_ROUTES } from "../routing/routes";
import { AdminShell } from "./AdminShell";

type DecisionInput = {
  decision: "approved" | "rejected";
  rejectionNote?: string;
};

type ReviewTab = "all" | AdminEntityType;
type Translate = ReturnType<typeof useTranslation>["t"];

const reviewTabs: Array<{ value: ReviewTab; labelKey: string }> = [
  { value: "all", labelKey: "admin.tabs.all" },
  { value: "profile", labelKey: "admin.tabs.profile" },
  { value: "manuscript", labelKey: "admin.tabs.manuscript" },
  { value: "document", labelKey: "admin.tabs.document" },
  { value: "publisher_change_request", labelKey: "admin.tabs.publisherChange" },
];

const adminSectionLinks = [
  { to: WEB_ROUTES.adminReviews, key: "reviews" },
  { to: WEB_ROUTES.adminTrustSafety, key: "trustSafety" },
  { to: WEB_ROUTES.adminJobs, key: "jobs" },
  { to: WEB_ROUTES.adminPayments, key: "payments" },
  { to: WEB_ROUTES.adminAuditLogs, key: "auditLogs" },
  { to: WEB_ROUTES.adminSettings, key: "settings" },
] as const;

function formatReviewSummary(summary: string, t: Translate) {
  const manuscriptMatch = summary.match(/^New manuscript submitted: (.+)$/);
  if (manuscriptMatch) {
    return t("admin.queue.summaries.newManuscript", {
      title: manuscriptMatch[1],
    });
  }

  return summary;
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ReviewTab>("all");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "short",
        timeStyle: "medium",
      }),
    [i18n.resolvedLanguage],
  );

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.dashboard),
    retry: false,
  });

  const queueQuery = useQuery({
    queryKey: ["admin", "reviews", activeTab],
    queryFn: () =>
      webApiClient.request(ApiRoutes.admin.reviewQueue, {
        query:
          activeTab === "all"
            ? {}
            : {
                entityType: activeTab,
              },
      }),
    retry: false,
  });

  const jobsQuery = useQuery({
    queryKey: ["admin", "jobs-health"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.jobsHealth),
    retry: false,
  });

  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments-health"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.paymentsHealth),
    retry: false,
  });

  const trustSafetyQuery = useQuery({
    queryKey: ["admin", "trust-safety"],
    queryFn: () => webApiClient.request(ApiRoutes.admin.trustSafety),
    retry: false,
  });

  useEffect(() => {
    if (!queueQuery.data?.reviews?.length) {
      setSelectedReviewId(null);
      setIsDrawerOpen(false);
      return;
    }

    const exists = queueQuery.data.reviews.some(
      (review) => review.id === selectedReviewId,
    );
    if (!exists) {
      setSelectedReviewId(queueQuery.data.reviews[0].id);
    }
  }, [queueQuery.data, selectedReviewId]);

  const detailQuery = useQuery({
    queryKey: ["admin", "review", selectedReviewId],
    queryFn: () =>
      webApiClient.request(ApiRoutes.admin.reviewDetail, {
        params: { reviewId: selectedReviewId! },
      }),
    enabled: Boolean(selectedReviewId) && isDrawerOpen,
    retry: false,
  });

  const reviewDecisionMutation = useMutation({
    mutationFn: async (input: DecisionInput) => {
      if (!selectedReviewId) throw new Error("No review selected");
      return webApiClient.request(ApiRoutes.admin.reviewDecision, {
        params: { reviewId: selectedReviewId },
        body: input,
      });
    },
    onSuccess: async () => {
      setActionError(null);
      setRejectionNote("");
      setIsDrawerOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "jobs-health"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin", "payments-health"],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin", "trust-safety"] }),
      ]);
    },
    onError: (error) => {
      setActionError(getApiErrorMessage(error));
    },
  });

  const dashboardErrorCode = getApiErrorCode(dashboardQuery.error);
  if (dashboardErrorCode === "forbidden") {
    return (
      <AdminShell>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <h1 className="text-lg font-semibold">
              {t("admin.forbidden.title")}
            </h1>
            <p className="mt-1 text-sm">{t("admin.forbidden.description")}</p>
          </div>
        </main>
      </AdminShell>
    );
  }

  const dashboard = dashboardQuery.data?.summary;
  const queue = queueQuery.data?.reviews ?? [];
  const reviewDetail = detailQuery.data;
  const jobs = jobsQuery.data;
  const payments = paymentsQuery.data;
  const trust = trustSafetyQuery.data;

  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{t("admin.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("admin.subtitle")}</p>
        </div>

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.cards.reviewQueue")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {dashboard?.exceptionQueues.needsReview ?? "-"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("admin.cards.highRisk", {
                count: dashboard?.reviewQueue.highRiskCount ?? 0,
              })}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.cards.quarantine")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {dashboard?.exceptionQueues.quarantine ?? "-"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("admin.exceptionQueues.quarantine")}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.cards.systemFailures")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {dashboard?.exceptionQueues.systemFailures ?? "-"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("admin.cards.failures")}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("admin.cards.autoApprovalRate")}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {dashboard
                ? `${Math.round(dashboard.automationHealth.autoApprovalRate * 100)}%`
                : "-"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("admin.reviewOutcomes.auto_approved")}
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">
              {t("admin.queue.title")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  data-active={activeTab === tab.value}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
                  onClick={() => setActiveTab(tab.value)}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("admin.queue.entity")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("admin.queue.queue")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("admin.queue.eligibility")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("admin.queue.risk")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("admin.queue.submitted")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("admin.queue.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {queueQuery.isPending ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      {t("common.loading")}
                    </td>
                  </tr>
                ) : queueQuery.isError ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center font-medium text-rose-700"
                    >
                      {getApiErrorMessage(queueQuery.error)}
                    </td>
                  </tr>
                ) : queue.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      {t("admin.queue.empty")}
                    </td>
                  </tr>
                ) : (
                  queue.map((review) => (
                    <tr
                      key={review.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {t(`admin.entityTypes.${review.entityType}`)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatReviewSummary(review.summary, t)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {t(`admin.exceptionQueues.${review.exceptionQueue}`)}
                      </td>
                      <td className="px-4 py-3">
                        {t(
                          `admin.eligibilityStatuses.${review.eligibilityStatus}`,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t(`admin.riskLevels.${review.riskLevel}`)}
                      </td>
                      <td className="px-4 py-3">
                        {dateFormatter.format(new Date(review.submittedAt))}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                          onClick={() => {
                            setSelectedReviewId(review.id);
                            setIsDrawerOpen(true);
                            setActionError(null);
                          }}
                        >
                          {t("admin.queue.open")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

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
            <h2 className="text-base font-semibold">
              {t("admin.payments.title")}
            </h2>
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
                  <th className="px-3 py-2 font-medium">
                    {t("admin.audit.when")}
                  </th>
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
      </main>

      {isDrawerOpen && selectedReviewId ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
          <button
            aria-label={t("admin.detail.close")}
            className="h-full flex-1"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {t("admin.detail.title")}
              </h2>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                onClick={() => setIsDrawerOpen(false)}
              >
                {t("admin.detail.close")}
              </button>
            </div>

            {reviewDetail ? (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="font-medium text-slate-700">
                    {t("admin.detail.summary")}
                  </p>
                  <p className="mt-1 text-slate-900">
                    {reviewDetail.review.summary}
                  </p>
                </div>

                <div>
                  <p className="font-medium text-slate-700">
                    {t("admin.detail.submittedFields")}
                  </p>
                  <pre className="mt-1 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                    {JSON.stringify(reviewDetail.submittedFields, null, 2)}
                  </pre>
                </div>

                <div>
                  <p className="font-medium text-slate-700">
                    {t("admin.detail.riskWarnings")}
                  </p>
                  <ul className="mt-1 space-y-1 text-slate-900">
                    {reviewDetail.riskWarnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                    {reviewDetail.riskWarnings.length === 0 ? (
                      <li className="text-slate-500">
                        {t("admin.detail.none")}
                      </li>
                    ) : null}
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-slate-700">
                    {t("admin.detail.relatedEvents")}
                  </p>
                  <ul className="mt-1 space-y-1 text-slate-900">
                    {reviewDetail.relatedEvents.map((event) => (
                      <li key={`${event.label}-${event.createdAt}`}>
                        {event.label} (
                        {new Date(event.createdAt).toLocaleString()})
                      </li>
                    ))}
                    {reviewDetail.relatedEvents.length === 0 ? (
                      <li className="text-slate-500">
                        {t("admin.detail.none")}
                      </li>
                    ) : null}
                  </ul>
                </div>

                <div>
                  <p className="font-medium text-slate-700">
                    {t("admin.detail.auditHistory")}
                  </p>
                  <ul className="mt-1 space-y-1 text-slate-900">
                    {reviewDetail.auditHistory.map((entry) => (
                      <li key={entry.id}>
                        {entry.action} (
                        {new Date(entry.createdAt).toLocaleString()})
                      </li>
                    ))}
                    {reviewDetail.auditHistory.length === 0 ? (
                      <li className="text-slate-500">
                        {t("admin.detail.none")}
                      </li>
                    ) : null}
                  </ul>
                </div>

                <label className="block">
                  <span className="font-medium text-slate-700">
                    {t("admin.detail.rejectionNote")}
                  </span>
                  <textarea
                    className="mt-1 h-24 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    value={rejectionNote}
                    onChange={(event) => setRejectionNote(event.target.value)}
                  />
                </label>

                {actionError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    {actionError}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-emerald-700 px-3 py-2 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={reviewDecisionMutation.isPending}
                    onClick={() =>
                      reviewDecisionMutation.mutate({ decision: "approved" })
                    }
                  >
                    {t("admin.detail.approve")}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-rose-700 px-3 py-2 font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={reviewDecisionMutation.isPending}
                    onClick={() =>
                      reviewDecisionMutation.mutate({
                        decision: "rejected",
                        rejectionNote,
                      })
                    }
                  >
                    {t("admin.detail.reject")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {detailQuery.isPending
                  ? t("common.loading")
                  : t("admin.detail.empty")}
              </p>
            )}
          </aside>
        </div>
      ) : null}
    </AdminShell>
  );
}
