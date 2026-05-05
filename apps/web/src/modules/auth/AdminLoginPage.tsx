import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiRoutes } from "@marketplace/contracts";
import { PlatformHeader } from "../layout/PlatformHeader";
import { getApiErrorMessage, webApiClient } from "../api/client";
import { WEB_ROUTES } from "../routing/routes";
import { supabase } from "../supabase/client";
import { useAuth } from "./AuthContext";
import { getLoginErrorMessageKey } from "./authMessages";
import { resolveAdminLandingRoute } from "./entryRouting";

export function AdminLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("reason") === "staff"
      ? t("auth.adminLogin.staffRedirect")
      : null,
  );
  const [blockedMode, setBlockedMode] = useState<"no_access" | "revoked" | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !session) {
      return;
    }

    void routeCurrentStaffSession({
      onBlocked: setBlockedMode,
      onError: setError,
      navigate,
    });
  }, [authLoading, navigate, session]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBlockedMode(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      setError(t(getLoginErrorMessageKey(authError.message)));
      return;
    }

    await routeCurrentStaffSession({
      onBlocked: setBlockedMode,
      onError: setError,
      navigate,
    });
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setBlockedMode(null);
    setError(null);
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
              {t("auth.adminLogin.title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t("auth.adminLogin.subtitle")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {blockedMode ? (
              <div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {blockedMode === "revoked"
                    ? t("auth.adminLogin.revoked")
                    : t("auth.adminLogin.noAccess")}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                  >
                    {t("auth.adminLogin.signOut")}
                  </button>
                  <Link
                    to={WEB_ROUTES.root}
                    className="rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t("auth.adminLogin.returnHome")}
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)}>
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

                <label className="mt-4 block">
                  <span className="text-sm font-medium text-slate-700">
                    {t("auth.login.password")}
                  </span>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading ? t("common.loading") : t("auth.adminLogin.submit")}
                </button>
              </form>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <Link
                to={`${WEB_ROUTES.forgotPassword}?surface=admin`}
                className="font-medium text-slate-950 underline-offset-2 hover:underline"
              >
                {t("auth.login.forgotPassword")}
              </Link>
              <Link
                to={WEB_ROUTES.root}
                className="font-medium text-slate-500 underline-offset-2 hover:underline"
              >
                {t("auth.adminLogin.returnHome")}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

async function routeCurrentStaffSession(input: {
  navigate: ReturnType<typeof useNavigate>;
  onBlocked: (mode: "no_access" | "revoked") => void;
  onError: (message: string | null) => void;
}) {
  try {
    const access = await webApiClient.request(ApiRoutes.admin.access);
    if (access.status === "no_access" || access.status === "revoked") {
      input.onBlocked(access.status);
      return;
    }

    void input.navigate(resolveAdminLandingRoute(access.status), {
      replace: true,
    });
  } catch (error) {
    input.onError(getApiErrorMessage(error));
  }
}
