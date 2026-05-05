import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { WEB_ROUTES } from "../routing/routes";
import { AdminShell } from "./AdminShell";

type AdminPlaceholderPageProps = {
  titleKey: string;
  descriptionKey: string;
};

export function AdminPlaceholderPage({
  titleKey,
  descriptionKey,
}: AdminPlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <AdminShell>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{t(titleKey)}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {t(descriptionKey)}
          </p>
          <Link
            to={WEB_ROUTES.admin}
            className="mt-6 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t("admin.backToOverview")}
          </Link>
        </section>
      </main>
    </AdminShell>
  );
}
