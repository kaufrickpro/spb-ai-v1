import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ApiRoutes } from "@marketplace/contracts";
import { getApiErrorMessage, webApiClient } from "../api/client";
import { PlatformHeader } from "../layout/PlatformHeader";
import { authorProfilePath, manuscriptProfilePath } from "../routing/routes";
import {
  useAuthorProfile,
  useManuscriptProfile,
  usePublisherProfile,
  useRequestManuscriptAccess,
} from "./useProfileSurfaces";

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

function SurfaceShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">SPB-AI</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{value}</p>
    </div>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold text-slate-900">{label}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function ContactList({
  contact,
}: {
  contact: {
    email: string | null;
    phone: string | null;
    websiteUrl: string | null;
    socialLinks: Array<{ label: string; url: string }>;
  };
}) {
  const visible = [
    contact.email,
    contact.phone,
    contact.websiteUrl,
    ...contact.socialLinks.map((item) => item.url),
  ].filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <ul className="mt-5 space-y-2 text-sm text-slate-600">
      {contact.email ? <li>{contact.email}</li> : null}
      {contact.phone ? <li>{contact.phone}</li> : null}
      {contact.websiteUrl ? <li>{contact.websiteUrl}</li> : null}
      {contact.socialLinks.map((item) => (
        <li key={item.url}>
          <a className="underline underline-offset-4" href={item.url}>
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function AcceptedContact({
  contact,
}: {
  contact: {
    displayName: string;
    email: string | null;
    phone: string | null;
    websiteUrl: string | null;
    socialLinks: Array<{ label: string; url: string }>;
  };
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
      <p className="font-semibold">{t("matchProfiles.acceptedIntroContact")}</p>
      <p className="mt-1">{contact.displayName}</p>
      <ContactList contact={contact} />
    </div>
  );
}

function SurfaceMessage({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <section
      className={`rounded-lg border bg-white p-6 text-sm shadow-sm ${
        tone === "error"
          ? "border-rose-200 text-rose-700"
          : "border-slate-200 text-slate-600"
      }`}
    >
      {children}
    </section>
  );
}
