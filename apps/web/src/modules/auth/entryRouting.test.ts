import { describe, expect, it } from "vitest";
import {
  resolveAdminLandingRoute,
  resolveAuthenticatedLandingRoute,
} from "./entryRouting";
import { WEB_ROUTES } from "../routing/routes";

describe("resolveAuthenticatedLandingRoute", () => {
  it("sends admins to the admin dashboard", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        hasAdminAccess: true,
        hasProfile: false,
      }),
    ).toBe(WEB_ROUTES.admin);
  });

  it("sends non-admins with profiles to the profile page", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        hasAdminAccess: false,
        hasProfile: true,
      }),
    ).toBe(WEB_ROUTES.profile);
  });

  it("sends non-admins without profiles to the main signup wizard", () => {
    expect(
      resolveAuthenticatedLandingRoute({
        hasAdminAccess: false,
        hasProfile: false,
      }),
    ).toBe(WEB_ROUTES.signup);
  });
});

describe("resolveAdminLandingRoute", () => {
  it("sends MFA-incomplete staff sessions to the admin MFA route", () => {
    expect(resolveAdminLandingRoute("mfa_required")).toBe(WEB_ROUTES.adminMfa);
  });

  it("sends allowed staff sessions to the admin dashboard", () => {
    expect(resolveAdminLandingRoute("allowed")).toBe(WEB_ROUTES.admin);
  });

  it("keeps revoked or missing access at the staff login route", () => {
    expect(resolveAdminLandingRoute("revoked")).toBe(WEB_ROUTES.adminLogin);
    expect(resolveAdminLandingRoute("no_access")).toBe(WEB_ROUTES.adminLogin);
  });
});
