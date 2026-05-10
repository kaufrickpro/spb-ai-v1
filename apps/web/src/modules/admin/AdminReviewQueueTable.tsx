import type { AdminReviewQueueItem } from "@marketplace/contracts";

type AdminReviewQueueTableProps = {
  reviews: AdminReviewQueueItem[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string | null;
  dateFormatter: Intl.DateTimeFormat;
  selectedReviewId?: string | null;
  onOpenReview: (reviewId: string) => void;
  t: (key: string) => string;
  emptyClassName?: string;
  summaryFormatter?: (summary: string) => string;
  actionAlign?: "left" | "right";
  primaryColumn?: "summary" | "entity";
};

export function AdminReviewQueueTable({
  reviews,
  isPending,
  isError,
  errorMessage,
  dateFormatter,
  selectedReviewId,
  onOpenReview,
  t,
  emptyClassName = "px-4 py-6 text-center text-slate-500",
  summaryFormatter = (summary) => summary,
  actionAlign = "left",
  primaryColumn = "summary",
}: AdminReviewQueueTableProps) {
  if (isPending) {
    return <div className={emptyClassName}>{t("common.loading")}</div>;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="px-4 py-6 text-center font-medium text-rose-700"
      >
        {errorMessage}
      </div>
    );
  }

  if (reviews.length === 0) {
    return <div className={emptyClassName}>{t("admin.queue.empty")}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">{t("admin.queue.entity")}</th>
            <th className="px-4 py-3 font-medium">{t("admin.queue.queue")}</th>
            <th className="px-4 py-3 font-medium">
              {t("admin.queue.eligibility")}
            </th>
            <th className="px-4 py-3 font-medium">{t("admin.queue.risk")}</th>
            <th className="px-4 py-3 font-medium">
              {t("admin.queue.submitted")}
            </th>
            <th
              className={`px-4 py-3 font-medium ${
                actionAlign === "right" ? "text-right" : ""
              }`}
            >
              {t("admin.queue.action")}
            </th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => {
            const isSelected = selectedReviewId === review.id;
            return (
              <tr
                key={review.id}
                className={
                  isSelected
                    ? "border-t border-slate-100 bg-amber-50/50"
                    : "border-t border-slate-100 hover:bg-slate-50"
                }
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">
                    {primaryColumn === "entity"
                      ? t(`admin.entityTypes.${review.entityType}`)
                      : summaryFormatter(review.summary)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {primaryColumn === "entity"
                      ? summaryFormatter(review.summary)
                      : t(`admin.entityTypes.${review.entityType}`)}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t(`admin.exceptionQueues.${review.exceptionQueue}`)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t(`admin.eligibilityStatuses.${review.eligibilityStatus}`)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t(`admin.riskLevels.${review.riskLevel}`)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {dateFormatter.format(new Date(review.submittedAt))}
                </td>
                <td
                  className={`px-4 py-3 ${
                    actionAlign === "right" ? "text-right" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                    onClick={() => onOpenReview(review.id)}
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
  );
}
