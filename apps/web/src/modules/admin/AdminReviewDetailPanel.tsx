import type {
  AdminReviewDetailResponse,
  AdminReviewQueueItem,
} from "@marketplace/contracts";

type ReviewDecision = "approved" | "rejected" | "quarantined" | "restored";

type AdminReviewDetailPanelProps = {
  selectedReview: AdminReviewQueueItem | null;
  detail: AdminReviewDetailResponse | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string | null;
  rejectionNote: string;
  onRejectionNoteChange: (value: string) => void;
  onDecision: (decision: ReviewDecision, review: AdminReviewQueueItem) => void;
  isDecisionPending: boolean;
  dateFormatter: Intl.DateTimeFormat;
  t: (key: string) => string;
};

export function AdminReviewDetailPanel({
  selectedReview,
  detail,
  isPending,
  isError,
  errorMessage,
  rejectionNote,
  onRejectionNoteChange,
  onDecision,
  isDecisionPending,
  dateFormatter,
  t,
}: AdminReviewDetailPanelProps) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">{t("admin.detail.title")}</h2>

      {!selectedReview ? (
        <p className="mt-4 text-sm text-slate-600">{t("admin.detail.empty")}</p>
      ) : isPending ? (
        <p className="mt-4 text-sm text-slate-600">{t("common.loading")}</p>
      ) : isError ? (
        <p role="alert" className="mt-4 text-sm font-medium text-rose-700">
          {errorMessage}
        </p>
      ) : detail ? (
        <div className="mt-4 space-y-5">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.queue.eligibility")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                {t(`admin.exceptionQueues.${detail.review.exceptionQueue}`)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                {t(
                  `admin.eligibilityStatuses.${detail.review.eligibilityStatus}`,
                )}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                {t(`admin.reviewOutcomes.${detail.review.reviewOutcome}`)}
              </span>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.detail.summary")}
            </p>
            <p className="mt-2 text-sm text-slate-900">
              {detail.review.summary}
            </p>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.detail.submittedFields")}
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
              {JSON.stringify(detail.submittedFields, null, 2)}
            </pre>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("admin.detail.riskWarnings")}
            </p>
            <div className="mt-2 space-y-2">
              {detail.riskWarnings.length > 0 ? (
                detail.riskWarnings.map((warning) => (
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
              {detail.auditHistory.length > 0 ? (
                detail.auditHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-slate-900">{entry.action}</p>
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
              onChange={(event) => onRejectionNoteChange(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </section>

          <div className="flex flex-wrap gap-3">
            <ReviewDecisionButton
              label={t("admin.detail.approve")}
              disabled={isDecisionPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onDecision("approved", selectedReview)}
            />
            <ReviewDecisionButton
              label={t("admin.detail.reject")}
              disabled={isDecisionPending}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onDecision("rejected", selectedReview)}
            />
            <ReviewDecisionButton
              label={t("admin.detail.quarantine")}
              disabled={isDecisionPending}
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onDecision("quarantined", selectedReview)}
            />
            <ReviewDecisionButton
              label={t("admin.detail.restore")}
              disabled={isDecisionPending}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onDecision("restored", selectedReview)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">{t("admin.detail.empty")}</p>
      )}
    </aside>
  );
}

function ReviewDecisionButton({
  label,
  disabled,
  className,
  onClick,
}: {
  label: string;
  disabled: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {label}
    </button>
  );
}
