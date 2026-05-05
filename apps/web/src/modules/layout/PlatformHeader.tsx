import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Menu, UserRound, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import spbLogo from "../../assets/SPBLogo.png";
import { WEB_ROUTES } from "../routing/routes";
import { useAuth } from "../auth/AuthContext";
import { useAdminSurface } from "../admin/useAdminSurface";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";
import { supabase } from "../supabase/client";

type HeaderNavItem = {
  key: string;
  to: string;
  mode: "exact" | "prefix";
};

const publicNavigation: HeaderNavItem[] = [
  { key: "authors", to: WEB_ROUTES.authors, mode: "exact" },
  { key: "publishers", to: WEB_ROUTES.publishers, mode: "exact" },
  { key: "features", to: WEB_ROUTES.features, mode: "exact" },
  { key: "pricing", to: WEB_ROUTES.pricing, mode: "exact" },
];

const appNavigation: HeaderNavItem[] = [
  { key: "dashboard", to: WEB_ROUTES.dashboard, mode: "exact" },
  { key: "manuscripts", to: WEB_ROUTES.manuscripts, mode: "prefix" },
  { key: "matches", to: WEB_ROUTES.matches, mode: "exact" },
  { key: "requests", to: WEB_ROUTES.requests, mode: "exact" },
  { key: "billing", to: WEB_ROUTES.billing, mode: "exact" },
];

const adminNavigation: HeaderNavItem[] = [
  { key: "dashboard", to: WEB_ROUTES.admin, mode: "exact" },
  { key: "reviews", to: WEB_ROUTES.adminReviews, mode: "exact" },
  { key: "trustSafety", to: WEB_ROUTES.adminTrustSafety, mode: "exact" },
  { key: "jobs", to: WEB_ROUTES.adminJobs, mode: "exact" },
  { key: "payments", to: WEB_ROUTES.adminPayments, mode: "exact" },
  { key: "auditLogs", to: WEB_ROUTES.adminAuditLogs, mode: "exact" },
  { key: "settings", to: WEB_ROUTES.adminSettings, mode: "exact" },
];

function isRouteActive(
  pathname: string,
  targetPath: string,
  mode: "exact" | "prefix",
) {
  if (mode === "prefix") {
    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  }

  return pathname === targetPath;
}

function LanguageToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className={className ?? ""}>
      <div className="inline-flex items-center gap-1 rounded-md border border-white/30 p-1">
        <button
          type="button"
          onClick={() => void i18n.changeLanguage("tr")}
          data-active={activeLanguage.startsWith("tr")}
          className="rounded px-2 py-1 text-xs font-medium data-[active=true]:bg-white data-[active=true]:text-slate-900"
        >
          TR
        </button>
        <button
          type="button"
          onClick={() => void i18n.changeLanguage("en")}
          data-active={activeLanguage.startsWith("en")}
          className="rounded px-2 py-1 text-xs font-medium data-[active=true]:bg-white data-[active=true]:text-slate-900"
        >
          EN
        </button>
      </div>
    </div>
  );
}

