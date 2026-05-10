import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { manuscriptProfilePath } from "../routing/routes";
import {
  AcceptedContact,
  ContactList,
  Field,
  SurfaceMessage,
  SurfaceShell,
  TagList,
} from "./ProfileSurfaceLayout";
import {
  useAuthorProfile,
  useRequestManuscriptAccess,
} from "./useProfileSurfaces";

export function AuthorProfileSurfacePage() {
  const { authorProfileId = "" } = useParams();
  const { t } = useTranslation();
  const query = useAuthorProfile(authorProfileId);
  const requestAccess = useRequestManuscriptAccess();

  return (
    <SurfaceShell title={t("matchProfiles.authorTitle")}>
      {query.isPending ? (
        <SurfaceMessage>{t("common.loading")}</SurfaceMessage>
      ) : query.isError ? (
        <SurfaceMessage tone="error">
          {getApiErrorMessage(query.error)}
        </SurfaceMessage>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-xl font-semibold">
              {query.data.author.displayName}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              {query.data.author.biography}
            </p>
            <ContactList contact={query.data.author.contact} />
            {query.data.author.acceptedIntroContact ? (
              <AcceptedContact
                contact={query.data.author.acceptedIntroContact}
              />
            ) : null}
          </aside>
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <Field
              label={t("matchProfiles.styleStatement")}
              value={query.data.author.styleStatement}
            />
            <TagList
              label={t("matchProfiles.influences")}
              values={query.data.author.influences}
            />
            <h2 className="mt-6 text-lg font-semibold">
              {t("matchProfiles.manuscripts")}
            </h2>
            <div className="mt-3 grid gap-3">
              {query.data.author.manuscripts.map((manuscript) => (
                <article
                  key={manuscript.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <h3 className="font-semibold">{manuscript.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {manuscript.logline}
                  </p>
                  {manuscript.access === "full" ? (
                    <Link
                      className="mt-3 inline-flex text-sm font-medium underline underline-offset-4"
                      to={manuscriptProfilePath(manuscript.id)}
                    >
                      {t("matchProfiles.openManuscript")}
                    </Link>
                  ) : (
                    <button
                      className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      disabled={
                        manuscript.requestStatus !== "none" ||
                        requestAccess.isPending
                      }
                      onClick={() => requestAccess.mutate(manuscript.id)}
                      type="button"
                    >
                      {t(
                        `matchProfiles.requestStatus.${manuscript.requestStatus}`,
                      )}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </SurfaceShell>
  );
}
