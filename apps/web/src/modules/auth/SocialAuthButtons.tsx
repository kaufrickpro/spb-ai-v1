import { useTranslation } from "react-i18next";
import { WEB_ROUTES } from "../routing/routes";
import { supabase } from "../supabase/client";
import type { AuthMethod } from "./authFlowStorage";
import { setPendingOauthProvider } from "./authFlowStorage";
import {
  createSocialAuthRedirectUrl,
  isProviderDisabledError,
  type SocialProvider,
} from "./socialAuth";

const providers: Array<{
  method: Extract<AuthMethod, SocialProvider>;
  provider: SocialProvider;
}> = [{ method: "google", provider: "google" }];

export function SocialAuthButtons({
  disabled,
  lastUsedMethod,
  onError,
}: {
  disabled: boolean;
  lastUsedMethod: AuthMethod | null;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const sortedProviders = [...providers].sort((left, right) => {
    if (left.method === lastUsedMethod) return -1;
    if (right.method === lastUsedMethod) return 1;
    return 0;
  });

  async function handleClick(provider: SocialProvider) {
    onError("");

    const redirectTo = new URL(
      WEB_ROUTES.authCallback,
      window.location.origin,
    ).toString();

    try {
      const { url } = await createSocialAuthRedirectUrl({
        authClient: supabase.auth,
        provider,
        redirectTo,
      });
      setPendingOauthProvider(provider);
      window.location.assign(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.generic");

      onError(
        isProviderDisabledError(message)
          ? t("auth.social.unavailable", {
              provider: t(`auth.social.${provider}`),
            })
          : message,
      );
    }
  }

  return (
    <div className="space-y-3">
      {sortedProviders.map(({ method, provider }) => {
        const isLastUsed = lastUsedMethod === method;

        return (
          <button
            key={provider}
            type="button"
            onClick={() => void handleClick(provider)}
            disabled={disabled}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <ProviderMark provider={provider} />
              <span>{t(`auth.social.${provider}`)}</span>
            </span>
            {isLastUsed ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {t("auth.social.lastUsed")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ProviderMark({ provider }: { provider: SocialProvider }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
        provider === "google"
          ? "bg-rose-50 text-rose-600"
          : "bg-blue-50 text-blue-600"
      }`}
    >
      {provider === "google" ? "G" : "f"}
    </span>
  );
}
