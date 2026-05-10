import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PricingPage } from "./PricingPage";

vi.mock("../layout/PlatformHeader", () => ({
  PlatformHeader: () => <header>platform header</header>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PricingPage", () => {
  it("shows trial and paid plan categories without checkout", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>,
    );

    expect(markup).toContain("Author trial");
    expect(markup).toContain("Publisher Pro annual");
    expect(markup).toContain("pricing.launchPricingSoon");
    expect(markup).not.toContain("PayTR");
  });
});
