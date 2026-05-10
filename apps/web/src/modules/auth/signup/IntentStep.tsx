import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { CreateProfileRequest } from "@marketplace/contracts";
import { FieldLabel } from "./FieldLabel";
import type { SignupFormState } from "./types";

export function IntentStep({
  form,
  intentOptions,
  setForm,
}: {
  form: SignupFormState;
  intentOptions: readonly CreateProfileRequest["signupIntent"][];
  setForm: Dispatch<SetStateAction<SignupFormState>>;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <FieldLabel
        label={t(`auth.signup.intentStep.question.${form.role}`)}
        htmlFor="signup-intent"
      >
        <select
          id="signup-intent"
          value={form.signupIntent}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              signupIntent: event.target
                .value as CreateProfileRequest["signupIntent"],
            }))
          }
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
        >
          {intentOptions.map((option) => (
            <option key={option} value={option}>
              {t(`auth.signup.intentOptions.${option}`)}
            </option>
          ))}
        </select>
      </FieldLabel>

      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        {t(`auth.signup.intentStep.help.${form.role}`)}
      </div>
    </div>
  );
}
