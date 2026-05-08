import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useAdminSurface } from "../admin/useAdminSurface";
import { useAuth } from "../auth/AuthContext";
import { getApiErrorMessage } from "../api/client";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { useMarketplaceProfile } from "./useMarketplaceProfile";
import { useUpdateMatchVisibleContacts } from "../profiles/useProfileSurfaces";
import { buildMatchVisibleContactSettings } from "./matchVisibleContactForm";

function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const adminSurface = useAdminSurface();
  const updateContacts = useUpdateMatchVisibleContacts();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [showWebsite, setShowWebsite] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const profileQuery = useMarketplaceProfile({
    enabled: !adminSurface.isLoading && !adminSurface.hasAdminAccess,
  });

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
  const initials = buildInitials(profile.displayName);

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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {profile.profilePhotoUrl ? (
                <img
                  alt={profile.displayName}
                  src={profile.profilePhotoUrl}
                  className="h-24 w-24 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-2xl font-semibold text-white">
                  {initials || "?"}
                </div>
              )}

              <h2 className="mt-4 text-lg font-semibold">
                {profile.displayName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
            </div>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">{t("profile.summary.role")}</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {t(`profile.roles.${profile.role}`)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("profile.summary.intent")}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {t(`profile.signupIntent.${profile.signupIntent}`)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("profile.summary.status")}
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {t(`profile.eligibilityStatus.${profile.eligibilityStatus}`)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-semibold">
                {t("profile.placeholder.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("profile.placeholder.description")}
              </p>
            </div>

            <div className="grid gap-4 py-5 sm:grid-cols-2">
              <Field
                label={t("profile.fields.displayName")}
                value={profile.displayName}
              />
              <Field
                label={t("profile.fields.role")}
                value={t(`profile.roles.${profile.role}`)}
              />
              <Field
                label={t("profile.fields.photo")}
                value={
                  profile.profilePhotoUrl ?? t("profile.fields.photoFallback")
                }
              />
              <Field
                label={t("profile.fields.intent")}
                value={t(`profile.signupIntent.${profile.signupIntent}`)}
              />
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              {t("profile.placeholder.nextStep")}
            </div>

            <form
              className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                updateContacts.mutate(
                  buildMatchVisibleContactSettings({
                    publicEmail,
                    showEmail,
                    showWebsite,
                    websiteUrl,
                  }),
                );
              }}
            >
              <h2 className="text-sm font-semibold text-slate-900">
                {t("profile.matchVisible.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("profile.matchVisible.description")}
              </p>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                {t("profile.matchVisible.website")}
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  placeholder="https://example.com"
                  value={websiteUrl}
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={showWebsite}
                  onChange={(event) => setShowWebsite(event.target.checked)}
                  type="checkbox"
                />
                {t("profile.matchVisible.showWebsite")}
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                {t("profile.matchVisible.email")}
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setPublicEmail(event.target.value)}
                  placeholder="submissions@example.com"
                  type="email"
                  value={publicEmail}
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={showEmail}
                  onChange={(event) => setShowEmail(event.target.checked)}
                  type="checkbox"
                />
                {t("profile.matchVisible.showEmail")}
              </label>
              <button
                className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={updateContacts.isPending}
                type="submit"
              >
                {t("profile.matchVisible.save")}
              </button>
              {updateContacts.isSuccess ? (
                <p className="mt-3 text-sm text-emerald-700">
                  {t("profile.matchVisible.saved")}
                </p>
              ) : null}
              {updateContacts.isError ? (
                <p className="mt-3 text-sm text-rose-700">
                  {getApiErrorMessage(updateContacts.error)}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
