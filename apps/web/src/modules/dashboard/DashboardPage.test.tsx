import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

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
      isPending: false,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(markup).not.toContain("/app/manuscripts");
    expect(markup).toContain("/app/matches");
  });
});
