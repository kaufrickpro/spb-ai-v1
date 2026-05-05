import { useAuth } from "../auth/AuthContext";
import { resolveAdminSurfaceState } from "./adminSurface";
import { useAdminAccess } from "./useAdminAccess";

export function useAdminSurface() {
  const { session, loading } = useAuth();
  const adminAccessQuery = useAdminAccess();
  const state = resolveAdminSurfaceState({
    accessError: adminAccessQuery.isError,
    accessLoading: adminAccessQuery.isPending,
    authLoading: loading,
    hasAccess: adminAccessQuery.data?.access === true,
    hasSession: Boolean(session),
    status: adminAccessQuery.data?.status,
  });

  return {
    adminAccessQuery,
    canRenderAdminSurface: state === "allowed",
    hasAdminAccess: state === "allowed",
    hasAdminMembership:
      adminAccessQuery.data?.status === "allowed" ||
      adminAccessQuery.data?.status === "mfa_required" ||
      adminAccessQuery.data?.status === "revoked",
    isLoading: state === "loading",
    requiresLogin: state === "requires_login",
    requiresMfa: state === "mfa_required",
    isRevoked: state === "revoked",
    state,
  };
}
