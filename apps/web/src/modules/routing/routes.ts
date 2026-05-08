export const WEB_ROUTES = {
  root: "/",
  features: "/features",
  publishers: "/publishers",
  authors: "/authors",
  editorial: "/editorial",
  works: "/works",
  pricing: "/pricing",
  terms: "/terms",
  privacy: "/privacy",
  kvkk: "/kvkk",
  cookies: "/cookies",
  login: "/login",
  adminLogin: "/admin/login",
  signup: "/signup",
  signupComplete: "/signup/complete",
  checkEmail: "/check-email",
  authCallback: "/auth/callback",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  onboarding: "/onboarding",
  onboardingAuthorDetails: "/onboarding/author",
  onboardingPublisherDetails: "/onboarding/publisher",
  dashboard: "/app/dashboard",
  manuscripts: "/app/manuscripts",
  manuscriptDetail: "/app/manuscripts/:id",
  matches: "/app/matches",
  matchRun: "/app/matches/:matchRunId",
  matchCandidate: "/app/matches/:matchRunId/candidates/:candidateId",
  discoverAuthors: "/app/discover/authors",
  discoverPublishers: "/app/discover/publishers",
  requests: "/app/requests",
  billing: "/app/billing",
  profile: "/app/profile",
  profileHistory: "/app/profile/history",
  publisherProfile: "/app/profiles/publishers/:publisherProfileId",
  authorProfile: "/app/profiles/authors/:authorProfileId",
  manuscriptProfile: "/app/profiles/manuscripts/:manuscriptId",
  settings: "/app/settings",
  admin: "/admin",
  adminMfa: "/admin/mfa",
  adminReviews: "/admin/reviews",
  adminUsers: "/admin/users",
  adminManuscripts: "/admin/manuscripts",
  adminPublishers: "/admin/publishers",
  adminTrustSafety: "/admin/trust-safety",
  adminIntroRequests: "/admin/intro-requests",
  adminJobs: "/admin/jobs",
  adminPayments: "/admin/payments",
  adminAuditLogs: "/admin/audit-logs",
  adminSettings: "/admin/settings",
} as const;

export const DOCUMENTED_PUBLIC_ROUTES = [
  WEB_ROUTES.root,
  WEB_ROUTES.features,
  WEB_ROUTES.pricing,
  WEB_ROUTES.publishers,
  WEB_ROUTES.authors,
  WEB_ROUTES.editorial,
  WEB_ROUTES.works,
  WEB_ROUTES.login,
  WEB_ROUTES.signup,
  WEB_ROUTES.authCallback,
  WEB_ROUTES.forgotPassword,
  WEB_ROUTES.terms,
  WEB_ROUTES.privacy,
  WEB_ROUTES.kvkk,
  WEB_ROUTES.cookies,
] as const;

export const DOCUMENTED_APP_ROUTES = [
  WEB_ROUTES.onboarding,
  WEB_ROUTES.dashboard,
  WEB_ROUTES.manuscripts,
  WEB_ROUTES.manuscriptDetail,
  WEB_ROUTES.matches,
  WEB_ROUTES.matchRun,
  WEB_ROUTES.matchCandidate,
  WEB_ROUTES.discoverAuthors,
  WEB_ROUTES.discoverPublishers,
  WEB_ROUTES.requests,
  WEB_ROUTES.profile,
  WEB_ROUTES.profileHistory,
  WEB_ROUTES.publisherProfile,
  WEB_ROUTES.authorProfile,
  WEB_ROUTES.manuscriptProfile,
  WEB_ROUTES.billing,
  WEB_ROUTES.settings,
] as const;

export const APP_REGISTERED_ROUTE_PATHS = [
  WEB_ROUTES.root,
  WEB_ROUTES.features,
  WEB_ROUTES.publishers,
  WEB_ROUTES.authors,
  WEB_ROUTES.editorial,
  WEB_ROUTES.works,
  WEB_ROUTES.pricing,
  WEB_ROUTES.terms,
  WEB_ROUTES.privacy,
  WEB_ROUTES.kvkk,
  WEB_ROUTES.cookies,
  WEB_ROUTES.login,
  WEB_ROUTES.adminLogin,
  WEB_ROUTES.signup,
  WEB_ROUTES.authCallback,
  WEB_ROUTES.forgotPassword,
  WEB_ROUTES.resetPassword,
  WEB_ROUTES.checkEmail,
  WEB_ROUTES.onboarding,
  WEB_ROUTES.onboardingAuthorDetails,
  WEB_ROUTES.onboardingPublisherDetails,
  WEB_ROUTES.signupComplete,
  WEB_ROUTES.dashboard,
  WEB_ROUTES.manuscripts,
  WEB_ROUTES.manuscriptDetail,
  WEB_ROUTES.admin,
  WEB_ROUTES.adminMfa,
  WEB_ROUTES.matches,
  WEB_ROUTES.matchRun,
  WEB_ROUTES.matchCandidate,
  WEB_ROUTES.discoverAuthors,
  WEB_ROUTES.discoverPublishers,
  WEB_ROUTES.requests,
  WEB_ROUTES.billing,
  WEB_ROUTES.profile,
  WEB_ROUTES.profileHistory,
  WEB_ROUTES.publisherProfile,
  WEB_ROUTES.authorProfile,
  WEB_ROUTES.manuscriptProfile,
  WEB_ROUTES.settings,
  WEB_ROUTES.adminReviews,
  WEB_ROUTES.adminUsers,
  WEB_ROUTES.adminManuscripts,
  WEB_ROUTES.adminPublishers,
  WEB_ROUTES.adminTrustSafety,
  WEB_ROUTES.adminIntroRequests,
  WEB_ROUTES.adminJobs,
  WEB_ROUTES.adminPayments,
  WEB_ROUTES.adminAuditLogs,
  WEB_ROUTES.adminSettings,
] as const;

export function manuscriptDetailPath(id: string): string {
  return `/app/manuscripts/${id}`;
}

export function matchRunPath(matchRunId: string): string {
  return `/app/matches/${matchRunId}`;
}

export function matchCandidatePath(input: {
  matchRunId: string;
  candidateId: string;
}): string {
  return `/app/matches/${input.matchRunId}/candidates/${input.candidateId}`;
}

export function publisherProfilePath(publisherProfileId: string): string {
  return `/app/profiles/publishers/${publisherProfileId}`;
}

export function authorProfilePath(authorProfileId: string): string {
  return `/app/profiles/authors/${authorProfileId}`;
}

export function manuscriptProfilePath(manuscriptId: string): string {
  return `/app/profiles/manuscripts/${manuscriptId}`;
}

export function onboardingDetailsPath(role: "author" | "publisher"): string {
  return role === "author"
    ? WEB_ROUTES.onboardingAuthorDetails
    : WEB_ROUTES.onboardingPublisherDetails;
}
