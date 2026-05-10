import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/client";
import { PlatformHeader } from "../layout/PlatformHeader";
import { WEB_ROUTES } from "../routing/routes";
import {
  useBillingSubscription,
  useBillingUsage,
  usePaytrCheckoutToken,
  useStartTrial,
} from "./useBilling";

export function BillingPage() {
  const { t } = useTranslation();
  const subscription = useBillingSubscription();
  const usage = useBillingUsage();
  const startTrial = useStartTrial();
  const checkout = usePaytrCheckoutToken();

  const isLoading = subscription.isPending || usage.isPending;
  const error = subscription.error ?? usage.error;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PlatformHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t("billing.kicker")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{t("billing.title")}</h1>
        </div>

        {isLoading ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">{t("common.loading")}</p>
          </section>
        ) : error ? (
          <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-rose-900">
              {t("billing.errorTitle")}
            </h2>
            <p className="mt-2 text-sm text-rose-700">
              {getApiErrorMessage(error)}
            </p>
          </section>
        ) : subscription.data && usage.data ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    {t("billing.currentStatus")}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {t(
                      `billing.status.${subscription.data.subscription.entitlementStatus}`,
                    )}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {subscription.data.subscription.activePlan
                      ? subscription.data.subscription.activePlan.displayName
                      : t("billing.noActivePlan")}
                  </p>
                </div>
                {subscription.data.subscription.capabilities.startTrial
                  .allowed ? (
                  <button
                    type="button"
                    onClick={() => startTrial.mutate()}
                    className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={startTrial.isPending}
                  >
                    {t("billing.startTrial")}
                  </button>
                ) : (
                  <Link
                    to={WEB_ROUTES.pricing}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {t("billing.viewPricing")}
                  </Link>
                )}
              </div>
              {startTrial.isError ? (
                <p className="mt-3 text-sm text-rose-700">
                  {getApiErrorMessage(startTrial.error)}
                </p>
              ) : null}
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <MeterCard
                label={t("billing.introUsage")}
                value={`${usage.data.usage.introRequests.used} / ${usage.data.usage.introRequests.limit}`}
              />
              <MeterCard
                label={t("billing.storageUsage")}
                value={`${formatMb(usage.data.usage.storage.usedBytes)} / ${formatMb(
                  usage.data.usage.storage.limitBytes,
                )}`}
              />
              <MeterCard
                label={t("billing.directoryVisibility")}
                value={
                  usage.data.usage.directoryVisibility.allowed
                    ? t("billing.enabled")
                    : t("billing.disabled")
                }
              />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">{t("billing.plans")}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {subscription.data.subscription.plans.map((plan) => (
                  <div
                    key={plan.slug}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <h3 className="font-medium">{plan.displayName}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {t("billing.planLimits", {
                        intros: plan.limits.introRequestsPerPeriod,
                        storage: formatMb(plan.limits.storageBytes),
                        support: t(
                          `billing.support.${plan.limits.supportLevel}`,
                        ),
                      })}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      {plan.kind === "paid" &&
                      plan.checkoutEnabled &&
                      subscription.data.subscription.role === plan.role ? (
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          disabled={checkout.isPending}
                          onClick={() => checkout.mutate(plan.slug)}
                        >
                          {checkout.isPending
                            ? t("billing.checkoutLoading")
                            : t("billing.checkout")}
                        </button>
                      ) : (
                        t("billing.checkoutUnavailable")
                      )}
                    </p>
                  </div>
                ))}
              </div>
              {checkout.isError ? (
                <p className="mt-3 text-sm text-rose-700">
                  {getApiErrorMessage(checkout.error)}
                </p>
              ) : null}
              {checkout.data ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">
                    {t("billing.checkoutReady")}
                  </p>
                  <iframe
                    title={t("billing.checkoutFrameTitle")}
                    src={checkout.data.checkout.iframeUrl}
                    className="mt-3 h-[620px] w-full rounded-md border border-slate-200 bg-white"
                  />
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function MeterCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
