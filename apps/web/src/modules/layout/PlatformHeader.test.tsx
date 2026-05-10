import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformHeader } from "./PlatformHeader";
import { MobileAccountPanel } from "./PlatformHeaderAccountActions";

const mockUseAuth = vi.fn();
const mockUseAdminSurface = vi.fn();
const mockUseMarketplaceProfile = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../admin/useAdminSurface", () => ({
  useAdminSurface: () => mockUseAdminSurface(),
}));

vi.mock("../profile/useMarketplaceProfile", () => ({
  useMarketplaceProfile: () => mockUseMarketplaceProfile(),
}));

vi.mock("../notifications/NotificationBell", () => ({
  NotificationBell: () => <div>notification bell</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      resolvedLanguage: "en",
      language: "en",
      changeLanguage: vi.fn(),
    },
  }),
}));

describe("PlatformHeader", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAdminSurface.mockReset();
    mockUseMarketplaceProfile.mockReset();
    mockUseMarketplaceProfile.mockReturnValue({
      data: {
        profile: { role: "author" },
      },
      isPending: false,
    });
  });

  it("hides the admin link for authenticated non-admin users", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
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

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformHeader />
      </MemoryRouter>,
    );

    expect(markup).toContain("/app/dashboard");
    expect(markup).not.toContain("/admin");
  });

  it("shows admin navigation instead of app navigation for admin users", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "admin-1" } },
      user: { id: "admin-1" },
      loading: false,
    });
    mockUseAdminSurface.mockReturnValue({
      canRenderAdminSurface: true,
      hasAdminAccess: true,
      hasAdminMembership: true,
      isLoading: false,
      requiresLogin: false,
      requiresMfa: false,
      state: "allowed",
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <PlatformHeader />
      </MemoryRouter>,
    );

    expect(markup).toContain("/admin/reviews");
    expect(markup).not.toContain("/app/manuscripts");
    expect(markup).not.toContain("/app/profile");
  });

  it("hides manuscript navigation for publisher accounts", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "publisher-1" } },
      user: { id: "publisher-1" },
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
      data: {
        profile: { role: "publisher" },
      },
      isPending: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <PlatformHeader />
      </MemoryRouter>,
    );

    expect(markup).not.toContain("/app/manuscripts");
    expect(markup).toContain("/app/requests");
  });

  it("keeps notifications reachable from the mobile marketplace account panel", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <MobileAccountPanel
          hasAdminMembership={false}
          loading={false}
          onSignOut={vi.fn()}
          session={{ user: { id: "user-1" } }}
          showMarketplaceNotifications={true}
          userEmail="author@example.com"
          userLabel="author"
        />
      </MemoryRouter>,
    );

    expect(markup).toContain("/app/notifications");
    expect(markup).toContain("appNav.notifications");
  });
});
