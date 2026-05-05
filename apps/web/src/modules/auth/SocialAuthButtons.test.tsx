import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SocialAuthButtons } from "./SocialAuthButtons";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "auth.social.google"
        ? "Continue with Google"
        : key === "auth.social.lastUsed"
          ? "Last used"
          : key,
  }),
}));

describe("SocialAuthButtons", () => {
  it("renders only the Google entry point", () => {
    const markup = renderToStaticMarkup(
      <SocialAuthButtons
        disabled={false}
        lastUsedMethod={null}
        onError={() => undefined}
      />,
    );

    expect(markup).toContain("Continue with Google");
    expect(markup).not.toContain("Continue with Facebook");
  });
});
