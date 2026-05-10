import {
  AUTHOR_SIGNUP_INTENTS,
  CreateProfileRequestSchema,
  PUBLISHER_SIGNUP_INTENTS,
  type CreateProfileRequest,
  type PublicProfileRole,
} from "@marketplace/contracts";
import type { SignupFormState } from "./types";

export function resolveSignupLocale(language: string | undefined) {
  return language?.startsWith("en") ? "en" : "tr";
}

export function buildInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function buildSignupIntentOptions(role: PublicProfileRole) {
  return role === "author" ? AUTHOR_SIGNUP_INTENTS : PUBLISHER_SIGNUP_INTENTS;
}

export function parseSignupProfilePayload(
  form: SignupFormState,
  locale: CreateProfileRequest["locale"],
) {
  return CreateProfileRequestSchema.safeParse({
    role: form.role,
    displayName: form.displayName,
    locale,
    profilePhotoUrl: form.profilePhotoUrl,
    signupIntent: form.signupIntent,
  });
}
