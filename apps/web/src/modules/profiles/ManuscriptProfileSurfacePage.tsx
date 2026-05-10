import { ApiRoutes } from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage, webApiClient } from "../api/client";
import { authorProfilePath } from "../routing/routes";
import {
  AcceptedContact,
  Field,
  SurfaceMessage,
  SurfaceShell,
  TagList,
} from "./ProfileSurfaceLayout";
import { useManuscriptProfile } from "./useProfileSurfaces";

export function ManuscriptProfileSurfacePage() {
  const { manuscriptId = "" } = useParams();
  const { t } = useTranslation();
  const query = useManuscriptProfile(manuscriptId);

  return (
    <SurfaceShell title={t("matchProfiles.manuscriptTitle")}>
      {query.isPending ? (
        <SurfaceMessage>{t("common.loading")}</SurfaceMessage>
      ) : query.isError ? (
        <SurfaceMessage tone="error">
          {getApiErrorMessage(query.error)}
        </SurfaceMessage>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            {query.data.manuscript.primaryGenre}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {query.data.manuscript.title}
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            {query.data.manuscript.logline}
          </p>
          <Field
            label={t("matchProfiles.synopsis")}
            value={query.data.manuscript.synopsis}
          />
          <Field
            label={t("matchProfiles.arcSummary")}
            value={query.data.manuscript.arcSummary}
          />
          <TagList
            label={t("matchProfiles.subgenres")}
            values={query.data.manuscript.subgenres}
          />
          <TagList
            label={t("matchProfiles.audience")}
            values={query.data.manuscript.audienceCategories}
          />
          <TagList
            label={t("matchProfiles.themes")}
            values={query.data.manuscript.declaredThemes}
          />
          {query.data.manuscript.acceptedIntroContact ? (
            <AcceptedContact
              contact={query.data.manuscript.acceptedIntroContact}
            />
          ) : null}
          {query.data.manuscript.acceptedIntroSampleDocumentId ? (
            <button
              className="mt-5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={async () => {
                const response = await webApiClient.request(
                  ApiRoutes.documents.downloadUrl,
                  {
                    params: {
                      id: query.data.manuscript.acceptedIntroSampleDocumentId!,
                    },
                  },
                );
                window.location.assign(response.downloadUrl);
              }}
              type="button"
            >
              {t("matchProfiles.downloadAcceptedSample")}
            </button>
          ) : null}
          <Link
            className="mt-6 inline-flex text-sm font-medium underline underline-offset-4"
            to={authorProfilePath(query.data.manuscript.author.id)}
          >
            {query.data.manuscript.author.displayName}
          </Link>
        </section>
      )}
    </SurfaceShell>
  );
}
