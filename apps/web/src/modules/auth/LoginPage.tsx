import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiRoutes } from "@marketplace/contracts";
import { supabase } from "../supabase/client";
import { WEB_ROUTES } from "../routing/routes";
import { getLoginErrorMessageKey } from "./authMessages";
import { PlatformHeader } from "../layout/PlatformHeader";
import { getApiErrorMessage, webApiClient } from "../api/client";
import { resolvePostAuthRoute } from "./postAuthRouting";
import { getLastAuthMethod, setLastAuthMethod } from "./authFlowStorage";
import { SocialAuthButtons } from "./SocialAuthButtons";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastAuthMethod = getLastAuthMethod();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      const messageKey = getLoginErrorMessageKey(authError.message);

      if (messageKey === "auth.errors.emailNotConfirmed") {
        const params = new URLSearchParams({
          email,
          source: "login",
        });
        void navigate(`${WEB_ROUTES.checkEmail}?${params.toString()}`);
        return;
      }

      setError(t(messageKey));
      return;
    }

    try {
      setLastAuthMethod("password");
      const adminResponse = await webApiClient.request(ApiRoutes.admin.access);
      if (adminResponse.status !== "no_access") {
        await supabase.auth.signOut();
        void navigate(`${WEB_ROUTES.adminLogin}?reason=staff`, {
          replace: true,
        });
        return;
      }

      const nextRoute = await resolvePostAuthRoute();
      void navigate(nextRoute);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />

      <main className="flex px-4 py-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              {t("app.kicker")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {t("auth.login.title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t("auth.login.subtitle")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SocialAuthButtons
              disabled={loading}
              lastUsedMethod={lastAuthMethod}
              onError={(message) => setError(message || null)}
            />

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>{t("auth.social.orEmail")}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {lastAuthMethod === "password" ? (
              <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t("auth.login.lastUsedPassword")}
              </p>
            ) : null}

            <form onSubmit={(e) => void handleSubmit(e)}>
              {error ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  {t("auth.login.email")}
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-slate-700">
                  {t("auth.login.password")}
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? t("common.loading") : t("auth.login.submit")}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-500">
              <Link
                to={WEB_ROUTES.forgotPassword}
                className="font-medium text-slate-950 underline-offset-2 hover:underline"
              >
                {t("auth.login.forgotPassword")}
              </Link>
            </p>

            <p className="mt-4 text-center text-sm text-slate-500">
              {t("auth.login.noAccount")}{" "}
              <Link
                to={WEB_ROUTES.signup}
                className="font-medium text-slate-950 underline-offset-2 hover:underline"
              >
                {t("auth.login.signupLink")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
