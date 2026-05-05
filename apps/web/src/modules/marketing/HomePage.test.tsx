import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

const mockUseAuth = vi.fn();
const mockUseAdminSurface = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../admin/useAdminSurface", () => ({
  useAdminSurface: () => mockUseAdminSurface(),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <header>platform header</header>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAdminSurface.mockReset();
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
    });
    mockUseAdminSurface.mockReturnValue({
      hasAdminAccess: false,
      isLoading: false,
    });
  });

  it("shows a visible loading state while the initial auth check is pending", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: true,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(markup).toContain("common.loading");
  });

  it("shows a visible loading state while an authenticated admin access check is pending", () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
      loading: false,
    });
    mockUseAdminSurface.mockReturnValue({
      hasAdminAccess: false,
      isLoading: true,
    });

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(markup).toContain("common.loading");
  });
});
