import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiRoutes,
  type AdminExceptionQueue,
  type AdminEntityType,
  type AdminReviewQueueItem,
  type AdminReviewStatus,
} from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { AdminShell } from "./AdminShell";
import { getApiErrorMessage, webApiClient } from "../api/client";

type ReviewFilter = "all" | AdminEntityType;

const reviewFilters: Array<{ value: ReviewFilter; labelKey: string }> = [
  { value: "all", labelKey: "admin.tabs.all" },
  { value: "profile", labelKey: "admin.tabs.profile" },
  { value: "manuscript", labelKey: "admin.tabs.manuscript" },
  { value: "document", labelKey: "admin.tabs.document" },
  { value: "publisher_change_request", labelKey: "admin.tabs.publisherChange" },
];

const reviewStatuses: Array<{
  value: "all" | AdminReviewStatus;
  labelKey: string;
}> = [
  { value: "all", labelKey: "admin.reviewFilters.statusAll" },
  { value: "pending", labelKey: "admin.reviewStatuses.pending" },
  { value: "approved", labelKey: "admin.reviewStatuses.approved" },
  { value: "rejected", labelKey: "admin.reviewStatuses.rejected" },
] as const;

const exceptionQueues: Array<{
  value: "all" | AdminExceptionQueue;
  labelKey: string;
}> = [
  { value: "all", labelKey: "admin.reviewFilters.queueAll" },
  { value: "needs_review", labelKey: "admin.exceptionQueues.needs_review" },
  { value: "quarantine", labelKey: "admin.exceptionQueues.quarantine" },
  { value: "reports", labelKey: "admin.exceptionQueues.reports" },
  {
    value: "system_failures",
    labelKey: "admin.exceptionQueues.system_failures",
  },
] as const;

