import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const mockUseAuth = vi.fn();
const mockUseAdminSurface = vi.fn();
const mockUseMarketplaceProfile = vi.fn();
const mockUseBillingSubscription = vi.fn();
const mockUseBillingUsage = vi.fn();

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <span>navigate:{to}</span>,
  };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../admin/useAdminSurface", () => ({
  useAdminSurface: () => mockUseAdminSurface(),
}));

vi.mock("../profile/useMarketplaceProfile", () => ({
  useMarketplaceProfile: () => mockUseMarketplaceProfile(),
}));

vi.mock("../billing/useBilling", () => ({
  useBillingSubscription: () => mockUseBillingSubscription(),
  useBillingUsage: () => mockUseBillingUsage(),
}));

vi.mock("../api/client", () => ({
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "profile query failed",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <div>header</div>,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAdminSurface.mockReset();
    mockUseMarketplaceProfile.mockReset();
    mockUseBillingSubscription.mockReset();
    mockUseBillingUsage.mockReset();
    mockUseAuth.mockReturnValue({
      user: { email: "author@example.com" },
    });
    mockUseAdminSurface.mockReturnValue({
      hasAdminAccess: false,
      isLoading: false,
    });
    mockUseMarketplaceProfile.mockReturnValue({
      data: {
        profile: { eligibilityStatus: "eligible", role: "author" },
      },
      isError: false,
      isPending: false,
    });
    mockUseBillingSubscription.mockReturnValue({
      data: { subscription: { entitlementStatus: "trial_available" } },
    });
    mockUseBillingUsage.mockReturnValue({
      data: {
        usage: {
          directoryVisibility: { allowed: false },
          introRequests: { used: 0, limit: 5 },
          storage: { usedBytes: 0 },
        },
      },
    });
  });

  it("shows a loading state while admin access is loading", () => {
    mockUseAdminSurface.mockReturnValue({
      hasAdminAccess: false,
      isLoading: true,
    });
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isError: false,
      isPending: true,
    });

    const markup = renderDashboard();

    expect(markup).toContain("common.loading");
    expect(markup).not.toContain("/app/matches");
  });

  it("shows a loading state while the profile query is pending", () => {
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isError: false,
      isPending: true,
    });

    const markup = renderDashboard();

    expect(markup).toContain("common.loading");
    expect(markup).not.toContain("/app/matches");
  });

  it("shows an explicit profile query error", () => {
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      error: new Error("profile service unavailable"),
      isError: true,
      isPending: false,
    });

    const markup = renderDashboard();

    expect(markup).toContain("dashboard.profileError.title");
    expect(markup).toContain("profile service unavailable");
    expect(markup).not.toContain("/app/matches");
  });

  it("redirects missing marketplace profiles to signup before rendering cards", () => {
    mockUseMarketplaceProfile.mockReturnValue({
      data: null,
      isError: false,
      isPending: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/app/dashboard"]}>
        <Routes>
          <Route path="/app/dashboard" element={<DashboardPage />} />
          <Route path="/signup" element={<div>signup target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain("navigate:/signup");
    expect(markup).not.toContain("/app/matches");
  });

  it("hides the manuscript card for publisher accounts", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "publisher@example.com" },
    });
    mockUseAdminSurface.mockReturnValue({
      hasAdminAccess: false,
      isLoading: false,
    });
    mockUseMarketplaceProfile.mockReturnValue({
      data: {
        profile: { role: "publisher" },
      },
      isError: false,
      isPending: false,
    });

    const markup = renderDashboard();

    expect(markup).not.toContain("/app/manuscripts");
    expect(markup).toContain("/app/matches");
  });

  it("renders role-specific cards only after an author profile is present", () => {
    const markup = renderDashboard();

    expect(markup).toContain("author@example.com");
    expect(markup).toContain("/app/manuscripts");
    expect(markup).toContain("/app/matches");
    expect(markup).toContain("/app/requests");
    expect(markup).toContain("/app/billing");
    expect(markup).toContain("billing.status.trial_available");
  });

  it("prompts limited authors to complete author details", () => {
    mockUseMarketplaceProfile.mockReturnValue({
      data: {
        details: null,
        profile: { eligibilityStatus: "limited", role: "author" },
      },
      isError: false,
      isPending: false,
    });

    const markup = renderDashboard();

    expect(markup).toContain("dashboard.authorDetailsPrompt.title");
    expect(markup).toContain("dashboard.authorDetailsPrompt.cta");
    expect(markup).toContain("/app/profile");
  });
});

function renderDashboard() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}
