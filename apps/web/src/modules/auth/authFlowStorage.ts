import type {
  CreateProfileRequest,
  Profile,
  PublicProfileRole,
} from "@marketplace/contracts";

const SIGNUP_DRAFT_STORAGE_KEY = "marketplace.signup-draft";
const LAST_AUTH_METHOD_STORAGE_KEY = "marketplace.last-auth-method";
const PENDING_OAUTH_PROVIDER_STORAGE_KEY = "marketplace.pending-oauth-provider";

export type AuthMethod = "password" | "google" | "facebook";

type SignupDraft = Pick<
  CreateProfileRequest,
  "displayName" | "locale" | "profilePhotoUrl" | "role" | "signupIntent"
>;

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadSignupDraft(): SignupDraft | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SignupDraft;
  } catch {
    return null;
  }
}

export function saveSignupDraft(draft: SignupDraft) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearSignupDraft() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
}

export function getLastAuthMethod(): AuthMethod | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(LAST_AUTH_METHOD_STORAGE_KEY);
  if (value === "password" || value === "google" || value === "facebook") {
    return value;
  }

  return null;
}

export function setLastAuthMethod(method: AuthMethod) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(LAST_AUTH_METHOD_STORAGE_KEY, method);
}

export function setPendingOauthProvider(
  provider: Extract<AuthMethod, "google" | "facebook">,
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY, provider);
}

export function consumePendingOauthProvider(): Extract<
  AuthMethod,
  "google" | "facebook"
> | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY);
  window.localStorage.removeItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY);

  return value === "google" || value === "facebook" ? value : null;
}

export function getSuggestedProfileDraft(input: {
  fallbackLocale: CreateProfileRequest["locale"];
  profile: Profile | null;
  user: {
    user_metadata?: Record<string, unknown> | null;
  } | null;
}): SignupDraft {
  const savedDraft = loadSignupDraft();

  if (savedDraft) {
    return savedDraft;
  }

  const metadata = input.user?.user_metadata ?? {};
  const displayName =
    readString(metadata.full_name) ??
    readString(metadata.name) ??
    input.profile?.displayName ??
    "";
  const profilePhotoUrl =
    readString(metadata.avatar_url) ??
    readString(metadata.picture) ??
    input.profile?.profilePhotoUrl ??
    null;

  return {
    role: input.profile?.role ?? ("author" satisfies PublicProfileRole),
    displayName,
    locale: input.profile?.locale ?? input.fallbackLocale,
    profilePhotoUrl,
    signupIntent: input.profile?.signupIntent ?? "find_publisher",
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
