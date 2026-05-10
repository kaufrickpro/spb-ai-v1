import { billingPlanCatalog } from "@marketplace/contracts";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";

export function PricingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <p className="text-sm font-medium text-slate-500">
            {t("pricing.kicker")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("pricing.title")}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {t("pricing.description")}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {billingPlanCatalog.map((plan) => (
            <article
              key={plan.slug}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(`pricing.period.${plan.billingPeriod}`)}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{plan.displayName}</h2>
              <p className="mt-3 text-sm text-slate-600">
                {t("pricing.limitLine", {
                  intros: plan.limits.introRequestsPerPeriod,
                  storage: formatMb(plan.limits.storageBytes),
                })}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {plan.limits.directoryVisibility
                  ? t("pricing.directoryIncluded")
                  : t("pricing.directoryNotIncluded")}
              </p>
              <p className="mt-4 text-sm font-medium text-slate-500">
                {t("pricing.launchPricingSoon")}
              </p>
            </article>
          ))}
        </section>

        <div>
          <Link
            to={WEB_ROUTES.signup}
            className="inline-flex rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            {t("pricing.cta")}
          </Link>
        </div>
      </main>
    </div>
  );
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
