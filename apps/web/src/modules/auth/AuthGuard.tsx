import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { WEB_ROUTES } from "../routing/routes";
import { useAdminSurface } from "../admin/useAdminSurface";
import { resolveAuthenticatedLandingRoute } from "./entryRouting";
import { useMarketplaceProfile } from "../profile/useMarketplaceProfile";

type AuthGuardProps = {
  children: ReactNode;
};

/**
 * Protects authenticated routes.
 * - While loading: renders nothing (avoids flash of redirect).
 * - Unauthenticated: redirects to /login.
 * - Authenticated: renders children.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to={WEB_ROUTES.login} replace />;

  return <>{children}</>;
}

export function AdminGuard({ children }: AuthGuardProps) {
  const adminSurface = useAdminSurface();

  if (adminSurface.isLoading) return null;
  if (adminSurface.requiresLogin)
    return <Navigate to={WEB_ROUTES.adminLogin} replace />;
  if (adminSurface.requiresMfa) {
    return <Navigate to={WEB_ROUTES.adminMfa} replace />;
  }
  if (adminSurface.isRevoked) {
    return <AdminAccessBlockedPage mode="revoked" />;
  }
  if (!adminSurface.canRenderAdminSurface) {
    return <Navigate to={WEB_ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
}

export function AuthorGuard({ children }: AuthGuardProps) {
  const { session, loading } = useAuth();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled:
      Boolean(session) &&
      !loading &&
      !adminSurface.isLoading &&
      !adminSurface.hasAdminAccess,
  });

  if (loading || adminSurface.isLoading || profileQuery.isPending) {
    return null;
  }

  if (!session) {
    return <Navigate to={WEB_ROUTES.login} replace />;
  }

  if (adminSurface.hasAdminAccess) {
    return <Navigate to={WEB_ROUTES.admin} replace />;
  }

  if (!profileQuery.data?.profile) {
    return <Navigate to={WEB_ROUTES.signup} replace />;
  }

  if (profileQuery.data.profile.role !== "author") {
    return (
      <AccessBlockedPage
        descriptionKey="manuscripts.forbidden.description"
        titleKey="manuscripts.forbidden.title"
      />
    );
  }

  return <>{children}</>;
}

function AdminAccessBlockedPage({
  mode,
}: {
  mode: "mfa_required" | "revoked";
}) {
  const title =
    mode === "mfa_required"
      ? "adminAccess.mfaRequired.title"
      : "adminAccess.revoked.title";
  const description =
    mode === "mfa_required"
      ? "adminAccess.mfaRequired.description"
      : "adminAccess.revoked.description";

  return <AccessBlockedPage descriptionKey={description} titleKey={title} />;
}

function AccessBlockedPage({
  descriptionKey,
  titleKey,
}: {
  descriptionKey: string;
  titleKey: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-950 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
          SPB-AI
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{t(titleKey)}</h1>
        <p className="mt-3 text-sm text-slate-600">{t(descriptionKey)}</p>
      </main>
    </div>
  );
}

/**
 * Prevents authenticated users from seeing login/signup pages.
 * - While loading: renders nothing.
 * - Authenticated: redirects to the best landing route.
 * - Unauthenticated: renders children.
 */
export function GuestGuard({ children }: AuthGuardProps) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const adminSurface = useAdminSurface();
  const profileQuery = useMarketplaceProfile({
    enabled:
      Boolean(session) &&
      !adminSurface.isLoading &&
      !adminSurface.hasAdminAccess,
  });

  if (loading) return null;
  if (session) {
    if (location.pathname === WEB_ROUTES.signup) {
      return <>{children}</>;
    }

    if (adminSurface.isLoading || profileQuery.isPending) return null;

    return (
      <Navigate
        to={resolveAuthenticatedLandingRoute({
          hasAdminAccess: adminSurface.hasAdminAccess,
          hasProfile: Boolean(profileQuery.data?.profile),
        })}
        replace
      />
    );
  }

  return <>{children}</>;
}
