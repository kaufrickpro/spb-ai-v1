import { describe, expect, it } from "vitest";
import { resolvePublicLandingRoute } from "./publicLanding";
import { WEB_ROUTES } from "../routing/routes";

describe("resolvePublicLandingRoute", () => {
  it("redirects admins from the root page to admin", () => {
    expect(
      resolvePublicLandingRoute({
        hasAdminAccess: true,
        isRootPage: true,
      }),
    ).toBe(WEB_ROUTES.admin);
  });

  it("keeps non-root marketing pages public for admins", () => {
    expect(
      resolvePublicLandingRoute({
        hasAdminAccess: true,
        isRootPage: false,
      }),
    ).toBeNull();
  });

  it("keeps the root page public for non-admin users", () => {
    expect(
      resolvePublicLandingRoute({
        hasAdminAccess: false,
        isRootPage: true,
      }),
    ).toBeNull();
  });
});
