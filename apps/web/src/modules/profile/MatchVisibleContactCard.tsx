import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../api/client";
import { useUpdateMatchVisibleContacts } from "../profiles/useProfileSurfaces";
import { buildMatchVisibleContactSettings } from "./matchVisibleContactForm";
import { Field } from "./ProfileFields";

export function MatchVisibleContactCard() {
  const { t } = useTranslation();
  const updateContacts = useUpdateMatchVisibleContacts();
  const [isEditing, setIsEditing] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [showWebsite, setShowWebsite] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {t("profile.matchVisible.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("profile.matchVisible.description")}
          </p>
        </div>
        {!isEditing ? (
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            {t("profile.matchVisible.edit")}
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateContacts.mutate(
              buildMatchVisibleContactSettings({
                publicEmail,
                showEmail,
                showWebsite,
                websiteUrl,
              }),
              { onSuccess: () => setIsEditing(false) },
            );
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            {t("profile.matchVisible.website")}
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://example.com"
              value={websiteUrl}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              checked={showWebsite}
              onChange={(event) => setShowWebsite(event.target.checked)}
              type="checkbox"
            />
            {t("profile.matchVisible.showWebsite")}
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            {t("profile.matchVisible.email")}
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => setPublicEmail(event.target.value)}
              placeholder="submissions@example.com"
              type="email"
              value={publicEmail}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              checked={showEmail}
              onChange={(event) => setShowEmail(event.target.checked)}
              type="checkbox"
            />
            {t("profile.matchVisible.showEmail")}
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={updateContacts.isPending}
              type="submit"
            >
              {t("profile.matchVisible.save")}
            </button>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              {t("profile.matchVisible.cancel")}
            </button>
          </div>
          {updateContacts.isSuccess ? (
            <p className="mt-3 text-sm text-emerald-700">
              {t("profile.matchVisible.saved")}
            </p>
          ) : null}
          {updateContacts.isError ? (
            <p className="mt-3 text-sm text-rose-700">
              {getApiErrorMessage(updateContacts.error)}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label={t("profile.matchVisible.website")}
            value={websiteUrl || t("profile.matchVisible.empty")}
          />
          <Field
            label={t("profile.matchVisible.email")}
            value={publicEmail || t("profile.matchVisible.empty")}
          />
        </div>
      )}
    </section>
  );
}
