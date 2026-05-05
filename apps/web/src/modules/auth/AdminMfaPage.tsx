import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { PlatformHeader } from "../layout/PlatformHeader";
import { useAdminSurface } from "../admin/useAdminSurface";
import { WEB_ROUTES } from "../routing/routes";
import { supabase } from "../supabase/client";

type MfaMode = "loading" | "enroll" | "verify" | "error";

export function AdminMfaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const adminSurface = useAdminSurface();
  const [mode, setMode] = useState<MfaMode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (adminSurface.isLoading || !adminSurface.requiresMfa) {
      return;
    }

    void prepareMfa();
  }, [adminSurface.isLoading, adminSurface.requiresMfa]);

  async function prepareMfa() {
    setMode("loading");
    setError(null);
    const factors = await supabase.auth.mfa.listFactors();

    if (factors.error) {
      setError(factors.error.message);
      setMode("error");
      return;
    }

    const existingTotp = factors.data.totp[0];
    if (existingTotp) {
      setFactorId(existingTotp.id);
      setMode("verify");
      return;
    }

    const enrollment = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Admin console",
    });

    if (enrollment.error) {
      setError(enrollment.error.message);
      setMode("error");
      return;
    }

    setFactorId(enrollment.data.id);
    setQrCode(enrollment.data.totp.qr_code);
    setSecret(enrollment.data.totp.secret);
    setMode("enroll");
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setSubmitting(false);
      setError(challenge.error.message);
      return;
    }

    const verification = await supabase.auth.mfa.verify({
      challengeId: challenge.data.id,
      code,
      factorId,
    });

    if (verification.error) {
      setSubmitting(false);
      setError(verification.error.message);
      return;
    }

    await supabase.auth.refreshSession();
    await queryClient.invalidateQueries({ queryKey: ["admin", "access"] });
    void navigate(WEB_ROUTES.admin, { replace: true });
  }

  if (adminSurface.isLoading || mode === "loading") {
    return null;
  }

  if (adminSurface.hasAdminAccess) {
    return <Navigate to={WEB_ROUTES.admin} replace />;
  }

  if (!adminSurface.requiresMfa) {
    return <Navigate to={WEB_ROUTES.adminLogin} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-950">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">
            {t("auth.adminMfa.title")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {mode === "enroll"
              ? t("auth.adminMfa.enrollDescription")
              : t("auth.adminMfa.verifyDescription")}
          </p>

          {mode === "enroll" && qrCode ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <img
                alt={t("auth.adminMfa.qrAlt")}
                src={qrCode}
                className="mx-auto h-48 w-48"
              />
              <p className="mt-4 break-all rounded-md bg-white px-3 py-2 text-xs text-slate-600">
                {secret}
              </p>
            </div>
          ) : null}

          <form onSubmit={(event) => void handleVerify(event)} className="mt-6">
            {error ? (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {t("auth.adminMfa.code")}
              </span>
              <input
                inputMode="numeric"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.trim())}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? t("common.loading") : t("auth.adminMfa.submit")}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
