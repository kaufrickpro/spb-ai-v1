import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import spbLogo from "../../assets/SPBLogo.png";
import { WEB_ROUTES } from "../routing/routes";
import { useAuth } from "../auth/AuthContext";
import { useAdminSurface } from "../admin/useAdminSurface";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";
import { supabase } from "../supabase/client";
import {
  DesktopAccountActions,
  MobileAccountPanel,
} from "./PlatformHeaderAccountActions";
import { PlatformHeaderLanguageToggle } from "./PlatformHeaderLanguageToggle";
import { PlatformHeaderNavLinks } from "./PlatformHeaderNavLinks";
import {
  adminNavigation,
  appNavigation,
  publicNavigation,
} from "./platformHeaderNavigation";

export function PlatformHeader() {
  const { t } = useTranslation();
  const { session, loading, user } = useAuth();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled: Boolean(session) && !loading && !adminSurface.hasAdminAccess,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isAuthenticated = !loading && Boolean(session);
  const isAdminContext =
    isAuthenticated &&
    (adminSurface.hasAdminAccess || adminSurface.hasAdminMembership);

  const marketplaceRole = profileQuery.data?.profile?.role ?? null;
  const showMarketplaceNotifications = Boolean(
    isAuthenticated && !isAdminContext && profileQuery.data?.profile,
  );
  const navigation = useMemo(() => {
    if (!isAuthenticated) return publicNavigation;
    if (isAdminContext) return adminNavigation;
    return appNavigation.filter((item) =>
      item.key === "manuscripts" ? marketplaceRole === "author" : true,
    );
  }, [isAdminContext, isAuthenticated, marketplaceRole]);

  const userLabel = user?.email?.split("@")[0] || t("appNav.accountFallback");

  async function handleSignOut() {
    await supabase.auth.signOut();
    void navigate(WEB_ROUTES.root);
  }

  return (
    <header className="border-b border-slate-800 bg-slate-900 text-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link to={WEB_ROUTES.root} className="shrink-0">
          <img
            src={spbLogo}
            alt={t("app.titleShort")}
            className="h-12 w-auto sm:h-14"
          />
        </Link>

        <PlatformHeaderNavLinks
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
          isAdminContext={isAdminContext}
          isAuthenticated={isAuthenticated}
          itemClassName={(isActive) =>
            `rounded-md px-3 py-2 text-sm transition ${
              isActive
                ? "bg-white/20 text-white"
                : "text-slate-100 hover:bg-white/10"
            }`
          }
          navigation={navigation}
          pathname={location.pathname}
        />

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <PlatformHeaderLanguageToggle />
          <DesktopAccountActions
            hasAdminMembership={adminSurface.hasAdminMembership}
            loading={loading}
            onSignOut={() => void handleSignOut()}
            session={session}
            showMarketplaceNotifications={showMarketplaceNotifications}
            userLabel={userLabel}
          />
        </div>

        <button
          type="button"
          aria-label={t("nav.openMenu")}
          className="ml-auto rounded-md border border-white/40 p-2 text-white lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/55 lg:hidden">
          <aside className="h-full w-full bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("nav.menu")}</p>
              <button
                type="button"
                aria-label={t("nav.closeMenu")}
                className="rounded-md border border-white/40 p-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <PlatformHeaderNavLinks
              className="mt-4 space-y-1"
              isAdminContext={isAdminContext}
              isAuthenticated={isAuthenticated}
              itemClassName={(isActive) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-slate-100 hover:bg-white/10"
                }`
              }
              navigation={navigation}
              pathname={location.pathname}
            />

            <PlatformHeaderLanguageToggle className="mt-4" />
            <MobileAccountPanel
              hasAdminMembership={adminSurface.hasAdminMembership}
              loading={loading}
              onSignOut={() => void handleSignOut()}
              session={session}
              showMarketplaceNotifications={showMarketplaceNotifications}
              userEmail={user?.email ?? null}
              userLabel={userLabel}
            />
          </aside>
        </div>
      ) : null}
    </header>
  );
}
