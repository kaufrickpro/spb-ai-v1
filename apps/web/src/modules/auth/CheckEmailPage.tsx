import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, RefreshCw } from "lucide-react";
import { supabase } from "../supabase/client";
import { WEB_ROUTES } from "../routing/routes";
import { PlatformHeader } from "../layout/PlatformHeader";
import { getEmailDeliveryErrorMessageKey } from "./authMessages";

export function CheckEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const source = searchParams.get("source");

  const introMessage =
    source === "login"
      ? t("auth.checkEmail.fromLogin")
      : t("auth.checkEmail.fromSignup");

  async function handleResend() {
    if (!email) {
      setError(t("auth.checkEmail.emailRequired"));
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    setLoading(false);

    if (resendError) {
      setError(t(getEmailDeliveryErrorMessageKey(resendError.message)));
      return;
    }

    setSuccessMessage(t("auth.checkEmail.resentSuccess"));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />

      <main className="flex px-4 py-16">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-900">
              <Mail aria-hidden="true" className="h-6 w-6" />
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm font-medium text-slate-500">
                {t("app.kicker")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {t("auth.checkEmail.title")}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {introMessage}
              </p>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("auth.checkEmail.emailLabel")}
              </p>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                placeholder={t("auth.checkEmail.emailPlaceholder")}
              />
            </div>

            {successMessage && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                {loading
                  ? t("common.loading")
                  : t("auth.checkEmail.resendButton")}
              </button>

              <button
                type="button"
                onClick={() => void navigate(WEB_ROUTES.login)}
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("auth.checkEmail.backToLogin")}
              </button>
            </div>

            <p className="mt-5 text-center text-sm text-slate-500">
              {t("auth.checkEmail.useDifferentEmail")}{" "}
              <Link
                to={WEB_ROUTES.signup}
                className="font-medium text-slate-950 underline-offset-2 hover:underline"
              >
                {t("auth.checkEmail.createAnotherAccount")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
