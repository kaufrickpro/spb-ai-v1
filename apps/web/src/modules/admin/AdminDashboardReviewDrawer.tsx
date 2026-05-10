import type { AdminReviewDetailResponse } from "@marketplace/contracts";

type AdminDashboardReviewDrawerProps = {
  detail: AdminReviewDetailResponse | undefined;
  isPending: boolean;
  rejectionNote: string;
  actionError: string | null;
  isDecisionPending: boolean;
  onClose: () => void;
  onRejectionNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  t: (key: string) => string;
};

export function AdminDashboardReviewDrawer({
  detail,
  isPending,
  rejectionNote,
  actionError,
  isDecisionPending,
  onClose,
  onRejectionNoteChange,
  onApprove,
  onReject,
  t,
}: AdminDashboardReviewDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
      <button
        aria-label={t("admin.detail.close")}
        className="h-full flex-1"
        onClick={onClose}
      />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("admin.detail.title")}</h2>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
            onClick={onClose}
          >
            {t("admin.detail.close")}
          </button>
        </div>

        {detail ? (
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-700">
                {t("admin.detail.summary")}
              </p>
              <p className="mt-1 text-slate-900">{detail.review.summary}</p>
            </div>

            <div>
              <p className="font-medium text-slate-700">
                {t("admin.detail.submittedFields")}
              </p>
              <pre className="mt-1 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(detail.submittedFields, null, 2)}
              </pre>
            </div>

            <DrawerList
              title={t("admin.detail.riskWarnings")}
              emptyLabel={t("admin.detail.none")}
              items={detail.riskWarnings.map((warning) => ({
                key: warning,
                label: `- ${warning}`,
              }))}
            />
            <DrawerList
              title={t("admin.detail.relatedEvents")}
              emptyLabel={t("admin.detail.none")}
              items={detail.relatedEvents.map((event) => ({
                key: `${event.label}-${event.createdAt}`,
                label: `${event.label} (${new Date(
                  event.createdAt,
                ).toLocaleString()})`,
              }))}
            />
            <DrawerList
              title={t("admin.detail.auditHistory")}
              emptyLabel={t("admin.detail.none")}
              items={detail.auditHistory.map((entry) => ({
                key: entry.id,
                label: `${entry.action} (${new Date(
                  entry.createdAt,
                ).toLocaleString()})`,
              }))}
            />

            <label className="block">
              <span className="font-medium text-slate-700">
                {t("admin.detail.rejectionNote")}
              </span>
              <textarea
                className="mt-1 h-24 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                value={rejectionNote}
                onChange={(event) => onRejectionNoteChange(event.target.value)}
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
                disabled={isDecisionPending}
                onClick={onApprove}
              >
                {t("admin.detail.approve")}
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-700 px-3 py-2 font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDecisionPending}
                onClick={onReject}
              >
                {t("admin.detail.reject")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {isPending ? t("common.loading") : t("admin.detail.empty")}
          </p>
        )}
      </aside>
    </div>
  );
}

function DrawerList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ key: string; label: string }>;
}) {
  return (
    <div>
      <p className="font-medium text-slate-700">{title}</p>
      <ul className="mt-1 space-y-1 text-slate-900">
        {items.map((item) => (
          <li key={item.key}>{item.label}</li>
        ))}
        {items.length === 0 ? (
          <li className="text-slate-500">{emptyLabel}</li>
        ) : null}
      </ul>
    </div>
  );
}
