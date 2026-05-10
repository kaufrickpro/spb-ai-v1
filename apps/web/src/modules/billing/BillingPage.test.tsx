import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingPage } from "./BillingPage";

const mockUseBillingSubscription = vi.fn();
const mockUseBillingUsage = vi.fn();
const mockUsePaytrCheckoutToken = vi.fn();
const mockUseStartTrial = vi.fn();

vi.mock("./useBilling", () => ({
  useBillingSubscription: () => mockUseBillingSubscription(),
  useBillingUsage: () => mockUseBillingUsage(),
  usePaytrCheckoutToken: () => mockUsePaytrCheckoutToken(),
  useStartTrial: () => mockUseStartTrial(),
}));

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <header>platform header</header>,
}));

vi.mock("../api/client", () => ({
  getApiErrorMessage: () => "billing failed",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("BillingPage", () => {
  beforeEach(() => {
    mockUseBillingSubscription.mockReturnValue({
      data: {
        subscription: {
          activePlan: null,
          capabilities: { startTrial: { allowed: true } },
          entitlementStatus: "trial_available",
          role: "author",
          plans: [
            {
              slug: "author-trial",
              displayName: "Author trial",
              kind: "trial",
              role: "author",
              limits: {
                introRequestsPerPeriod: 5,
                storageBytes: 52_428_800,
                supportLevel: "standard",
              },
            },
          ],
        },
      },
      isPending: false,
      isError: false,
    });
    mockUsePaytrCheckoutToken.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
      mutate: vi.fn(),
    });
    mockUseBillingUsage.mockReturnValue({
      data: {
        usage: {
          directoryVisibility: { allowed: false },
          introRequests: { used: 0, limit: 5 },
          storage: { usedBytes: 0, limitBytes: 52_428_800 },
        },
      },
      isPending: false,
      isError: false,
    });
    mockUseStartTrial.mockReturnValue({
      isPending: false,
      isError: false,
      mutate: vi.fn(),
    });
  });

  it("renders current entitlement, usage, and start trial action", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("billing.status.trial_available");
    expect(markup).toContain("billing.startTrial");
    expect(markup).toContain("0 / 5");
    expect(markup).toContain("Author trial");
  });
});
