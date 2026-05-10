import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import { AccountStep } from "./signup/AccountStep";
import { IntentStep } from "./signup/IntentStep";
import { ProfileStep } from "./signup/ProfileStep";
import { SignupAside } from "./signup/SignupAside";
import { SignupStepHeader } from "./signup/SignupStepHeader";
import { useSignupFlow } from "./signup/useSignupFlow";

export function SignupPage() {
  const { t } = useTranslation();
  const signup = useSignupFlow();

  if (signup.redirectTo) {
    return <Navigate to={signup.redirectTo} replace />;
  }

  if (signup.showProfileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <PlatformHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6 lg:px-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">{t("common.loading")}</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />

      <main className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <SignupStepHeader
              currentStep={signup.currentStep}
              form={signup.form}
              showPasswordStep={signup.showPasswordStep}
              showProfileStep={signup.showProfileStep}
              totalSteps={signup.totalSteps}
            />

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {signup.error ? (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {signup.error}
                </div>
              ) : null}

              {signup.showPasswordStep ? (
                <AccountStep
                  form={signup.form}
                  session={signup.session}
                  setForm={signup.setForm}
                  user={signup.user}
                />
              ) : null}

              {signup.showProfileStep ? (
                <ProfileStep
                  form={signup.form}
                  onRoleChange={signup.handleRoleChange}
                  previewInitials={signup.previewInitials}
                  setForm={signup.setForm}
                />
              ) : null}

              {signup.showIntentStep ? (
                <IntentStep
                  form={signup.form}
                  intentOptions={signup.intentOptions}
                  setForm={signup.setForm}
                />
              ) : null}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={signup.handlePreviousStep}
                  disabled={signup.loading || signup.stepIndex === 0}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("auth.signup.back")}
                </button>
                <button
                  type="button"
                  onClick={signup.handleNextStep}
                  disabled={signup.loading}
                  className="inline-flex min-w-36 justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {signup.loading
                    ? t("common.loading")
                    : signup.showIntentStep
                      ? t("auth.signup.finish")
                      : t("common.continue")}
                </button>
              </div>

              <p className="mt-4 text-center text-sm text-slate-500">
                {t("auth.signup.hasAccount")}{" "}
                <Link
                  to={WEB_ROUTES.login}
                  className="font-medium text-slate-950 underline-offset-2 hover:underline"
                >
                  {t("auth.signup.loginLink")}
                </Link>
              </p>
            </section>
          </div>
        </section>

        <SignupAside />
      </main>
    </div>
  );
}
