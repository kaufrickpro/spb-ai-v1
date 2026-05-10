import type {
  AdminEntityType,
  AdminExceptionQueue,
  AdminReviewStatus,
} from "@marketplace/contracts";
import type { TFunction } from "i18next";

export type AdminReviewFilter = "all" | AdminEntityType;

export const adminReviewFilters: Array<{
  value: AdminReviewFilter;
  labelKey: string;
}> = [
  { value: "all", labelKey: "admin.tabs.all" },
  { value: "profile", labelKey: "admin.tabs.profile" },
  { value: "manuscript", labelKey: "admin.tabs.manuscript" },
  { value: "document", labelKey: "admin.tabs.document" },
  { value: "publisher_change_request", labelKey: "admin.tabs.publisherChange" },
];

export const adminReviewStatuses: Array<{
  value: "all" | AdminReviewStatus;
  labelKey: string;
}> = [
  { value: "all", labelKey: "admin.reviewFilters.statusAll" },
  { value: "pending", labelKey: "admin.reviewStatuses.pending" },
  { value: "approved", labelKey: "admin.reviewStatuses.approved" },
  { value: "rejected", labelKey: "admin.reviewStatuses.rejected" },
] as const;

export const adminExceptionQueues: Array<{
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

export function formatReviewSummary(summary: string, t: TFunction) {
  const manuscriptMatch = summary.match(/^New manuscript submitted: (.+)$/);
  if (manuscriptMatch) {
    return t("admin.queue.summaries.newManuscript", {
      title: manuscriptMatch[1],
    });
  }

  return summary;
}
