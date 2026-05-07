import { z } from "zod";
import {
  AdminAccessResponseSchema,
  AdminAuditLogsResponseSchema,
  AdminDashboardResponseSchema,
  AdminJobHealthResponseSchema,
  AdminPendingProfilesResponseSchema,
  AdminPaymentHealthResponseSchema,
  AdminProfileDecisionRequestSchema,
  AdminProfileDecisionResponseSchema,
  AdminReviewQueueQuerySchema,
  AdminReviewDecisionRequestSchema,
  AdminReviewDecisionResponseSchema,
  AdminReviewDetailResponseSchema,
  AdminReviewQueueResponseSchema,
  AdminTrustSafetyResponseSchema,
} from "./admin.js";
import { HealthResponseSchema } from "./common.js";
import {
  CompleteOnboardingDetailsRequestSchema,
  CreateProfileRequestSchema,
  AuthorProfilePageResponseSchema,
  MatchVisibleContactSettingsResponseSchema,
  PublicDirectoryDecisionRequestSchema,
  PublicDirectoryDecisionResponseSchema,
  PublicPublisherDirectoryResponseSchema,
  OnboardingDetailsResponseSchema,
  ProfileResponseSchema,
  PublisherProfilePageResponseSchema,
  UpdateMatchVisibleContactSettingsRequestSchema,
} from "./profiles.js";
import {
  CreateManuscriptRequestSchema,
  ManuscriptAccessRequestListResponseSchema,
  ManuscriptAccessRequestResponseSchema,
  ManuscriptListResponseSchema,
  ManuscriptProfileResponseSchema,
  ManuscriptResponseSchema,
  UpdateManuscriptRequestSchema,
} from "./manuscripts.js";
import {
  MatchCandidateResponseSchema,
  MatchRunListResponseSchema,
  MatchRunRequestSchema,
  MatchRunResponseSchema,
} from "./matching.js";
import {
  CompleteUploadResponseSchema,
  DocumentDownloadUrlResponseSchema,
  DocumentResponseSchema,
  UploadSignedUrlRequestSchema,
  UploadSignedUrlResponseSchema,
} from "./documents.js";

export const route = <
  Method extends "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  Path extends string,
  Request extends z.ZodTypeAny | undefined,
  Response extends z.ZodTypeAny,
  Params extends z.ZodTypeAny | undefined = undefined,
  Query extends z.ZodTypeAny | undefined = undefined,
>(contract: {
  method: Method;
  path: Path;
  request?: Request;
  response: Response;
  params?: Params;
  query?: Query;
  auth: "user" | "admin" | "webhook" | "public";
}) => contract;

