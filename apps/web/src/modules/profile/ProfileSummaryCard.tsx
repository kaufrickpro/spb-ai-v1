import { useTranslation } from "react-i18next";
import type { Profile } from "@marketplace/contracts";

type ProfileSummaryCardProps = {
  email?: string;
  profile: Profile;
};

export function ProfileSummaryCard({
  email,
  profile,
}: ProfileSummaryCardProps) {
  const { t } = useTranslation();
  const initials = buildInitials(profile.displayName);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        {profile.profilePhotoUrl ? (
          <img
            alt={profile.displayName}
            src={profile.profilePhotoUrl}
            className="h-24 w-24 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-2xl font-semibold text-white">
            {initials || "?"}
          </div>
        )}

        <h2 className="mt-4 text-lg font-semibold">{profile.displayName}</h2>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        <div>
          <dt className="text-slate-500">{t("profile.summary.role")}</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {t(`profile.roles.${profile.role}`)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("profile.summary.intent")}</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {t(`profile.signupIntent.${profile.signupIntent}`)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("profile.summary.eligibility")}</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {t(`profile.eligibilityStatus.${profile.eligibilityStatus}`)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
