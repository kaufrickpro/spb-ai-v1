import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import {
  AcceptedContact,
  ContactList,
  Field,
  SurfaceMessage,
  SurfaceShell,
  TagList,
} from "./ProfileSurfaceLayout";
import { usePublisherProfile } from "./useProfileSurfaces";

export function PublisherProfileSurfacePage() {
  const { publisherProfileId = "" } = useParams();
  const { t } = useTranslation();
  const query = usePublisherProfile(publisherProfileId);

  return (
    <SurfaceShell title={t("matchProfiles.publisherTitle")}>
      {query.isPending ? (
        <SurfaceMessage>{t("common.loading")}</SurfaceMessage>
      ) : query.isError ? (
        <SurfaceMessage tone="error">
          {getApiErrorMessage(query.error)}
        </SurfaceMessage>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {query.data.publisher.logoUrl ? (
              <img
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
                src={query.data.publisher.logoUrl}
              />
            ) : null}
            <h1 className="mt-4 text-xl font-semibold">
              {query.data.publisher.name}
            </h1>
            <ContactList contact={query.data.publisher.contact} />
            {query.data.publisher.acceptedIntroContact ? (
              <AcceptedContact
                contact={query.data.publisher.acceptedIntroContact}
              />
            ) : null}
          </aside>
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <Field
              label={t("matchProfiles.about")}
              value={query.data.publisher.about}
            />
            <Field
              label={t("matchProfiles.editorialFocus")}
              value={query.data.publisher.editorialFocus}
            />
            <Field
              label={t("matchProfiles.lookingFor")}
              value={query.data.publisher.lookingFor}
            />
            <Field
              label={t("matchProfiles.submissionGuidelines")}
              value={query.data.publisher.submissionGuidelines}
            />
            <TagList
              label={t("matchProfiles.acceptedGenres")}
              values={query.data.publisher.acceptedGenres}
            />
            <TagList
              label={t("matchProfiles.acceptedForms")}
              values={query.data.publisher.acceptedManuscriptForms}
            />
            <TagList
              label={t("matchProfiles.recentAcquisitions")}
              values={query.data.publisher.recentAcquisitions}
            />
            <TagList
              label={t("matchProfiles.bestSellingBooks")}
              values={query.data.publisher.bestSellingBooks}
            />
          </section>
        </div>
      )}
    </SurfaceShell>
  );
}
