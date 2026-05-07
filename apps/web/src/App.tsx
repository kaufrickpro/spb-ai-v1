import { Navigate, Route, Routes } from "react-router-dom";
import { OnboardingPage } from "./modules/onboarding/OnboardingPage";
import { LoginPage } from "./modules/auth/LoginPage";
import { AdminLoginPage } from "./modules/auth/AdminLoginPage";
import { SignupPage } from "./modules/auth/SignupPage";
import { CheckEmailPage } from "./modules/auth/CheckEmailPage";
import { AuthCallbackPage } from "./modules/auth/AuthCallbackPage";
import { AdminMfaPage } from "./modules/auth/AdminMfaPage";
import { ForgotPasswordPage } from "./modules/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./modules/auth/ResetPasswordPage";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import {
  AdminGuard,
  AuthGuard,
  AuthorGuard,
  GuestGuard,
} from "./modules/auth/AuthGuard";
import { WEB_ROUTES } from "./modules/routing/routes";
import { HomePage } from "./modules/marketing/HomePage";
import { PublicPublishersPage } from "./modules/marketing/PublicPublishersPage";
import { AdminDashboardPage } from "./modules/admin/AdminDashboardPage";
import { AdminProfileReviewsPage } from "./modules/admin/AdminProfileReviewsPage";
import { AdminAuditLogsPage } from "./modules/admin/AdminAuditLogsPage";
import { AdminTrustSafetyPage } from "./modules/admin/AdminTrustSafetyPage";
import { AdminJobsPage } from "./modules/admin/AdminJobsPage";
import { AdminPaymentsPage } from "./modules/admin/AdminPaymentsPage";
import { ManuscriptListPage } from "./modules/manuscripts/ManuscriptListPage";
import { ManuscriptDetailPage } from "./modules/manuscripts/ManuscriptDetailPage";
import { AppPlaceholderPage } from "./modules/layout/AppPlaceholderPage";
import { AdminSettingsPage } from "./modules/admin/AdminSettingsPage";
import { ProfilePage } from "./modules/profile/ProfilePage";
import { LegalPage } from "./modules/legal/LegalPage";
import {
  AuthorProfileSurfacePage,
  ManuscriptProfileSurfacePage,
  PublisherProfileSurfacePage,
} from "./modules/profiles/ProfileSurfacePages";
import { RequestsPage } from "./modules/requests/RequestsPage";
import { MatchesPage } from "./modules/matches/MatchesPage";
import { MatchCandidatePage } from "./modules/matches/MatchCandidatePage";

