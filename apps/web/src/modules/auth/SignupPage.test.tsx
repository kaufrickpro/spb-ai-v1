import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupPage } from "./SignupPage";
import { WEB_ROUTES } from "../routing/routes";

const mockUseAuth = vi.fn();
const mockUseAdminSurface = vi.fn();
const mockUseMarketplaceProfile = vi.fn();

vi.mock("./AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../admin/useAdminSurface", () => ({
  useAdminSurface: () => mockUseAdminSurface(),
}));

vi.mock("../profile/useMarketplaceProfile", () => ({
  useMarketplaceProfile: () => mockUseMarketplaceProfile(),
}));

vi.mock("react-router-dom", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) =>
      React.createElement("span", { "data-navigate-to": to }),
  };
});

vi.mock("../supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}));

vi.mock("../api/client", () => ({
  getApiErrorCode: vi.fn(),
  getApiErrorMessage: vi.fn(),
  webApiClient: {
    request: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      if (key === "auth.signup.stepCounter") {
        return `Step ${values?.current} of ${values?.total}`;
      }

      return key;
    },
    i18n: {
      resolvedLanguage: "en",
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

describe("SignupPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAdminSurface.mockReset();
    mockUseMarketplaceProfile.mockReset();

    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1", user_metadata: {} },
      loading: false,
    });
    mockUseAdminSurface.mockReturnValue({
      canRenderAdminSurface: false,
      hasAdminAccess: false,
      hasAdminMembership: false,
      isLoading: false,
      requiresLogin: false,
      requiresMfa: false,
      state: "denied",
    });
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isPending: false,
    });
  });

  it("uses the main 3-step signup wizard for authenticated users without profiles", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/signup"]}>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("Step 1 of 3");
    expect(markup).not.toContain("Step 1 of 2");
  });

  it("does not expose social signup before the profile steps are complete", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/signup"]}>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(markup).not.toContain("auth.social.google");
  });

  it("routes MFA-required staff sessions to admin MFA instead of rendering signup", () => {
    mockUseAdminSurface.mockReturnValue({
      canRenderAdminSurface: false,
      hasAdminAccess: false,
      hasAdminMembership: true,
      isLoading: false,
      requiresLogin: false,
      requiresMfa: true,
      state: "mfa_required",
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/signup"]}>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(markup).toContain(`data-navigate-to="${WEB_ROUTES.adminMfa}"`);
    expect(markup).not.toContain("Step 1 of 3");
  });

  it("routes revoked staff sessions to staff login instead of rendering signup", () => {
    mockUseAdminSurface.mockReturnValue({
      canRenderAdminSurface: false,
      hasAdminAccess: false,
      hasAdminMembership: true,
      isLoading: false,
      isRevoked: true,
      requiresLogin: false,
      requiresMfa: false,
      state: "revoked",
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/signup"]}>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(markup).toContain(
      `data-navigate-to="${WEB_ROUTES.adminLogin}?reason=staff"`,
    );
    expect(markup).not.toContain("Step 1 of 3");
  });
});
