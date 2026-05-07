import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "../api/client";
import { PlatformHeader } from "../layout/PlatformHeader";
import { usePublicPublishers } from "../profiles/useProfileSurfaces";

export function PublicPublishersPage() {
  const { t } = useTranslation();
  const query = usePublicPublishers();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("publicPublishers.kicker")}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            {t("publicPublishers.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {t("publicPublishers.description")}
          </p>
        </div>

        {query.isPending ? (
          <SurfaceMessage>{t("common.loading")}</SurfaceMessage>
        ) : query.isError ? (
          <SurfaceMessage tone="error">
            {getApiErrorMessage(query.error)}
          </SurfaceMessage>
        ) : query.data.publishers.length === 0 ? (
          <SurfaceMessage>{t("publicPublishers.empty")}</SurfaceMessage>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.publishers.map((publisher) => (
              <article
                key={publisher.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <img
                  alt=""
                  src={publisher.logoUrl}
                  className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
                />
                <h2 className="mt-4 text-lg font-semibold">{publisher.name}</h2>
                <a
                  className="mt-3 inline-flex text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
                  href={publisher.websiteUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("publicPublishers.website")}
                </a>
              </article>
            ))}
          </section>
        )}
      </main>
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