export function App() {
  return (
    <Routes>
      <Route path={WEB_ROUTES.root} element={<HomePage />} />
      <Route path={WEB_ROUTES.features} element={<HomePage />} />
      <Route path={WEB_ROUTES.publishers} element={<PublicPublishersPage />} />
      <Route path={WEB_ROUTES.authors} element={<HomePage />} />
      <Route path={WEB_ROUTES.editorial} element={<HomePage />} />
      <Route path={WEB_ROUTES.works} element={<HomePage />} />
      <Route path={WEB_ROUTES.pricing} element={<HomePage />} />
      <Route
        path={WEB_ROUTES.terms}
        element={
          <LegalPage
            titleKey="legal.terms.title"
            descriptionKey="legal.terms.description"
          />
        }
      />
      <Route
        path={WEB_ROUTES.privacy}
        element={
          <LegalPage
            titleKey="legal.privacy.title"
            descriptionKey="legal.privacy.description"
          />
        }
      />
      <Route
        path={WEB_ROUTES.kvkk}
        element={
          <LegalPage
            titleKey="legal.kvkk.title"
            descriptionKey="legal.kvkk.description"
          />
        }
      />
      <Route
        path={WEB_ROUTES.cookies}
        element={
          <LegalPage
            titleKey="legal.cookies.title"
            descriptionKey="legal.cookies.description"
          />
        }
      />

      {/* Guest-only: redirect away if already authenticated */}
      <Route
        path={WEB_ROUTES.login}
        element={
          <GuestGuard>
            <LoginPage />
          </GuestGuard>
        }
      />
      <Route path={WEB_ROUTES.adminLogin} element={<AdminLoginPage />} />
      <Route
        path={WEB_ROUTES.signup}
        element={
          <GuestGuard>
            <SignupPage />
          </GuestGuard>
        }
      />
      <Route path={WEB_ROUTES.authCallback} element={<AuthCallbackPage />} />
      <Route
        path={WEB_ROUTES.forgotPassword}
        element={<ForgotPasswordPage />}
      />
      <Route path={WEB_ROUTES.resetPassword} element={<ResetPasswordPage />} />
      <Route
        path={WEB_ROUTES.checkEmail}
        element={
          <GuestGuard>
            <CheckEmailPage />
          </GuestGuard>
        }
      />

      {/* Auth-required */}
      <Route
        path={WEB_ROUTES.onboarding}
        element={
          <AuthGuard>
            <OnboardingPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.onboardingAuthorDetails}
        element={
          <AuthGuard>
            <OnboardingPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.onboardingPublisherDetails}
        element={
          <AuthGuard>
            <OnboardingPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.signupComplete}
        element={<Navigate to={WEB_ROUTES.signup} replace />}
      />
      <Route
        path={WEB_ROUTES.dashboard}
        element={
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.manuscripts}
        element={
          <AuthorGuard>
            <ManuscriptListPage />
          </AuthorGuard>
        }
      />
      <Route
        path={WEB_ROUTES.manuscriptDetail}
        element={
          <AuthorGuard>
            <ManuscriptDetailPage />
          </AuthorGuard>
        }
      />
      <Route
        path={WEB_ROUTES.admin}
        element={
          <AdminGuard>
            <AdminDashboardPage />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminMfa}
        element={
          <AuthGuard>
            <AdminMfaPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.matches}
        element={
          <AuthGuard>
            <MatchesPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.matchCandidate}
        element={
          <AuthGuard>
            <MatchCandidatePage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.discoverAuthors}
        element={
          <AuthGuard>
            <AppPlaceholderPage
              titleKey="appPages.discoverAuthors.title"
              descriptionKey="appPages.discoverAuthors.description"
            />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.discoverPublishers}
        element={
          <AuthGuard>
            <AppPlaceholderPage
              titleKey="appPages.discoverPublishers.title"
              descriptionKey="appPages.discoverPublishers.description"
            />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.requests}
        element={
          <AuthGuard>
            <RequestsPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.billing}
        element={
          <AuthGuard>
            <AppPlaceholderPage
              titleKey="appNav.billing"
              descriptionKey="appPages.billing.description"
            />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.profile}
        element={
          <AuthGuard>
            <ProfilePage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.profileHistory}
        element={
          <AuthGuard>
            <MatchesPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.publisherProfile}
        element={
          <AuthGuard>
            <PublisherProfileSurfacePage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.authorProfile}
        element={
          <AuthGuard>
            <AuthorProfileSurfacePage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.manuscriptProfile}
        element={
          <AuthGuard>
            <ManuscriptProfileSurfacePage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.settings}
        element={
          <AuthGuard>
            <AppPlaceholderPage
              titleKey="appNav.settings"
              descriptionKey="appPages.settings.description"
            />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminReviews}
        element={
          <AdminGuard>
            <AdminProfileReviewsPage />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminUsers}
        element={
          <AdminGuard>
            <Navigate to={WEB_ROUTES.admin} replace />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminManuscripts}
        element={
          <AdminGuard>
            <Navigate to={WEB_ROUTES.adminReviews} replace />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminPublishers}
        element={
          <AdminGuard>
            <Navigate to={WEB_ROUTES.adminTrustSafety} replace />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminTrustSafety}
        element={
          <AdminGuard>
            <AdminTrustSafetyPage />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminJobs}
        element={
          <AdminGuard>
            <AdminJobsPage />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminPayments}
        element={
          <AdminGuard>
            <AdminPaymentsPage />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminAuditLogs}
        element={
          <AdminGuard>
            <AdminAuditLogsPage />
          </AdminGuard>
        }
      />
      <Route
        path={WEB_ROUTES.adminSettings}
        element={
          <AdminGuard>
            <AdminSettingsPage />
          </AdminGuard>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={WEB_ROUTES.root} replace />} />
    </Routes>
  );
}
