import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { useAdminSurface } from "../admin/useAdminSurface";
import { Navigate } from "react-router-dom";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";
import { useBillingSubscription, useBillingUsage } from "../billing/useBilling";

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled: !adminSurface.isLoading && !adminSurface.hasAdminAccess,
  });
  const billingSubscription = useBillingSubscription({
    enabled: Boolean(profileQuery.data?.profile),
  });
  const billingUsage = useBillingUsage({
    enabled: Boolean(profileQuery.data?.profile),
  });

  if (adminSurface.hasAdminAccess) {
    return <Navigate to={WEB_ROUTES.admin} replace />;
  }

  if (adminSurface.isLoading || profileQuery.isPending) {
    return (
      <DashboardStatusFrame>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">{t("common.loading")}</p>
        </section>
      </DashboardStatusFrame>
    );
  }

  if (profileQuery.isError) {
    return (
      <DashboardStatusFrame>
        <section className="rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-rose-900">
            {t("dashboard.profileError.title")}
          </h1>
          <p className="mt-2 text-sm text-rose-700">
            {getApiErrorMessage(profileQuery.error)}
          </p>
        </section>
      </DashboardStatusFrame>
    );
  }

  if (!profileQuery.data?.profile) {
    return <Navigate to={WEB_ROUTES.signup} replace />;
  }

  const profile = profileQuery.data.profile;

  return (
    <DashboardFrame>
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
            {t("dashboard.pendingApproval")}
          </p>
        </div>

        {profile.role === "author" &&
        profile.eligibilityStatus === "limited" ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-amber-950">
              {t("dashboard.authorDetailsPrompt.title")}
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              {t("dashboard.authorDetailsPrompt.description")}
            </p>
            <Link
              to={WEB_ROUTES.profile}
              className="mt-4 inline-flex rounded-md bg-amber-900 px-3 py-2 text-sm font-medium text-white"
            >
              {t("dashboard.authorDetailsPrompt.cta")}
            </Link>
          </section>
        ) : null}

        {billingSubscription.data && billingUsage.data ? (
          <section className="grid gap-4 md:grid-cols-3">
            <DashboardMetric
              label={t("billing.currentStatus")}
              value={t(
                `billing.status.${billingSubscription.data.subscription.entitlementStatus}`,
              )}
            />
            <DashboardMetric
              label={t("billing.introUsage")}
              value={`${billingUsage.data.usage.introRequests.used} / ${billingUsage.data.usage.introRequests.limit}`}
            />
            <DashboardMetric
              label={
                profile.role === "publisher"
                  ? t("billing.directoryVisibility")
                  : t("billing.storageUsage")
              }
              value={
                profile.role === "publisher"
                  ? billingUsage.data.usage.directoryVisibility.allowed
                    ? t("billing.enabled")
                    : t("billing.disabled")
                  : `${Math.round(
                      billingUsage.data.usage.storage.usedBytes / 1024 / 1024,
                    )} MB`
              }
            />
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          {profile.role === "author" ? (
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
    </DashboardFrame>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function DashboardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      {children}
    </div>
  );
}

function DashboardStatusFrame({ children }: { children: ReactNode }) {
  return (
    <DashboardFrame>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </DashboardFrame>
  );
}
