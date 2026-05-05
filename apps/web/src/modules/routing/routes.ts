export const WEB_ROUTES = {
  root: "/",
  features: "/features",
  publishers: "/publishers",
  authors: "/authors",
  editorial: "/editorial",
  works: "/works",
  pricing: "/pricing",
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
  requests: "/app/requests",
  billing: "/app/billing",
  profile: "/app/profile",
  settings: "/app/settings",
  admin: "/admin",
  adminMfa: "/admin/mfa",
  adminReviews: "/admin/reviews",
  adminUsers: "/admin/users",
  adminManuscripts: "/admin/manuscripts",
  adminPublishers: "/admin/publishers",
  adminTrustSafety: "/admin/trust-safety",
  adminJobs: "/admin/jobs",
  adminPayments: "/admin/payments",
  adminAuditLogs: "/admin/audit-logs",
  adminSettings: "/admin/settings",
} as const;

export function manuscriptDetailPath(id: string): string {
  return `/app/manuscripts/${id}`;
}

export function onboardingDetailsPath(role: "author" | "publisher"): string {
  return role === "author"
    ? WEB_ROUTES.onboardingAuthorDetails
    : WEB_ROUTES.onboardingPublisherDetails;
}
