import { useTranslation } from "react-i18next";
import type { Profile } from "@marketplace/contracts";
import { Field } from "./ProfileFields";

export function ProfileOverviewCard({ profile }: { profile: Profile }) {
  const { t } = useTranslation();

  return (
    <>
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold">
          {t("profile.placeholder.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("profile.placeholder.description")}
        </p>
      </div>

      <div className="grid gap-4 py-5 sm:grid-cols-2">
        <Field
          label={t("profile.fields.displayName")}
          value={profile.displayName}
        />
        <Field
          label={t("profile.fields.role")}
          value={t(`profile.roles.${profile.role}`)}
        />
        <Field
          label={t("profile.fields.photo")}
          value={profile.profilePhotoUrl ?? t("profile.fields.photoFallback")}
        />
        <Field
          label={t("profile.fields.intent")}
          value={t(`profile.signupIntent.${profile.signupIntent}`)}
        />
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        {t("profile.placeholder.nextStep")}
      </div>
    </>
  );
}
