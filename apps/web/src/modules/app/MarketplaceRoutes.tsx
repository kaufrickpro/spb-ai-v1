import { Route } from "react-router-dom";
import { AuthGuard, AuthorGuard } from "../auth/AuthGuard";
import { BillingPage } from "../billing/BillingPage";
import { DashboardPage } from "../dashboard/DashboardPage";
import { AppPlaceholderPage } from "../layout/AppPlaceholderPage";
import { ManuscriptDetailPage } from "../manuscripts/ManuscriptDetailPage";
import { ManuscriptListPage } from "../manuscripts/ManuscriptListPage";
import { MatchCandidatePage } from "../matches/MatchCandidatePage";
import { MatchesPage } from "../matches/MatchesPage";
import { MatchRunPage } from "../matches/MatchRunPage";
import { ProfileHistoryPage } from "../matches/ProfileHistoryPage";
import { NotificationsPage } from "../notifications/NotificationsPage";
import { ProfilePage } from "../profile/ProfilePage";
import {
  AuthorProfileSurfacePage,
  ManuscriptProfileSurfacePage,
  PublisherProfileSurfacePage,
} from "../profiles/ProfileSurfacePages";
import { RequestsPage } from "../requests/RequestsPage";
import { WEB_ROUTES } from "../routing/routes";

export function renderMarketplaceRoutes() {
  return (
    <>
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
        path={WEB_ROUTES.matches}
        element={
          <AuthGuard>
            <MatchesPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.matchRun}
        element={
          <AuthGuard>
            <MatchRunPage />
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
        path={WEB_ROUTES.notifications}
        element={
          <AuthGuard>
            <NotificationsPage />
          </AuthGuard>
        }
      />
      <Route
        path={WEB_ROUTES.billing}
        element={
          <AuthGuard>
            <BillingPage />
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
            <ProfileHistoryPage />
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
    </>
  );
}
