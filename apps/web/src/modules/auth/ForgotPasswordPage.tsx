import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { supabase } from "../supabase/client";
import { getEmailDeliveryErrorMessageKey } from "./authMessages";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const isAdminSurface = searchParams.get("surface") === "admin";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);

    const redirectTo = new URL(
      WEB_ROUTES.resetPassword,
      window.location.origin,
    ).toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );

    setLoading(false);

    if (resetError) {
      setError(t(getEmailDeliveryErrorMessageKey(resetError.message)));
      return;
    }

    setSent(true);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-md px-4 py-16 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-950">
            <Mail aria-hidden="true" className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">
            {t("auth.forgotPassword.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t("auth.forgotPassword.description")}
          </p>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-6">
            {sent ? (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {t("auth.forgotPassword.sent")}
              </div>
            ) : null}

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
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading
                ? t("common.loading")
                : t("auth.forgotPassword.submit")}
            </button>
          </form>

          <Link
            to={isAdminSurface ? WEB_ROUTES.adminLogin : WEB_ROUTES.login}
            className="mt-5 inline-flex text-sm font-medium text-slate-950 underline-offset-2 hover:underline"
          >
            {isAdminSurface
              ? t("auth.adminLogin.backToAdminLogin")
              : t("auth.callback.backToLogin")}
          </Link>
        </section>
      </main>
    </div>
  );
}