export function PlatformHeader() {
  const { t } = useTranslation();
  const { session, loading, user } = useAuth();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled: Boolean(session) && !loading && !adminSurface.hasAdminAccess,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isAuthenticated = !loading && Boolean(session);
  const isAdminContext =
    isAuthenticated &&
    (adminSurface.hasAdminAccess || adminSurface.hasAdminMembership);

  const marketplaceRole = profileQuery.data?.profile?.role ?? null;
  const navigation = useMemo(() => {
    if (!isAuthenticated) return publicNavigation;
    if (isAdminContext) return adminNavigation;
    return appNavigation.filter((item) =>
      item.key === "manuscripts" ? marketplaceRole === "author" : true,
    );
  }, [isAdminContext, isAuthenticated, marketplaceRole]);

  const userLabel = user?.email?.split("@")[0] || t("appNav.accountFallback");

  async function handleSignOut() {
    await supabase.auth.signOut();
    void navigate(WEB_ROUTES.root);
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900 text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link to={WEB_ROUTES.root} className="shrink-0">
          <img
            src={spbLogo}
            alt={t("app.titleShort")}
            className="h-12 w-auto sm:h-14"
          />
        </Link>

        <nav
          aria-label={t("nav.platformLabel")}
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
        >
          {navigation.map((item) => {
            const isActive = isRouteActive(
              location.pathname,
              item.to,
              item.mode,
            );
            const labelKey = isAdminContext
              ? `adminNav.${item.key}`
              : isAuthenticated
                ? `appNav.${item.key}`
                : `nav.${item.key}`;

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-slate-100 hover:bg-white/10"
                }`}
              >
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <LanguageToggle />

          {!loading && !session ? (
            <>
              <Link
                to={WEB_ROUTES.login}
                className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t("nav.login")}
              </Link>
              <Link
                to={WEB_ROUTES.signup}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                {t("nav.signup")}
              </Link>
            </>
          ) : null}

          {!loading && session ? (
            <>
              <button
                type="button"
                aria-label={t("appNav.notifications")}
                className="rounded-full border border-white/40 p-2 text-white hover:bg-white/10"
              >
                <Bell className="h-4 w-4" />
              </button>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/40 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
                  <UserRound className="h-4 w-4" />
                  <span>{userLabel}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-200 bg-white p-1 text-slate-900 shadow-lg">
                  {adminSurface.hasAdminMembership ? (
                    <>
                      <Link
                        to={WEB_ROUTES.admin}
                        className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                      >
                        {t("nav.admin")}
                      </Link>
                      <Link
                        to={WEB_ROUTES.adminSettings}
                        className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                      >
                        {t("adminNav.settings")}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to={WEB_ROUTES.profile}
                        className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                      >
                        {t("appNav.profile")}
                      </Link>
                      <Link
                        to={WEB_ROUTES.settings}
                        className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                      >
                        {t("appNav.settings")}
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="block w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                  >
                    {t("auth.signOut")}
                  </button>
                </div>
              </details>
            </>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={t("nav.openMenu")}
          className="ml-auto rounded-md border border-white/40 p-2 text-white lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/55 lg:hidden">
          <aside className="h-full w-full bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("nav.menu")}</p>
              <button
                type="button"
                aria-label={t("nav.closeMenu")}
                className="rounded-md border border-white/40 p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-4 space-y-1" aria-label={t("nav.platformLabel")}>
              {navigation.map((item) => {
                const isActive = isRouteActive(
                  location.pathname,
                  item.to,
                  item.mode,
                );
                const labelKey = isAdminContext
                  ? `adminNav.${item.key}`
                  : isAuthenticated
                    ? `appNav.${item.key}`
                    : `nav.${item.key}`;

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>

            <LanguageToggle className="mt-4" />

            {!loading && !session ? (
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  to={WEB_ROUTES.login}
                  className="rounded-md border border-white/40 px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to={WEB_ROUTES.signup}
                  className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-slate-900"
                >
                  {t("nav.signup")}
                </Link>
              </div>
            ) : null}

            {!loading && session ? (
              <div className="mt-4 rounded-md border border-white/20 p-3">
                <p className="text-sm font-semibold">{userLabel}</p>
                <p className="text-xs text-slate-300">{user?.email ?? ""}</p>
                <div className="mt-3 flex flex-col gap-2">
                  {adminSurface.hasAdminMembership ? (
                    <>
                      <Link
                        to={WEB_ROUTES.admin}
                        className="rounded-md border border-white/30 px-3 py-2 text-sm"
                      >
                        {t("nav.admin")}
                      </Link>
                      <Link
                        to={WEB_ROUTES.adminSettings}
                        className="rounded-md border border-white/30 px-3 py-2 text-sm"
                      >
                        {t("adminNav.settings")}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to={WEB_ROUTES.profile}
                        className="rounded-md border border-white/30 px-3 py-2 text-sm"
                      >
                        {t("appNav.profile")}
                      </Link>
                      <Link
                        to={WEB_ROUTES.settings}
                        className="rounded-md border border-white/30 px-3 py-2 text-sm"
                      >
                        {t("appNav.settings")}
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="rounded-md border border-red-200/60 px-3 py-2 text-left text-sm text-red-200"
                  >
                    {t("auth.signOut")}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </header>
  );
}
