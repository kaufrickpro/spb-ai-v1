import { Route } from "react-router-dom";
import { LegalPage } from "../legal/LegalPage";
import { HomePage } from "../marketing/HomePage";
import { PricingPage } from "../marketing/PricingPage";
import { PublicPublishersPage } from "../marketing/PublicPublishersPage";
import { WEB_ROUTES } from "../routing/routes";

export function renderPublicRoutes() {
  return (
    <>
      <Route path={WEB_ROUTES.root} element={<HomePage />} />
      <Route path={WEB_ROUTES.features} element={<HomePage />} />
      <Route path={WEB_ROUTES.publishers} element={<PublicPublishersPage />} />
      <Route path={WEB_ROUTES.authors} element={<HomePage />} />
      <Route path={WEB_ROUTES.editorial} element={<HomePage />} />
      <Route path={WEB_ROUTES.works} element={<HomePage />} />
      <Route path={WEB_ROUTES.pricing} element={<PricingPage />} />
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
    </>
  );
}
