import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGuard, AuthorGuard, GuestGuard } from "./AuthGuard";
import { PlatformHeader } from "../layout/PlatformHeader";
import { resolveAdminSurfaceState } from "../admin/adminSurface";

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

describe("AdminGuard", () => {
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

  it("does not render admin children for non-admin sessions", () => {
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
      state: "denied",
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <AdminGuard>
          <div>secret admin content</div>
        </AdminGuard>
      </MemoryRouter>,
    );

    expect(markup).not.toContain("secret admin content");
  });

  it("renders admin children for admin sessions", () => {
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
      status: "allowed",
      state: "allowed",
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <AdminGuard>
          <div>secret admin content</div>
        </AdminGuard>
      </MemoryRouter>,
    );

    expect(markup).toContain("secret admin content");
  });
});

describe("GuestGuard", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAdminSurface.mockReset();
    mockUseMarketplaceProfile.mockReset();
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isPending: false,
    });
  });

  it("does not render guest content for authenticated admin users", () => {
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
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isPending: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <GuestGuard>
          <div>guest-only content</div>
        </GuestGuard>
      </MemoryRouter>,
    );

    expect(markup).not.toContain("guest-only content");
  });

  it("renders signup content for authenticated users while profile checks are still loading", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
      loading: false,
    });
    mockUseAdminSurface.mockReturnValue({
      canRenderAdminSurface: false,
      hasAdminAccess: false,
      hasAdminMembership: false,
      isLoading: true,
      requiresLogin: false,
      requiresMfa: false,
      state: "loading",
    });
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isPending: true,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/signup"]}>
        <GuestGuard>
          <div>signup wizard content</div>
        </GuestGuard>
      </MemoryRouter>,
    );

    expect(markup).toContain("signup wizard content");
  });
});

describe("resolveAdminSurfaceState", () => {
  it("keeps admin content hidden while access is loading", () => {
    expect(
      resolveAdminSurfaceState({
        accessError: false,
        accessLoading: true,
        authLoading: false,
        hasAccess: false,
        hasSession: true,
      }),
    ).toBe("loading");
  });

  it("denies admin content when access lookup fails", () => {
    expect(
      resolveAdminSurfaceState({
        accessError: true,
        accessLoading: false,
        authLoading: false,
        hasAccess: false,
        hasSession: true,
      }),
    ).toBe("denied");
  });

  it("returns MFA-required when the admin session has not satisfied MFA", () => {
    expect(
      resolveAdminSurfaceState({
        accessError: false,
        accessLoading: false,
        authLoading: false,
        hasAccess: false,
        hasSession: true,
        status: "mfa_required",
      }),
    ).toBe("mfa_required");
  });
});

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
});

describe("AuthorGuard", () => {
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

  it("does not render author-only content for publisher accounts", () => {
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
      <MemoryRouter>
        <AuthorGuard>
          <div>author-only content</div>
        </AuthorGuard>
      </MemoryRouter>,
    );

    expect(markup).not.toContain("author-only content");
    expect(markup).toContain("manuscripts.forbidden.title");
  });
});
