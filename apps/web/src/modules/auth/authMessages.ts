export function getLoginErrorMessageKey(message?: string | null): string {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("email not confirmed")) {
    return "auth.errors.emailNotConfirmed";
  }

  if (normalized.includes("invalid login credentials")) {
    return "auth.errors.invalidCredentials";
  }

  return "auth.errors.generic";
}

export function getEmailDeliveryErrorMessageKey(
  message?: string | null,
): string {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("email rate limit") ||
    normalized.includes("rate limit exceeded") ||
    normalized.includes("too many requests")
  ) {
    return "auth.errors.emailRateLimited";
  }

  if (
    normalized.includes("error sending confirmation") ||
    normalized.includes("confirmation mail") ||
    normalized.includes("smtp") ||
    normalized.includes("email provider") ||
    normalized.includes("email address not authorized")
  ) {
    return "auth.errors.emailDeliveryFailed";
  }

  return "auth.errors.generic";
}

export function signupRequiresEmailConfirmation(session: unknown): boolean {
  return session == null;
}
