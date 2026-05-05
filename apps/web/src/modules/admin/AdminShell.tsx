import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X } from "lucide-react";
import { WEB_ROUTES } from "../routing/routes";

const adminSidebarLinks = [
  { to: WEB_ROUTES.admin, key: "dashboard" },
  { to: WEB_ROUTES.adminReviews, key: "reviews" },
  { to: WEB_ROUTES.adminTrustSafety, key: "trustSafety" },
  { to: WEB_ROUTES.adminJobs, key: "jobs" },
  { to: WEB_ROUTES.adminPayments, key: "payments" },
  { to: WEB_ROUTES.adminAuditLogs, key: "auditLogs" },
  { to: WEB_ROUTES.adminSettings, key: "settings" },
] as const;

function isActive(pathname: string, to: string) {
  return pathname === to;
}

function AdminSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-4 py-4">
        <Link to={WEB_ROUTES.root} onClick={onNavigate}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-400">
            {t("app.kicker")}
          </p>
          <p className="text-sm font-semibold text-white">{t("admin.title")}</p>
        </Link>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        aria-label={t("admin.quickNav")}
      >
        {adminSidebarLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`mb-1 block rounded-md px-3 py-2 text-sm ${
              isActive(location.pathname, item.to)
                ? "bg-slate-700 text-white"
                : "text-slate-200 hover:bg-slate-800"
            }`}
          >
            {t(`adminNav.${item.key}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 bg-slate-900 text-white lg:block">
          <AdminSidebarContent />
        </aside>

        <div className="flex-1">
          <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              aria-label={t("nav.openMenu")}
            >
              <Menu className="h-4 w-4" />
              {t("nav.menu")}
            </button>
          </div>

          {children}
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/55 lg:hidden">
          <aside className="h-full w-72 max-w-[85vw] bg-slate-900 text-white">
            <div className="flex items-center justify-end border-b border-slate-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md border border-slate-600 p-2 text-slate-100"
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AdminSidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
