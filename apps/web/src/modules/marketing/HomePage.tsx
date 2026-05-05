import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { useAuth } from "../auth/AuthContext";
import { useAdminSurface } from "../admin/useAdminSurface";
import { resolvePublicLandingRoute } from "./publicLanding";

export function HomePage() {
  const { t } = useTranslation();
  const { session, loading } = useAuth();
  const adminSurface = useAdminSurface();
  const location = useLocation();
  const isRootPage = location.pathname === WEB_ROUTES.root;
  const redirectRoute = resolvePublicLandingRoute({
    hasAdminAccess: adminSurface.hasAdminAccess,
    isRootPage,
  });
  const sectionTitle = isRootPage
    ? t("marketing.home.title")
    : t("marketing.section.title", {
        section: t(`nav.${location.pathname.slice(1)}`),
      });
  const sectionDescription = isRootPage
    ? t("marketing.home.description")
    : t("marketing.section.description", {
        section: t(`nav.${location.pathname.slice(1)}`),
      });

  if (loading) {
    return <PublicLandingLoadingState />;
  }

  if (session && adminSurface.isLoading) {
    return <PublicLandingLoadingState />;
  }

  if (session && redirectRoute) {
    return <Navigate to={redirectRoute} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto flex w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
            {isRootPage
              ? t("marketing.home.eyebrow")
              : t("marketing.section.eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {sectionTitle}
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            {sectionDescription}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={WEB_ROUTES.signup}
              className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
            >
              {t("marketing.home.primaryCta")}
            </Link>
            <Link
              to={WEB_ROUTES.login}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t("marketing.home.secondaryCta")}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function PublicLandingLoadingState() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-950">
      <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm">
        {t("common.loading")}
      </p>
    </div>
  );
}
