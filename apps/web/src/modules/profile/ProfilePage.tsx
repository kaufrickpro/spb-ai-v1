import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useAdminSurface } from "../admin/useAdminSurface";
import { useAuth } from "../auth/AuthContext";
import { getApiErrorMessage } from "../api/client";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { useMarketplaceProfile } from "./useMarketplaceProfile";
import { AuthorDetailsCard } from "./AuthorDetailsCard";
import { MatchVisibleContactCard } from "./MatchVisibleContactCard";
import { ProfileOverviewCard } from "./ProfileOverviewCard";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled: !adminSurface.isLoading && !adminSurface.hasAdminAccess,
  });
  const authorDetails =
    profileQuery.data?.details?.role === "author"
      ? profileQuery.data.details
      : null;

  if (adminSurface.hasAdminAccess) {
    return <Navigate to={WEB_ROUTES.admin} replace />;
  }

  if (adminSurface.isLoading || profileQuery.isPending) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <PlatformHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">{t("common.loading")}</p>
          </section>
        </main>
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <PlatformHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <section className="rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-rose-700">
              {getApiErrorMessage(profileQuery.error)}
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (profileQuery.data == null) {
    return <Navigate to={WEB_ROUTES.signup} replace />;
  }

  const { profile } = profileQuery.data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {t("profile.pageTitle")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {t("profile.pageDescription")}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ProfileSummaryCard email={user?.email} profile={profile} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ProfileOverviewCard profile={profile} />
            {profile.role === "author" ? (
              <AuthorDetailsCard authorDetails={authorDetails} />
            ) : null}

            <MatchVisibleContactCard />
          </div>
        </section>
      </main>
    </div>
  );
}
