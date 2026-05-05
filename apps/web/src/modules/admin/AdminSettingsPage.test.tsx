import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AdminSettingsPage } from "./AdminSettingsPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com" },
  }),
}));

vi.mock("./useAdminSurface", () => ({
  useAdminSurface: () => ({
    adminAccessQuery: {
      data: {
        status: "allowed",
        mfaVerified: true,
      },
    },
  }),
}));

describe("AdminSettingsPage", () => {
  it("shows admin identity and a logout button", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <AdminSettingsPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("auth.signOut");
    expect(markup).toContain("adminPages.settings.identity.title");
    expect(markup).toContain("admin@example.com");
  });
});
