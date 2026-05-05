import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PlatformHeader } from "../layout/PlatformHeader";
import { useNavigate } from "react-router-dom";
import { WEB_ROUTES } from "../routing/routes";
import { useAdminSurface } from "../admin/useAdminSurface";
import { Navigate } from "react-router-dom";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled: !adminSurface.hasAdminAccess,
  });
  const marketplaceRole = profileQuery.data?.profile?.role ?? null;

  if (adminSurface.hasAdminAccess) {
    return <Navigate to={WEB_ROUTES.admin} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("dashboard.title")}
          </h1>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">{t("dashboard.welcome")}</p>
          <p className="mt-1 text-sm font-medium text-slate-950">
            {user?.email}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            {adminSurface.isLoading
              ? t("common.loading")
              : adminSurface.hasAdminAccess
                ? t("dashboard.adminReady")
                : t("dashboard.pendingApproval")}
          </p>
          {adminSurface.hasAdminAccess ? (
            <button
              type="button"
              onClick={() => void navigate(WEB_ROUTES.admin)}
              className="mt-4 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("dashboard.openAdmin")}
            </button>
          ) : null}
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {marketplaceRole === "author" ? (
            <Link
              to={WEB_ROUTES.manuscripts}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            >
              <h2 className="text-base font-semibold">
                {t("dashboard.cards.manuscripts.title")}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {t("dashboard.cards.manuscripts.description")}
              </p>
            </Link>
          ) : null}
          <Link
            to={WEB_ROUTES.matches}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="text-base font-semibold">
              {t("dashboard.cards.matches.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("dashboard.cards.matches.description")}
            </p>
          </Link>
          <Link
            to={WEB_ROUTES.requests}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="text-base font-semibold">
              {t("dashboard.cards.requests.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("dashboard.cards.requests.description")}
            </p>
          </Link>
          <Link
            to={WEB_ROUTES.billing}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="text-base font-semibold">
              {t("dashboard.cards.billing.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("dashboard.cards.billing.description")}
            </p>
          </Link>
        </section>
      </main>
    </div>
  );
}
