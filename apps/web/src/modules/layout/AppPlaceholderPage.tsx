import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlatformHeader } from "./PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";

type AppPlaceholderPageProps = {
  titleKey: string;
  descriptionKey: string;
};

export function AppPlaceholderPage({
  titleKey,
  descriptionKey,
}: AppPlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {t(descriptionKey)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={WEB_ROUTES.dashboard}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("dashboard.backToDashboard")}
            </Link>
            <Link
              to={WEB_ROUTES.manuscripts}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t("dashboard.openManuscripts")}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
