import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "./AdminShell";
import { supabase } from "../supabase/client";
import { WEB_ROUTES } from "../routing/routes";
import { useAuth } from "../auth/AuthContext";
import { useAdminSurface } from "./useAdminSurface";

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const adminSurface = useAdminSurface();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    void navigate(WEB_ROUTES.root);
  }

  return (
    <AdminShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{t("adminNav.settings")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {t("adminPages.settings.description")}
          </p>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              {t("adminPages.settings.identity.title")}
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-500">
                  {t("adminPages.settings.identity.email")}
                </dt>
                <dd className="mt-1 text-slate-900">{user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">
                  {t("adminPages.settings.identity.access")}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {t(
                    `admin.accessStatuses.${adminSurface.adminAccessQuery.data?.status ?? "no_access"}`,
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">
                  {t("adminPages.settings.identity.mfa")}
                </dt>
                <dd className="mt-1 text-slate-900">
                  {adminSurface.adminAccessQuery.data?.mfaVerified
                    ? t("adminPages.settings.identity.mfaVerified")
                    : t("adminPages.settings.identity.mfaRequired")}
                </dd>
              </div>
            </dl>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              {t("adminPages.settings.policy.title")}
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li>{t("adminPages.settings.policy.separateAccounts")}</li>
              <li>{t("adminPages.settings.policy.mfa")}</li>
              <li>{t("adminPages.settings.policy.audit")}</li>
              <li>{t("adminPages.settings.policy.notes")}</li>
            </ul>
          </article>
        </section>

        <section className="mt-6 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("adminPages.settings.session.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {t("adminPages.settings.session.description")}
          </p>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="mt-5 inline-flex rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {isSigningOut ? t("common.loading") : t("auth.signOut")}
          </button>
        </section>
      </main>
    </AdminShell>
  );
}
