type StatusBadgeProps = {
  colorMap: Record<string, string>;
  label?: string;
  status: string;
};

export const manuscriptStatusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-slate-200 text-slate-500",
};

export const eligibilityStatusColors: Record<string, string> = {
  eligible: "bg-green-100 text-green-700",
  limited: "bg-yellow-100 text-yellow-700",
  blocked: "bg-red-100 text-red-700",
  quarantined: "bg-red-100 text-red-700",
};

export function StatusBadge({ colorMap, label, status }: StatusBadgeProps) {
  const color = colorMap[status] ?? "bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
