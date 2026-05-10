import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const mockUseAuth = vi.fn();
const mockUseAdminSurface = vi.fn();
const mockUseMarketplaceProfile = vi.fn();
const mockUseUpdateMatchVisibleContacts = vi.fn();
const mockUseCompleteOnboardingDetails = vi.fn();

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../admin/useAdminSurface", () => ({
  useAdminSurface: () => mockUseAdminSurface(),
}));

vi.mock("./useMarketplaceProfile", () => ({
  useMarketplaceProfile: () => mockUseMarketplaceProfile(),
}));

vi.mock("../profiles/useProfileSurfaces", () => ({
  useCompleteOnboardingDetails: () => mockUseCompleteOnboardingDetails(),
  useUpdateMatchVisibleContacts: () => mockUseUpdateMatchVisibleContacts(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <div>header</div>,
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAdminSurface.mockReset();
    mockUseMarketplaceProfile.mockReset();
    mockUseUpdateMatchVisibleContacts.mockReset();
    mockUseCompleteOnboardingDetails.mockReset();

    mockUseAuth.mockReturnValue({
      user: { email: "kerem@example.com" },
    });
    mockUseAdminSurface.mockReturnValue({
      hasAdminAccess: false,
      isLoading: false,
    });
    mockUseUpdateMatchVisibleContacts.mockReturnValue({
      isError: false,
      isPending: false,
      isSuccess: false,
      mutate: vi.fn(),
    });
    mockUseCompleteOnboardingDetails.mockReturnValue({
      isError: false,
      isPending: false,
      isSuccess: false,
      mutate: vi.fn(),
    });
    mockUseMarketplaceProfile.mockReturnValue({
      data: {
        details: null,
        profile: {
          displayName: "Kerem",
          eligibilityStatus: "limited",
          profilePhotoUrl: null,
          role: "author",
          signupIntent: "find_publisher",
        },
      },
      isError: false,
      isPending: false,
    });
  });

  it("labels profile state as eligibility instead of approval status", () => {
    const markup = renderProfile();

    expect(markup).toContain("profile.summary.eligibility");
    expect(markup).not.toContain("profile.summary.status");
  });

  it("renders author details read-only until the user chooses to edit", () => {
    const markup = renderProfile();

    expect(markup).toContain("profile.authorDetails.title");
    expect(markup).toContain("profile.authorDetails.edit");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("profile.authorDetails.save");
  });

  it("renders match-visible contacts read-only until the user chooses to edit", () => {
    const markup = renderProfile();

    expect(markup).toContain("profile.matchVisible.title");
    expect(markup).toContain("profile.matchVisible.edit");
    expect(markup).not.toContain("profile.matchVisible.save");
    expect(markup).not.toContain('type="checkbox"');
  });
});

function renderProfile() {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}
