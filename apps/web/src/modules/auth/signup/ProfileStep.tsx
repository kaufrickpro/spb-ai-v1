import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { PublicProfileRole } from "@marketplace/contracts";
import { FieldLabel } from "./FieldLabel";
import { stepRoleOptions, type SignupFormState } from "./types";

export function ProfileStep({
  form,
  onRoleChange,
  previewInitials,
  setForm,
}: {
  form: SignupFormState;
  onRoleChange: (role: PublicProfileRole) => void;
  previewInitials: string;
  setForm: Dispatch<SetStateAction<SignupFormState>>;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {form.profilePhotoUrl ? (
          <img
            alt={form.displayName || t("auth.signup.profileStep.photoAlt")}
            src={form.profilePhotoUrl}
            className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500 text-xl font-semibold text-white">
            {previewInitials || "?"}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-900">
            {t("auth.signup.profileStep.photoLabel")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t("auth.signup.profileStep.photoHint")}
          </p>
        </div>
      </div>

      <FieldLabel
        label={t("auth.signup.profileStep.photoInput")}
        htmlFor="signup-photo-url"
      >
        <input
          id="signup-photo-url"
          type="url"
          value={form.profilePhotoUrl}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              profilePhotoUrl: event.target.value,
            }))
          }
          placeholder={t("auth.signup.profileStep.photoPlaceholder")}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
        />
      </FieldLabel>

      <div className="grid gap-3 sm:grid-cols-2">
        {stepRoleOptions.map((role) => (
          <button
            key={role}
            type="button"
            data-selected={form.role === role}
            onClick={() => onRoleChange(role)}
            className="rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-400 data-[selected=true]:border-slate-950 data-[selected=true]:bg-slate-950 data-[selected=true]:text-white"
          >
            <p className="text-sm font-semibold">
              {t(`auth.signup.roles.${role}.title`)}
            </p>
            <p className="mt-1 text-sm text-slate-500 data-[selected=true]:text-white/80">
              {t(`auth.signup.roles.${role}.description`)}
            </p>
          </button>
        ))}
      </div>

      <FieldLabel
        label={t("auth.signup.profileStep.displayName")}
        htmlFor="signup-display-name"
      >
        <input
          id="signup-display-name"
          type="text"
          required
          value={form.displayName}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              displayName: event.target.value,
            }))
          }
          placeholder={t("auth.signup.profileStep.displayNamePlaceholder")}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
        />
      </FieldLabel>
    </div>
  );
}
