import type { Provider } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getWebConfig } from "../config/config";

export type SocialProvider = Extract<Provider, "google" | "facebook">;

export const SOCIAL_PROVIDERS: SocialProvider[] = ["google", "facebook"];

const SupabaseAuthSettingsSchema = z
  .object({
    external: z
      .object({
        facebook: z.boolean().optional().default(false),
        google: z.boolean().optional().default(false),
      })
      .passthrough(),
  })
  .passthrough();

type FetchResponse = {
  json: () => Promise<unknown>;
  ok: boolean;
};

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<FetchResponse>;

type SocialAuthClient = {
  signInWithOAuth: (credentials: {
    options: {
      redirectTo: string;
      skipBrowserRedirect: true;
    };
    provider: SocialProvider;
  }) => Promise<{
    data: { url?: null | string };
    error: null | { message: string };
  }>;
};

const socialProviderCache = new Map<string, Promise<SocialProvider[]>>();

export async function fetchEnabledSocialProviders(
  input: {
    fetchFn?: FetchLike;
    supabaseUrl?: string;
  } = {},
): Promise<SocialProvider[]> {
  const supabaseUrl = input.supabaseUrl ?? getWebConfig().supabaseUrl;
  const fetchFn = input.fetchFn ?? readGlobalFetch();

  if (!fetchFn) {
    return [];
  }

  const cacheKey = supabaseUrl;
  const cached = socialProviderCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const response = await fetchFn(
      new URL("/auth/v1/settings", supabaseUrl).toString(),
      {
        headers: {
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error("Unable to load Supabase auth settings.");
    }

    const payload = SupabaseAuthSettingsSchema.parse(await response.json());

    return SOCIAL_PROVIDERS.filter((provider) => payload.external[provider]);
  })();

  socialProviderCache.set(cacheKey, request);

  try {
    return await request;
  } catch (error) {
    socialProviderCache.delete(cacheKey);
    throw error;
  }
}

export async function createSocialAuthRedirectUrl(input: {
  authClient: SocialAuthClient;
  provider: SocialProvider;
  redirectTo: string;
}): Promise<{ url: string }> {
  const { data, error } = await input.authClient.signInWithOAuth({
    provider: input.provider,
    options: {
      redirectTo: input.redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("Missing OAuth redirect URL.");
  }

  return { url: data.url };
}

export function isProviderDisabledError(message: string) {
  return message.toLowerCase().includes("provider is not enabled");
}

export function useSocialAuthProviders() {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    void fetchEnabledSocialProviders()
      .then((enabledProviders) => {
        if (!isActive) {
          return;
        }

        setProviders(enabledProviders);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setProviders([]);
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return { isLoading, providers };
}

function readGlobalFetch(): FetchLike | null {
  if (typeof fetch !== "function") {
    return null;
  }

  return fetch.bind(globalThis) as FetchLike;
}
