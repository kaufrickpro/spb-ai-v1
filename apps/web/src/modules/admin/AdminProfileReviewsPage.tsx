import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiRoutes,
  type AdminExceptionQueue,
  type AdminReviewQueueItem,
  type AdminReviewStatus,
} from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage, webApiClient } from "../api/client";
import { AdminShell } from "./AdminShell";
import { AdminPageHeader } from "./AdminPageHeader";
import { FilterButtonGroup } from "./AdminReviewControls";
import {
  adminExceptionQueues,
  adminReviewFilters,
  type AdminReviewFilter,
  adminReviewStatuses,
} from "./adminReviewConfig";
import { AdminReviewDetailPanel } from "./AdminReviewDetailPanel";
import { AdminReviewQueueTable } from "./AdminReviewQueueTable";

type ReviewDecision = "approved" | "rejected" | "quarantined" | "restored";

export function AdminProfileReviewsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<AdminReviewFilter>("all");
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
      decision: ReviewDecision;
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
        <AdminPageHeader
          kicker={t("app.kicker")}
          title={t("admin.reviews.title")}
          subtitle={t("admin.reviews.subtitle")}
        />

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <FilterButtonGroup
              options={adminReviewFilters}
              activeValue={activeFilter}
              onChange={setActiveFilter}
              t={t}
            />
            <FilterButtonGroup
              options={adminExceptionQueues}
              activeValue={activeQueue}
              onChange={setActiveQueue}
              t={t}
            />
            <FilterButtonGroup
              options={adminReviewStatuses}
              activeValue={activeStatus}
              onChange={setActiveStatus}
              t={t}
            />
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

            <AdminReviewQueueTable
              reviews={reviews}
              isPending={queueQuery.isPending}
              isError={queueQuery.isError}
              errorMessage={
                queueQuery.error ? getApiErrorMessage(queueQuery.error) : null
              }
              dateFormatter={dateFormatter}
              selectedReviewId={selectedReview?.id}
              onOpenReview={setSelectedReviewId}
              t={t}
              emptyClassName="px-4 py-8 text-sm text-slate-600"
              actionAlign="right"
            />
          </div>

          <AdminReviewDetailPanel
            selectedReview={selectedReview}
            detail={detailQuery.data}
            isPending={detailQuery.isPending}
            isError={detailQuery.isError}
            errorMessage={
              detailQuery.error ? getApiErrorMessage(detailQuery.error) : null
            }
            rejectionNote={rejectionNote}
            onRejectionNoteChange={setRejectionNote}
            onDecision={(decision, review) =>
              decisionMutation.mutate({ decision, review })
            }
            isDecisionPending={decisionMutation.isPending}
            dateFormatter={dateFormatter}
            t={t}
          />
        </section>
      </main>
    </AdminShell>
  );
}
