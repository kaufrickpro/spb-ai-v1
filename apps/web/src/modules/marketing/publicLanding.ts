import { WEB_ROUTES } from "../routing/routes";

export function resolvePublicLandingRoute(input: {
  hasAdminAccess: boolean;
  isRootPage: boolean;
}) {
  if (input.isRootPage && input.hasAdminAccess) {
    return WEB_ROUTES.admin;
  }

  return null;
}
