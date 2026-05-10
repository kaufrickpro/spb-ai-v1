import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiRoutes } from "@marketplace/contracts";
import {
  getApiErrorCode,
  getApiErrorMessage,
  webApiClient,
} from "../api/client";
import { AdminShell } from "./AdminShell";
import {
  AdminAuditTable,
  AdminHealthTables,
  AdminQuickNav,
  AdminSummaryCards,
  AdminTrustTable,
} from "./AdminDashboardSections";
import { AdminPageHeader } from "./AdminPageHeader";
import { FilterButtonGroup } from "./AdminReviewControls";
import {
  adminReviewFilters,
  type AdminReviewFilter,
  formatReviewSummary,
} from "./adminReviewConfig";
import { AdminDashboardReviewDrawer } from "./AdminDashboardReviewDrawer";
import { AdminReviewQueueTable } from "./AdminReviewQueueTable";

type DecisionInput = {
  decision: "approved" | "rejected";
  rejectionNote?: string;
};

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminReviewFilter>("all");
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
        query: activeTab === "all" ? {} : { entityType: activeTab },
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

  return (
    <AdminShell>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AdminPageHeader
          kicker={t("app.kicker")}
          title={t("admin.title")}
          subtitle={t("admin.subtitle")}
        />

        <AdminQuickNav t={t} />
        <AdminSummaryCards dashboard={dashboard} t={t} />

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">
              {t("admin.queue.title")}
            </h2>
            <div className="mt-3">
              <FilterButtonGroup
                options={adminReviewFilters}
                activeValue={activeTab}
                onChange={setActiveTab}
                t={t}
              />
            </div>
          </header>
          <AdminReviewQueueTable
            reviews={queue}
            isPending={queueQuery.isPending}
            isError={queueQuery.isError}
            errorMessage={
              queueQuery.error ? getApiErrorMessage(queueQuery.error) : null
            }
            dateFormatter={dateFormatter}
            onOpenReview={(reviewId) => {
              setSelectedReviewId(reviewId);
              setIsDrawerOpen(true);
              setActionError(null);
            }}
            t={t}
            summaryFormatter={(summary) => formatReviewSummary(summary, t)}
            primaryColumn="entity"
          />
        </section>

        <AdminHealthTables
          jobs={jobsQuery.data}
          payments={paymentsQuery.data}
          t={t}
        />
        <AdminTrustTable trust={trustSafetyQuery.data} t={t} />
        <AdminAuditTable dashboard={dashboard} t={t} />
      </main>

      {isDrawerOpen && selectedReviewId ? (
        <AdminDashboardReviewDrawer
          detail={detailQuery.data}
          isPending={detailQuery.isPending}
          rejectionNote={rejectionNote}
          actionError={actionError}
          isDecisionPending={reviewDecisionMutation.isPending}
          onClose={() => setIsDrawerOpen(false)}
          onRejectionNoteChange={setRejectionNote}
          onApprove={() =>
            reviewDecisionMutation.mutate({ decision: "approved" })
          }
          onReject={() =>
            reviewDecisionMutation.mutate({
              decision: "rejected",
              rejectionNote,
            })
          }
          t={t}
        />
      ) : null}
    </AdminShell>
  );
}
