import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "@supabase/supabase-js";
import { FieldLabel } from "./FieldLabel";
import type { SignupFormState } from "./types";

export function AccountStep({
  form,
  session,
  setForm,
  user,
}: {
  form: SignupFormState;
  session: unknown;
  setForm: Dispatch<SetStateAction<SignupFormState>>;
  user: User | null;
}) {
  const { t } = useTranslation();

  if (session) {
    return (
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">
          {t("auth.signup.accountStep.signedInTitle")}
        </p>
        <p className="mt-1">
          {t("auth.signup.accountStep.signedInDescription", {
            email: user?.email ?? t("appNav.accountFallback"),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FieldLabel label={t("auth.signup.email")} htmlFor="signup-email">
        <input
          id="signup-email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              email: event.target.value,
            }))
          }
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
        />
      </FieldLabel>

      <FieldLabel label={t("auth.signup.password")} htmlFor="signup-password">
        <input
          id="signup-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          value={form.password}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              password: event.target.value,
            }))
          }
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
        />
      </FieldLabel>

      <FieldLabel
        label={t("auth.signup.confirmPassword")}
        htmlFor="signup-password-confirm"
      >
        <input
          id="signup-password-confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          value={form.confirmPassword}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              confirmPassword: event.target.value,
            }))
          }
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
        />
      </FieldLabel>
    </div>
  );
}
