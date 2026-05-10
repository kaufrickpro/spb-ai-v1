import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { HeaderNavItem } from "./platformHeaderNavigation";
import { isRouteActive } from "./platformHeaderNavigation";

export function PlatformHeaderNavLinks({
  className,
  isAdminContext,
  isAuthenticated,
  itemClassName,
  navigation,
  pathname,
}: {
  className: string;
  isAdminContext: boolean;
  isAuthenticated: boolean;
  itemClassName: (isActive: boolean) => string;
  navigation: HeaderNavItem[];
  pathname: string;
}) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t("nav.platformLabel")} className={className}>
      {navigation.map((item) => {
        const isActive = isRouteActive(pathname, item.to, item.mode);
        const labelKey = isAdminContext
          ? `adminNav.${item.key}`
          : isAuthenticated
            ? `appNav.${item.key}`
            : `nav.${item.key}`;

        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive ? "page" : undefined}
            className={itemClassName(isActive)}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
