import { describe, expect, it } from "vitest";
import {
  getEmailDeliveryErrorMessageKey,
  getLoginErrorMessageKey,
  signupRequiresEmailConfirmation,
} from "./authMessages";

describe("getLoginErrorMessageKey", () => {
  it("maps unconfirmed-email errors to a dedicated message", () => {
    expect(getLoginErrorMessageKey("Email not confirmed")).toBe(
      "auth.errors.emailNotConfirmed",
    );
  });

  it("maps invalid credential errors to the invalid-credentials message", () => {
    expect(getLoginErrorMessageKey("Invalid login credentials")).toBe(
      "auth.errors.invalidCredentials",
    );
  });

  it("falls back to the generic message for unknown errors", () => {
    expect(getLoginErrorMessageKey("Something unexpected happened")).toBe(
      "auth.errors.generic",
    );
  });
});

describe("getEmailDeliveryErrorMessageKey", () => {
  it("maps Supabase email rate limits to a dedicated message", () => {
    expect(getEmailDeliveryErrorMessageKey("email rate limit exceeded")).toBe(
      "auth.errors.emailRateLimited",
    );
  });

  it("maps generic 429 wording to the email-rate-limit message", () => {
    expect(getEmailDeliveryErrorMessageKey("Too many requests")).toBe(
      "auth.errors.emailRateLimited",
    );
  });

  it("maps SMTP handoff failures to a dedicated message", () => {
    expect(
      getEmailDeliveryErrorMessageKey("Error sending confirmation mail"),
    ).toBe("auth.errors.emailDeliveryFailed");
  });

  it("maps unauthorized default-provider emails to a delivery setup message", () => {
    expect(
      getEmailDeliveryErrorMessageKey("Email address not authorized"),
    ).toBe("auth.errors.emailDeliveryFailed");
  });

  it("falls back to the generic message for unknown email delivery errors", () => {
    expect(getEmailDeliveryErrorMessageKey("Unexpected auth failure")).toBe(
      "auth.errors.generic",
    );
  });
});

describe("signupRequiresEmailConfirmation", () => {
  it("returns true when no session is created after signup", () => {
    expect(signupRequiresEmailConfirmation(null)).toBe(true);
  });

  it("returns false when signup creates a session immediately", () => {
    expect(signupRequiresEmailConfirmation({ access_token: "token" })).toBe(
      false,
    );
  });
});
