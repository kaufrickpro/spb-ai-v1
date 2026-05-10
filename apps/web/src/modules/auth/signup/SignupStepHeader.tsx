import { useTranslation } from "react-i18next";
import type { SignupFormState } from "./types";

export function SignupStepHeader({
  currentStep,
  showPasswordStep,
  showProfileStep,
  form,
  totalSteps,
}: {
  currentStep: number;
  showPasswordStep: boolean;
  showProfileStep: boolean;
  form: SignupFormState;
  totalSteps: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-8">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
        {t("auth.signup.stepCounter", {
          current: currentStep,
          total: totalSteps,
        })}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {showPasswordStep
          ? t("auth.signup.title")
          : showProfileStep
            ? t("auth.signup.profileStep.title")
            : t("auth.signup.intentStep.title")}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {showPasswordStep
          ? t("auth.signup.subtitle")
          : showProfileStep
            ? t("auth.signup.profileStep.description")
            : t(`auth.signup.intentStep.description.${form.role}`)}
      </p>
    </div>
  );
}
