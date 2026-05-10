import { useTranslation } from "react-i18next";

export function SignupAside() {
  const { t } = useTranslation();

  return (
    <aside className="hidden overflow-hidden rounded-[32px] bg-slate-950 lg:block">
      <div className="relative h-full min-h-[760px] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.3),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.24),_transparent_25%),linear-gradient(180deg,_#020617,_#111827)] p-8 text-white">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(244,114,182,0.42),_transparent_45%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/60">
              {t("auth.signup.aside.kicker")}
            </p>
            <h2 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
              {t("auth.signup.aside.title")}
            </h2>
            <p className="mt-4 max-w-sm text-sm text-white/70">
              {t("auth.signup.aside.description")}
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm font-medium text-white">
                {t("auth.signup.aside.cardTitle")}
              </p>
              <p className="mt-2 text-sm text-white/70">
                {t("auth.signup.aside.cardBody")}
              </p>
            </div>
            <div className="flex gap-4 text-xs text-white/55">
              <span>{t("auth.signup.aside.footer.one")}</span>
              <span>{t("auth.signup.aside.footer.two")}</span>
              <span>{t("auth.signup.aside.footer.three")}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
