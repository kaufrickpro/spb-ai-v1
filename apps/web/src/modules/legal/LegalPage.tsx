import { useTranslation } from "react-i18next";
import { PlatformHeader } from "../layout/PlatformHeader";

type LegalPageProps = {
  titleKey: string;
  descriptionKey: string;
};

export function LegalPage({ titleKey, descriptionKey }: LegalPageProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            {t("app.kicker")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{t(titleKey)}</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {t(descriptionKey)}
          </p>
        </section>
      </main>
    </div>
  );
}