export function AdminProfileReviewsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all");
  const [activeStatus, setActiveStatus] = useState<"all" | AdminReviewStatus>(
    "pending",
  );
  const [activeQueue, setActiveQueue] = useState<"all" | AdminExceptionQueue>(
    "all",
  );
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage === "en" ? "en" : "tr", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [i18n.resolvedLanguage],
  );

  const queueQuery = useQuery({
    queryKey: ["admin", "reviews", activeFilter, activeStatus, activeQueue],
    queryFn: () =>
      webApiClient.request(ApiRoutes.admin.reviewQueue, {
        query: {
          ...(activeFilter === "all" ? {} : { entityType: activeFilter }),
          ...(activeStatus === "all" ? {} : { status: activeStatus }),
          ...(activeQueue === "all" ? {} : { exceptionQueue: activeQueue }),
        },
      }),
    retry: false,
  });

  const reviews = queueQuery.data?.reviews ?? [];
  const selectedReview =
    reviews.find((review) => review.id === selectedReviewId) ??
    reviews[0] ??
    null;

  const detailQuery = useQuery({
    queryKey: ["admin", "review-detail", selectedReview?.id],
    queryFn: () =>
      webApiClient.request(ApiRoutes.admin.reviewDetail, {
        params: { reviewId: selectedReview!.id },
      }),
    enabled: Boolean(selectedReview?.id),
    retry: false,
  });

  const decisionMutation = useMutation({
    mutationFn: async (input: {
      decision: "approved" | "rejected" | "quarantined" | "restored";
      review: AdminReviewQueueItem;
    }) =>
      webApiClient.request(ApiRoutes.admin.reviewDecision, {
        params: { reviewId: input.review.id },
        body: {
          decision: input.decision,
          internalNote:
            input.decision === "approved" ? undefined : rejectionNote.trim(),
        },
      }),
    onSuccess: async () => {
      setActionError(null);
      setRejectionNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "review-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "trust-safety"] }),
      ]);
    },
    onError: (error) => {
      setActionError(getApiErrorMessage(error));
    },
  });

  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("admin.reviews.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("admin.reviews.subtitle")}
          </p>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {reviewFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  data-active={activeFilter === filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {exceptionQueues.map((queue) => (
                <button
                  key={queue.value}
                  type="button"
                  data-active={activeQueue === queue.value}
                  onClick={() => setActiveQueue(queue.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
                >
                  {t(queue.labelKey)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {reviewStatuses.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  data-active={activeStatus === status.value}
                  onClick={() => setActiveStatus(status.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
                >
                  {t(status.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {actionError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">
                  {t("admin.queue.title")}
                </h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {t("admin.reviews.count", { count: reviews.length })}
                </span>
              </div>
            </header>

            {queueQuery.isPending ? (
              <div className="px-4 py-8 text-sm text-slate-600">
                {t("common.loading")}
              </div>
            ) : queueQuery.isError ? (
              <div
                role="alert"
                className="px-4 py-8 text-sm font-medium text-rose-700"
              >
                {getApiErrorMessage(queueQuery.error)}
              </div>
            ) : reviews.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-600">
                {t("admin.queue.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
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
                      <th className="px-4 py-3 font-medium text-right">
                        {t("admin.queue.action")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reviews.map((review) => {
                      const isSelected = selectedReview?.id === review.id;
                      return (
                        <tr
                          key={review.id}
                          className={isSelected ? "bg-amber-50/50" : "bg-white"}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {review.summary}
                            </div>
                            <div className="text-xs text-slate-500">
                              {t(`admin.entityTypes.${review.entityType}`)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {t(
                              `admin.exceptionQueues.${review.exceptionQueue}`,
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {t(
                              `admin.eligibilityStatuses.${review.eligibilityStatus}`,
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {t(`admin.riskLevels.${review.riskLevel}`)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {dateFormatter.format(new Date(review.submittedAt))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReviewId(review.id)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {t("admin.queue.open")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold">
              {t("admin.detail.title")}
            </h2>

            {!selectedReview ? (
              <p className="mt-4 text-sm text-slate-600">
                {t("admin.detail.empty")}
              </p>
            ) : detailQuery.isPending ? (
              <p className="mt-4 text-sm text-slate-600">
                {t("common.loading")}
              </p>
            ) : detailQuery.isError ? (
              <p
                role="alert"
                className="mt-4 text-sm font-medium text-rose-700"
              >
                {getApiErrorMessage(detailQuery.error)}
              </p>
            ) : detailQuery.data ? (
              <div className="mt-4 space-y-5">
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.queue.eligibility")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      {t(
                        `admin.exceptionQueues.${detailQuery.data.review.exceptionQueue}`,
                      )}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      {t(
                        `admin.eligibilityStatuses.${detailQuery.data.review.eligibilityStatus}`,
                      )}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                      {t(
                        `admin.reviewOutcomes.${detailQuery.data.review.reviewOutcome}`,
                      )}
                    </span>
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.detail.summary")}
                  </p>
                  <p className="mt-2 text-sm text-slate-900">
                    {detailQuery.data.review.summary}
                  </p>
                </section>

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.detail.submittedFields")}
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                    {JSON.stringify(detailQuery.data.submittedFields, null, 2)}
                  </pre>
                </section>

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.detail.riskWarnings")}
                  </p>
                  <div className="mt-2 space-y-2">
                    {detailQuery.data.riskWarnings.length > 0 ? (
                      detailQuery.data.riskWarnings.map((warning) => (
                        <div
                          key={warning}
                          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                        >
                          {warning}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">
                        {t("admin.detail.none")}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.detail.auditHistory")}
                  </p>
                  <div className="mt-2 space-y-2">
                    {detailQuery.data.auditHistory.length > 0 ? (
                      detailQuery.data.auditHistory.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                        >
                          <p className="font-medium text-slate-900">
                            {entry.action}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {dateFormatter.format(new Date(entry.createdAt))}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">
                        {t("admin.detail.none")}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("admin.detail.rejectionNote")}
                  </label>
                  <textarea
                    value={rejectionNote}
                    onChange={(event) => setRejectionNote(event.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </section>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      decisionMutation.mutate({
                        decision: "approved",
                        review: selectedReview,
                      })
                    }
                    disabled={decisionMutation.isPending}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("admin.detail.approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      decisionMutation.mutate({
                        decision: "rejected",
                        review: selectedReview,
                      })
                    }
                    disabled={decisionMutation.isPending}
                    className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("admin.detail.reject")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      decisionMutation.mutate({
                        decision: "quarantined",
                        review: selectedReview,
                      })
                    }
                    disabled={decisionMutation.isPending}
                    className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("admin.detail.quarantine")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      decisionMutation.mutate({
                        decision: "restored",
                        review: selectedReview,
                      })
                    }
                    disabled={decisionMutation.isPending}
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("admin.detail.restore")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                {t("admin.detail.empty")}
              </p>
            )}
          </aside>
        </section>
      </main>
    </AdminShell>
  );
}
