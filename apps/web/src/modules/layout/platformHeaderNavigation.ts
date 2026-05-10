import { WEB_ROUTES } from "../routing/routes";

export type HeaderNavItem = {
  key: string;
  to: string;
  mode: "exact" | "prefix";
};

export const publicNavigation: HeaderNavItem[] = [
  { key: "authors", to: WEB_ROUTES.authors, mode: "exact" },
  { key: "publishers", to: WEB_ROUTES.publishers, mode: "exact" },
  { key: "features", to: WEB_ROUTES.features, mode: "exact" },
  { key: "pricing", to: WEB_ROUTES.pricing, mode: "exact" },
];

export const appNavigation: HeaderNavItem[] = [
  { key: "dashboard", to: WEB_ROUTES.dashboard, mode: "exact" },
  { key: "manuscripts", to: WEB_ROUTES.manuscripts, mode: "prefix" },
  { key: "matches", to: WEB_ROUTES.matches, mode: "exact" },
  { key: "requests", to: WEB_ROUTES.requests, mode: "exact" },
  { key: "billing", to: WEB_ROUTES.billing, mode: "exact" },
];

export const adminNavigation: HeaderNavItem[] = [
  { key: "dashboard", to: WEB_ROUTES.admin, mode: "exact" },
  { key: "reviews", to: WEB_ROUTES.adminReviews, mode: "exact" },
  { key: "trustSafety", to: WEB_ROUTES.adminTrustSafety, mode: "exact" },
  { key: "jobs", to: WEB_ROUTES.adminJobs, mode: "exact" },
  { key: "payments", to: WEB_ROUTES.adminPayments, mode: "exact" },
  { key: "auditLogs", to: WEB_ROUTES.adminAuditLogs, mode: "exact" },
  { key: "settings", to: WEB_ROUTES.adminSettings, mode: "exact" },
];

export function isRouteActive(
  pathname: string,
  targetPath: string,
  mode: "exact" | "prefix",
) {
  if (mode === "prefix") {
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  }

  return pathname === targetPath;
}
