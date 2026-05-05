import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { supabase } from "../supabase/client";
import { useAuth } from "./AuthContext";
import { resolvePostAuthRoute } from "./postAuthRouting";
import { getApiErrorMessage } from "../api/client";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading: authLoading, session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("auth.signup.errors.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.signup.errors.passwordMismatch"));
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    try {
      const nextRoute = await resolvePostAuthRoute({ allowAdminLanding: true });
      void navigate(nextRoute, { replace: true });
    } catch (routeError) {
      setError(getApiErrorMessage(routeError));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-md px-4 py-16 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-950">
            <KeyRound aria-hidden="true" className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">
            {t("auth.resetPassword.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("auth.resetPassword.description")}
          </p>

          {!authLoading && !session ? (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t("auth.resetPassword.missingSession")}
            </div>
          ) : (
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="mt-6"
            >
              {error ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  {t("auth.resetPassword.newPassword")}
                </span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-slate-700">
                  {t("auth.resetPassword.confirmPassword")}
                </span>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                />
              </label>

              <button
                type="submit"
                disabled={loading || authLoading}
                className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? t("common.loading") : t("auth.resetPassword.submit")}
              </button>
            </form>
          )}

          <Link
            to={WEB_ROUTES.login}
            className="mt-5 inline-flex text-sm font-medium text-slate-950 underline-offset-2 hover:underline"
          >
            {t("auth.callback.backToLogin")}
          </Link>
        </section>
      </main>
    </div>
  );
}
