import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import {
  consumePendingOauthProvider,
  setLastAuthMethod,
} from "./authFlowStorage";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { resolvePostAuthRoute } from "./postAuthRouting";
import { getApiErrorMessage } from "../api/client";

export function AuthCallbackPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session) {
      const params = new URLSearchParams(location.search);
      setError(
        params.get("error_description") ?? t("auth.callback.genericError"),
      );
      return;
    }

    const provider = consumePendingOauthProvider();
    if (provider) {
      setLastAuthMethod(provider);
    }

    void resolvePostAuthRoute({ allowAdminLanding: true })
      .then((nextRoute) => {
        void navigate(nextRoute, { replace: true });
      })
      .catch((nextError) => {
        setError(
          getApiErrorMessage(nextError) || t("auth.callback.genericError"),
        );
      });
  }, [loading, location.search, navigate, session, t]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">{t("auth.callback.title")}</h1>
          {error ? (
            <>
              <p className="mt-3 text-sm text-rose-700">{error}</p>
              <div className="mt-6">
                <Link
                  to={WEB_ROUTES.login}
                  className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                >
                  {t("auth.callback.backToLogin")}
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              {t("auth.callback.description")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
