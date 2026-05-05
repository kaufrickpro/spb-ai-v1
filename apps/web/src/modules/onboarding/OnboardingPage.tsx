import { Navigate } from "react-router-dom";
import { WEB_ROUTES } from "../routing/routes";

export function OnboardingPage() {
  return <Navigate to={WEB_ROUTES.profile} replace />;
}
