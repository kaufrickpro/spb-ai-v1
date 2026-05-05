export type AdminSurfaceState =
  | "loading"
  | "requires_login"
  | "allowed"
  | "mfa_required"
  | "revoked"
  | "denied";

export function resolveAdminSurfaceState(input: {
  accessError: boolean;
  accessLoading: boolean;
  authLoading: boolean;
  hasAccess: boolean;
  hasSession: boolean;
  status?: "no_access" | "mfa_required" | "allowed" | "revoked";
}): AdminSurfaceState {
  if (input.authLoading) return "loading";
  if (!input.hasSession) return "requires_login";
  if (input.accessLoading) return "loading";
  if (input.status === "mfa_required") return "mfa_required";
  if (input.status === "revoked") return "revoked";
  if (input.accessError || !input.hasAccess) return "denied";
  return "allowed";
}
