import { ChevronDown, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NotificationBell } from "../notifications/NotificationBell";
import { WEB_ROUTES } from "../routing/routes";

export function DesktopAccountActions({
  hasAdminMembership,
  loading,
  onSignOut,
  session,
  showMarketplaceNotifications,
  userLabel,
}: {
  hasAdminMembership: boolean;
  loading: boolean;
  onSignOut: () => void;
  session: unknown;
  showMarketplaceNotifications: boolean;
  userLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <>
      {!loading && !session ? (
        <>
          <Link
            to={WEB_ROUTES.login}
            className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t("nav.login")}
          </Link>
          <Link
            to={WEB_ROUTES.signup}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
          >
            {t("nav.signup")}
          </Link>
        </>
      ) : null}

      {!loading && session ? (
        <>
          {showMarketplaceNotifications ? <NotificationBell /> : null}

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-white/40 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
              <UserRound className="h-4 w-4" />
              <span>{userLabel}</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-200 bg-white p-1 text-slate-900 shadow-lg">
              {hasAdminMembership ? (
                <>
                  <Link
                    to={WEB_ROUTES.admin}
                    className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    {t("nav.admin")}
                  </Link>
                  <Link
                    to={WEB_ROUTES.adminSettings}
                    className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    {t("adminNav.settings")}
                  </Link>
                </>
              ) : (
                <>
                  {showMarketplaceNotifications ? (
                    <Link
                      to={WEB_ROUTES.notifications}
                      className="rounded-md border border-white/30 px-3 py-2 text-sm"
                    >
                      {t("appNav.notifications")}
                    </Link>
                  ) : null}
                  <Link
                    to={WEB_ROUTES.profile}
                    className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    {t("appNav.profile")}
                  </Link>
                  <Link
                    to={WEB_ROUTES.settings}
                    className="block rounded px-3 py-2 text-sm hover:bg-slate-100"
                  >
                    {t("appNav.settings")}
                  </Link>
                </>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="block w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              >
                {t("auth.signOut")}
              </button>
            </div>
          </details>
        </>
      ) : null}
    </>
  );
}

export function MobileAccountPanel({
  hasAdminMembership,
  loading,
  onSignOut,
  session,
  showMarketplaceNotifications,
  userEmail,
  userLabel,
}: {
  hasAdminMembership: boolean;
  loading: boolean;
  onSignOut: () => void;
  session: unknown;
  showMarketplaceNotifications: boolean;
  userEmail: string | null;
  userLabel: string;
}) {
  const { t } = useTranslation();

  if (!loading && !session) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <Link
          to={WEB_ROUTES.login}
          className="rounded-md border border-white/40 px-4 py-2 text-center text-sm font-semibold text-white"
        >
          {t("nav.login")}
        </Link>
        <Link
          to={WEB_ROUTES.signup}
          className="rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-slate-900"
        >
          {t("nav.signup")}
        </Link>
      </div>
    );
  }

  if (!loading && session) {
    return (
      <div className="mt-4 rounded-md border border-white/20 p-3">
        <p className="text-sm font-semibold">{userLabel}</p>
        <p className="text-xs text-slate-300">{userEmail ?? ""}</p>
        <div className="mt-3 flex flex-col gap-2">
          {hasAdminMembership ? (
            <>
              <Link
                to={WEB_ROUTES.admin}
                className="rounded-md border border-white/30 px-3 py-2 text-sm"
              >
                {t("nav.admin")}
              </Link>
              <Link
                to={WEB_ROUTES.adminSettings}
                className="rounded-md border border-white/30 px-3 py-2 text-sm"
              >
                {t("adminNav.settings")}
              </Link>
            </>
          ) : (
            <>
              {showMarketplaceNotifications ? (
                <Link
                  to={WEB_ROUTES.notifications}
                  className="rounded-md border border-white/30 px-3 py-2 text-sm"
                >
                  {t("appNav.notifications")}
                </Link>
              ) : null}
              <Link
                to={WEB_ROUTES.profile}
                className="rounded-md border border-white/30 px-3 py-2 text-sm"
              >
                {t("appNav.profile")}
              </Link>
              <Link
                to={WEB_ROUTES.settings}
                className="rounded-md border border-white/30 px-3 py-2 text-sm"
              >
                {t("appNav.settings")}
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-md border border-red-200/60 px-3 py-2 text-left text-sm text-red-200"
          >
            {t("auth.signOut")}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
