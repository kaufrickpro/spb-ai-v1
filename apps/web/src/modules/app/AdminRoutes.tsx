import { Navigate, Route } from "react-router-dom";
import { AdminAuditLogsPage } from "../admin/AdminAuditLogsPage";
import { AdminDashboardPage } from "../admin/AdminDashboardPage";
import { AdminIntroRequestsPage } from "../admin/AdminIntroRequestsPage";
import { AdminJobsPage } from "../admin/AdminJobsPage";
import { AdminPaymentsPage } from "../admin/AdminPaymentsPage";
import { AdminProfileReviewsPage } from "../admin/AdminProfileReviewsPage";
import { AdminSettingsPage } from "../admin/AdminSettingsPage";
import { AdminTrustSafetyPage } from "../admin/AdminTrustSafetyPage";
import { AdminGuard } from "../auth/AuthGuard";
import { WEB_ROUTES } from "../routing/routes";

export function renderAdminRoutes() {
  return (
    <>
      <Route
        path={WEB_ROUTES.admin}
        element={
          <AdminGuard>
            <AdminDashboardPage />
          </AdminGuard>
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
        path={WEB_ROUTES.adminIntroRequests}
        element={
          <AdminGuard>
            <AdminIntroRequestsPage />
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
    </>
  );
}
