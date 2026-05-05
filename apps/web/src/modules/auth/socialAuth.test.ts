import { describe, expect, it, vi } from "vitest";
import {
  createSocialAuthRedirectUrl,
  fetchEnabledSocialProviders,
  isProviderDisabledError,
} from "./socialAuth";

describe("fetchEnabledSocialProviders", () => {
  it("returns only providers enabled by the active Supabase project", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        external: {
          facebook: false,
          google: true,
        },
      }),
    });

    await expect(
      fetchEnabledSocialProviders({
        fetchFn,
        supabaseUrl: "https://project-a.supabase.co",
      }),
    ).resolves.toEqual(["google"]);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://project-a.supabase.co/auth/v1/settings",
      {
        headers: {
          accept: "application/json",
        },
      },
    );
  });

  it("throws when auth settings cannot be loaded", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(
      fetchEnabledSocialProviders({
        fetchFn,
        supabaseUrl: "https://project-b.supabase.co",
      }),
    ).rejects.toThrow("Unable to load Supabase auth settings.");
  });
});

describe("createSocialAuthRedirectUrl", () => {
  it("requests an OAuth URL without forcing a browser redirect first", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: {
        url: "https://accounts.google.com/o/oauth2/v2/auth?example=1",
      },
      error: null,
    });

    await expect(
      createSocialAuthRedirectUrl({
        authClient: { signInWithOAuth },
        provider: "google",
        redirectTo: "http://localhost:5173/auth/callback",
      }),
    ).resolves.toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?example=1",
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      options: {
        redirectTo: "http://localhost:5173/auth/callback",
        skipBrowserRedirect: true,
      },
      provider: "google",
    });
  });

  it("surfaces provider errors instead of navigating away", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: {},
      error: {
        message: "Unsupported provider: provider is not enabled",
      },
    });

    await expect(
      createSocialAuthRedirectUrl({
        authClient: { signInWithOAuth },
        provider: "facebook",
        redirectTo: "http://localhost:5173/auth/callback",
      }),
    ).rejects.toEqual({
      message: "Unsupported provider: provider is not enabled",
    });
  });
});

describe("isProviderDisabledError", () => {
  it("detects Supabase provider-disabled errors", () => {
    expect(
      isProviderDisabledError("Unsupported provider: provider is not enabled"),
    ).toBe(true);
    expect(isProviderDisabledError("Something else failed")).toBe(false);
  });
});
