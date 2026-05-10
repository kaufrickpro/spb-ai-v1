import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AuthorProfileDetailsSchema,
  type AuthorProfileDetails,
  type Locale,
} from "@marketplace/contracts";
import { getApiErrorMessage } from "../api/client";
import { useCompleteOnboardingDetails } from "../profiles/useProfileSurfaces";
import { Field } from "./ProfileFields";

export function AuthorDetailsCard({
  authorDetails,
}: {
  authorDetails: AuthorProfileDetails | null;
}) {
  const { t } = useTranslation();
  const completeDetails = useCompleteOnboardingDetails();
  const [isEditing, setIsEditing] = useState(false);
  const [biography, setBiography] = useState("");
  const [primaryGenre, setPrimaryGenre] = useState("");
  const [writingLanguages, setWritingLanguages] = useState<Locale[]>(["tr"]);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorDetails) {
      return;
    }

    setBiography(authorDetails.biography);
    setPrimaryGenre(authorDetails.primaryGenre);
    setWritingLanguages(authorDetails.writingLanguages);
  }, [authorDetails]);

  function toggleLanguage(language: Locale, enabled: boolean) {
    setWritingLanguages((current) => {
      if (enabled) {
        return current.includes(language) ? current : [...current, language];
      }

      return current.filter((item) => item !== language);
    });
  }

  function submitDetails() {
    const parsed = AuthorProfileDetailsSchema.safeParse({
      role: "author",
      biography,
      primaryGenre,
      writingLanguages,
    });

    if (!parsed.success) {
      setDetailsError(
        parsed.error.issues[0]?.message ?? t("profile.authorDetails.invalid"),
      );
      return;
    }

    setDetailsError(null);
    completeDetails.mutate(parsed.data, {
      onSuccess: () => setIsEditing(false),
    });
  }

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t("profile.authorDetails.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("profile.authorDetails.description")}
          </p>
        </div>
        {!isEditing ? (
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            {t("profile.authorDetails.edit")}
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitDetails();
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            {t("profile.authorDetails.biography.label")}
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              maxLength={1000}
              onChange={(event) => setBiography(event.target.value)}
              placeholder={t("profile.authorDetails.biography.placeholder")}
              value={biography}
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            {t("profile.authorDetails.primaryGenre.label")}
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              maxLength={80}
              onChange={(event) => setPrimaryGenre(event.target.value)}
              placeholder={t("profile.authorDetails.primaryGenre.placeholder")}
              value={primaryGenre}
            />
          </label>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">
              {t("profile.authorDetails.writingLanguages.label")}
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {(["tr", "en"] as const).map((language) => (
                <label
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  key={language}
                >
                  <input
                    checked={writingLanguages.includes(language)}
                    onChange={(event) =>
                      toggleLanguage(language, event.target.checked)
                    }
                    type="checkbox"
                  />
                  {t(`profile.authorDetails.languages.${language}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={completeDetails.isPending}
              type="submit"
            >
              {t("profile.authorDetails.save")}
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              {t("profile.authorDetails.cancel")}
            </button>
          </div>

          {completeDetails.isSuccess ? (
            <p className="mt-3 text-sm text-emerald-700">
              {t("profile.authorDetails.saved")}
            </p>
          ) : null}
          {detailsError || completeDetails.isError ? (
            <p className="mt-3 text-sm text-rose-700">
              {detailsError ?? getApiErrorMessage(completeDetails.error)}
            </p>
          ) : null}
        </form>
      ) : (
        <AuthorDetailsReadOnly authorDetails={authorDetails} />
      )}
    </section>
  );
}

function AuthorDetailsReadOnly({
  authorDetails,
}: {
  authorDetails: AuthorProfileDetails | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field
        label={t("profile.authorDetails.biography.label")}
        value={authorDetails?.biography ?? t("profile.authorDetails.empty")}
      />
      <Field
        label={t("profile.authorDetails.primaryGenre.label")}
        value={authorDetails?.primaryGenre ?? t("profile.authorDetails.empty")}
      />
      <Field
        label={t("profile.authorDetails.writingLanguages.label")}
        value={
          authorDetails
            ? authorDetails.writingLanguages
                .map((language) =>
                  t(`profile.authorDetails.languages.${language}`),
                )
                .join(", ")
            : t("profile.authorDetails.empty")
        }
      />
    </div>
  );
}
