import type { AdminAccessStatus } from "@marketplace/contracts";
import { WEB_ROUTES } from "../routing/routes";

export function resolveAuthenticatedLandingRoute(input: {
  hasAdminAccess: boolean;
  hasProfile: boolean;
}) {
  if (input.hasAdminAccess) {
    return WEB_ROUTES.admin;
  }

  return input.hasProfile ? WEB_ROUTES.profile : WEB_ROUTES.signup;
}

export function resolveAdminLandingRoute(status: AdminAccessStatus) {
  if (status === "allowed") {
    return WEB_ROUTES.admin;
  }

  if (status === "mfa_required") {
    return WEB_ROUTES.adminMfa;
  }

  return WEB_ROUTES.adminLogin;
}
