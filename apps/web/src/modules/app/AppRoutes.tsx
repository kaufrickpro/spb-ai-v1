import { Navigate, Route, Routes } from "react-router-dom";
import { WEB_ROUTES } from "../routing/routes";
import { renderAdminRoutes } from "./AdminRoutes";
import { renderAuthRoutes } from "./AuthRoutes";
import { renderMarketplaceRoutes } from "./MarketplaceRoutes";
import { renderPublicRoutes } from "./PublicRoutes";

export function AppRoutes() {
  return (
    <Routes>
      {renderPublicRoutes()}
      {renderAuthRoutes()}
      {renderMarketplaceRoutes()}
      {renderAdminRoutes()}
      <Route path="*" element={<Navigate to={WEB_ROUTES.root} replace />} />
    </Routes>
  );
}
