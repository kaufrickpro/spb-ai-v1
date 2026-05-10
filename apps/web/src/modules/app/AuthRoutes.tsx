import { Navigate, Route } from "react-router-dom";
import { AuthGuard, GuestGuard } from "../auth/AuthGuard";
import { AuthCallbackPage } from "../auth/AuthCallbackPage";
import { CheckEmailPage } from "../auth/CheckEmailPage";
import { AdminLoginPage } from "../auth/AdminLoginPage";
import { AdminMfaPage } from "../auth/AdminMfaPage";
import { ForgotPasswordPage } from "../auth/ForgotPasswordPage";
import { LoginPage } from "../auth/LoginPage";
import { ResetPasswordPage } from "../auth/ResetPasswordPage";
import { SignupPage } from "../auth/SignupPage";
import { OnboardingPage } from "../onboarding/OnboardingPage";
import { WEB_ROUTES } from "../routing/routes";

export function renderAuthRoutes() {
  return (
    <>
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
        path={WEB_ROUTES.adminMfa}
        element={
          <AuthGuard>
            <AdminMfaPage />
          </AuthGuard>
        }
      />
    </>
  );
}