export const ApiRoutes = {
  health: {
    get: route({
      method: "GET",
      path: "/health",
      response: HealthResponseSchema,
      auth: "public",
    }),
  },
  profiles: {
    me: route({
      method: "GET",
      path: "/api/v1/profiles/me",
      response: ProfileResponseSchema,
      auth: "user",
    }),
    create: route({
      method: "POST",
      path: "/api/v1/profiles",
      request: CreateProfileRequestSchema,
      response: ProfileResponseSchema,
      auth: "user",
    }),
    completeDetails: route({
      method: "POST",
      path: "/api/v1/profiles/me/onboarding-details",
      request: CompleteOnboardingDetailsRequestSchema,
      response: OnboardingDetailsResponseSchema,
      auth: "user",
    }),
    updateMatchVisibleContacts: route({
      method: "PUT",
      path: "/api/v1/profiles/me/match-visible-contacts",
      request: UpdateMatchVisibleContactSettingsRequestSchema,
      response: MatchVisibleContactSettingsResponseSchema,
      auth: "user",
    }),
    publicPublishers: route({
      method: "GET",
      path: "/api/v1/public/publishers",
      response: PublicPublisherDirectoryResponseSchema,
      auth: "public",
    }),
    publisherProfile: route({
      method: "GET",
      path: "/api/v1/profiles/publishers/:publisherProfileId",
      params: z.object({ publisherProfileId: z.string().uuid() }),
      response: PublisherProfilePageResponseSchema,
      auth: "user",
    }),
    authorProfile: route({
      method: "GET",
      path: "/api/v1/profiles/authors/:authorProfileId",
      params: z.object({ authorProfileId: z.string().uuid() }),
      response: AuthorProfilePageResponseSchema,
      auth: "user",
    }),
  },
  admin: {
    access: route({
      method: "GET",
      path: "/api/v1/admin/access",
      response: AdminAccessResponseSchema,
      auth: "user",
    }),
    dashboard: route({
      method: "GET",
      path: "/api/v1/admin/dashboard",
      response: AdminDashboardResponseSchema,
      auth: "admin",
    }),
    pendingProfiles: route({
      method: "GET",
      path: "/api/v1/admin/pending-profiles",
      response: AdminPendingProfilesResponseSchema,
      auth: "admin",
    }),
    profileDecision: route({
      method: "POST",
      path: "/api/v1/admin/profiles/:profileId/decision",
      params: z.object({ profileId: z.string().uuid() }),
      request: AdminProfileDecisionRequestSchema,
      response: AdminProfileDecisionResponseSchema,
      auth: "admin",
    }),
    reviewQueue: route({
      method: "GET",
      path: "/api/v1/admin/reviews",
      query: AdminReviewQueueQuerySchema,
      response: AdminReviewQueueResponseSchema,
      auth: "admin",
    }),
    reviewDetail: route({
      method: "GET",
      path: "/api/v1/admin/reviews/:reviewId",
      params: z.object({ reviewId: z.string().uuid() }),
      response: AdminReviewDetailResponseSchema,
      auth: "admin",
    }),
    reviewDecision: route({
      method: "POST",
      path: "/api/v1/admin/reviews/:reviewId/decision",
      params: z.object({ reviewId: z.string().uuid() }),
      request: AdminReviewDecisionRequestSchema,
      response: AdminReviewDecisionResponseSchema,
      auth: "admin",
    }),
    auditLogs: route({
      method: "GET",
      path: "/api/v1/admin/audit-logs",
      response: AdminAuditLogsResponseSchema,
      auth: "admin",
    }),
    jobsHealth: route({
      method: "GET",
      path: "/api/v1/admin/jobs/health",
      response: AdminJobHealthResponseSchema,
      auth: "admin",
    }),
    paymentsHealth: route({
      method: "GET",
      path: "/api/v1/admin/payments/health",
      response: AdminPaymentHealthResponseSchema,
      auth: "admin",
    }),
    trustSafety: route({
      method: "GET",
      path: "/api/v1/admin/trust-safety",
      response: AdminTrustSafetyResponseSchema,
      auth: "admin",
    }),
    publicDirectoryDecision: route({
      method: "POST",
      path: "/api/v1/admin/publishers/:publisherProfileId/public-directory",
      params: z.object({ publisherProfileId: z.string().uuid() }),
      request: PublicDirectoryDecisionRequestSchema,
      response: PublicDirectoryDecisionResponseSchema,
      auth: "admin",
    }),
  },
  manuscripts: {
    list: route({
      method: "GET",
      path: "/api/v1/manuscripts",
      response: ManuscriptListResponseSchema,
      auth: "user",
    }),
    create: route({
      method: "POST",
      path: "/api/v1/manuscripts",
      request: CreateManuscriptRequestSchema,
      response: ManuscriptResponseSchema,
      auth: "user",
    }),
    get: route({
      method: "GET",
      path: "/api/v1/manuscripts/:id",
      params: z.object({ id: z.string().uuid() }),
      response: ManuscriptResponseSchema,
      auth: "user",
    }),
    update: route({
      method: "PATCH",
      path: "/api/v1/manuscripts/:id",
      params: z.object({ id: z.string().uuid() }),
      request: UpdateManuscriptRequestSchema,
      response: ManuscriptResponseSchema,
      auth: "user",
    }),
    profile: route({
      method: "GET",
      path: "/api/v1/profiles/manuscripts/:manuscriptId",
      params: z.object({ manuscriptId: z.string().uuid() }),
      response: ManuscriptProfileResponseSchema,
      auth: "user",
    }),
    requestAccess: route({
      method: "POST",
      path: "/api/v1/manuscripts/:manuscriptId/access-requests",
      params: z.object({ manuscriptId: z.string().uuid() }),
      response: ManuscriptAccessRequestResponseSchema,
      auth: "user",
    }),
    listAccessRequests: route({
      method: "GET",
      path: "/api/v1/manuscript-access-requests",
      response: ManuscriptAccessRequestListResponseSchema,
      auth: "user",
    }),
    approveAccessRequest: route({
      method: "POST",
      path: "/api/v1/manuscript-access-requests/:requestId/approve",
      params: z.object({ requestId: z.string().uuid() }),
      response: ManuscriptAccessRequestResponseSchema,
      auth: "user",
    }),
    rejectAccessRequest: route({
      method: "POST",
      path: "/api/v1/manuscript-access-requests/:requestId/reject",
      params: z.object({ requestId: z.string().uuid() }),
      response: ManuscriptAccessRequestResponseSchema,
      auth: "user",
    }),
  },
  matches: {
    run: route({
      method: "POST",
      path: "/api/v1/matches/run",
      request: MatchRunRequestSchema,
      response: MatchRunResponseSchema,
      auth: "user",
    }),
    list: route({
      method: "GET",
      path: "/api/v1/matches",
      response: MatchRunListResponseSchema,
      auth: "user",
    }),
    profileHistory: route({
      method: "GET",
      path: "/api/v1/profile/history",
      response: MatchRunListResponseSchema,
      auth: "user",
    }),
    get: route({
      method: "GET",
      path: "/api/v1/matches/:matchRunId",
      params: z.object({ matchRunId: z.string().uuid() }),
      response: MatchRunResponseSchema,
      auth: "user",
    }),
    candidate: route({
      method: "GET",
      path: "/api/v1/matches/:matchRunId/candidates/:candidateId",
      params: z.object({
        matchRunId: z.string().uuid(),
        candidateId: z.string().uuid(),
      }),
      response: MatchCandidateResponseSchema,
      auth: "user",
    }),
  },
  uploads: {
    requestSignedUrl: route({
      method: "POST",
      path: "/api/v1/uploads/signed-url",
      request: UploadSignedUrlRequestSchema,
      response: UploadSignedUrlResponseSchema,
      auth: "user",
    }),
    localUpload: route({
      method: "PUT",
      path: "/api/v1/uploads/local/:uploadToken",
      params: z.object({ uploadToken: z.string().min(1) }),
      response: z.object({ ok: z.literal(true) }),
      auth: "public",
    }),
  },
  documents: {
    completeUpload: route({
      method: "POST",
      path: "/api/v1/documents/:id/complete-upload",
      params: z.object({ id: z.string().uuid() }),
      response: CompleteUploadResponseSchema,
      auth: "user",
    }),
    downloadUrl: route({
      method: "GET",
      path: "/api/v1/documents/:id/download-url",
      params: z.object({ id: z.string().uuid() }),
      response: DocumentDownloadUrlResponseSchema,
      auth: "user",
    }),
    get: route({
      method: "GET",
      path: "/api/v1/documents/:id",
      params: z.object({ id: z.string().uuid() }),
      response: DocumentResponseSchema,
      auth: "user",
    }),
  },
} as const;

export type ApiRoutes = typeof ApiRoutes;
export type ApiRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  request?: z.ZodTypeAny;
  response: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  auth: "user" | "admin" | "webhook" | "public";
};
export type ApiRouteRequest<Route extends ApiRoute> = Route extends {
  request?: infer Request;
}
  ? Request extends z.ZodTypeAny
    ? z.input<Request>
    : undefined
  : undefined;
export type ApiRouteResponse<Route extends ApiRoute> = Route extends {
  response: infer Response extends z.ZodTypeAny;
}
  ? z.infer<Response>
  : never;
export type ApiRouteParams<Route extends ApiRoute> = Route extends {
  params?: infer Params;
}
  ? Params extends z.ZodTypeAny
    ? z.input<Params>
    : undefined
  : undefined;
export type ApiRouteQuery<Route extends ApiRoute> = Route extends {
  query?: infer Query;
}
  ? Query extends z.ZodTypeAny
    ? z.input<Query>
    : undefined
  : undefined;
