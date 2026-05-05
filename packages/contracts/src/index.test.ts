import { describe, expect, it } from "vitest";
import {
  AdminDashboardResponseSchema,
  AdminAccessResponseSchema,
  AdminJobHealthResponseSchema,
  AdminPendingProfilesResponseSchema,
  AdminPaymentHealthResponseSchema,
  AdminProfileDecisionRequestSchema,
  AdminReviewDecisionRequestSchema,
  AdminReviewDetailResponseSchema,
  AdminReviewQueueQuerySchema,
  AdminReviewQueueResponseSchema,
  AdminTrustSafetyResponseSchema,
  ApiErrorSchema,
  ApiRoutes,
  buildApiPath,
  buildOpenApiDocument,
  CompleteOnboardingDetailsRequestSchema,
  CreateProfileRequestSchema,
  createApiClient,
  OnboardingDetailsResponseSchema,
  OnboardingStepSchema,
  ProfileDetailsSchema,
  HealthResponseSchema,
  ProfileResponseSchema,
  DocumentProcessingFailureCodeSchema,
  DocumentSchema,
} from "./index";

const now = "2026-04-30T10:00:00.000Z";
const id = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

describe("first-slice API contracts", () => {
  it("keeps API errors in the envelope used by every service", () => {
    const parsed = ApiErrorSchema.parse({
      error: {
        code: "not_found",
        message: "Not Found",
        details: { resource: "profile" },
      },
    });

    expect(parsed.error.code).toBe("not_found");
  });

  it("accepts health payloads", () => {
    const parsed = HealthResponseSchema.parse({
      status: "ok",
      service: "api",
    });

    expect(parsed.service).toBe("api");
  });

  it("accepts the first onboarding profile request", () => {
    const parsed = CreateProfileRequestSchema.parse({
      role: "author",
      displayName: "Ayşe Yılmaz",
      profilePhotoUrl: "https://example.com/ayse.png",
      signupIntent: "find_publisher",
      locale: "tr",
    });

    expect(parsed.role).toBe("author");
  });

  it("accepts role-specific onboarding detail completion requests", () => {
    const author = CompleteOnboardingDetailsRequestSchema.parse({
      role: "author",
      biography: "Çağdaş kurgu ve genç yetişkin projeleri yazıyorum.",
      primaryGenre: "Roman",
      writingLanguages: ["tr", "en"],
    });

    const publisher = CompleteOnboardingDetailsRequestSchema.parse({
      role: "publisher",
      focusGenres: ["Roman", "Kurgu dışı"],
      preferredLanguages: ["tr"],
      acceptsUnsolicited: true,
    });

    expect(author.role).toBe("author");
    expect(publisher.role).toBe("publisher");
  });

  it("rejects client-created admin profiles", () => {
    expect(() =>
      CreateProfileRequestSchema.parse({
        role: "admin",
        displayName: "Root User",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
      }),
    ).toThrow();
  });

  it("accepts the profile response contract backed by the first migration", () => {
    const parsed = ProfileResponseSchema.parse({
      profile: {
        id,
        userId,
        role: "publisher",
        displayName: "İstanbul Kitapları",
        profilePhotoUrl: null,
        signupIntent: "discover_manuscripts",
        approvalStatus: "pending",
        eligibilityStatus: "limited",
        reviewOutcome: "needs_review",
        locale: "tr",
        createdAt: now,
        updatedAt: now,
      },
      details: null,
    });

    expect(parsed.profile.eligibilityStatus).toBe("limited");
  });

  it("rejects admin roles in marketplace profile responses", () => {
    expect(() =>
      ProfileResponseSchema.parse({
        profile: {
          id,
          userId,
          role: "admin",
          displayName: "Root User",
          profilePhotoUrl: null,
          signupIntent: "discover_manuscripts",
          approvalStatus: "pending",
          locale: "tr",
          createdAt: now,
          updatedAt: now,
        },
        details: null,
      }),
    ).toThrow();
  });

  it("accepts role-specific onboarding details in the profile response", () => {
    const parsed = ProfileResponseSchema.parse({
      profile: {
        id,
        userId,
        role: "author",
        displayName: "Ayşe Yılmaz",
        profilePhotoUrl: "https://example.com/ayse.png",
        signupIntent: "find_publisher",
        approvalStatus: "approved",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
        locale: "tr",
        createdAt: now,
        updatedAt: now,
      },
      details: {
        role: "author",
        biography: "Tarih ve aile hikâyeleri üzerine çalışıyorum.",
        primaryGenre: "Tarihî kurgu",
        writingLanguages: ["tr"],
      },
    });

    expect(parsed.details?.role).toBe("author");
  });

  it("rejects mismatched detail payloads for the selected role", () => {
    expect(() =>
      ProfileDetailsSchema.parse({
        role: "publisher",
        biography: "This should not be accepted",
        primaryGenre: "Roman",
        writingLanguages: ["en"],
      }),
    ).toThrow();
  });

  it("accepts onboarding detail responses and steps", () => {
    const step = OnboardingStepSchema.parse("publisher_details");

    const response = OnboardingDetailsResponseSchema.parse({
      profile: {
        id,
        userId,
        role: "publisher",
        displayName: "İstanbul Kitapları",
        profilePhotoUrl: null,
        signupIntent: "discover_manuscripts",
        approvalStatus: "approved",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
        locale: "tr",
        createdAt: now,
        updatedAt: now,
      },
      details: {
        role: "publisher",
        focusGenres: ["Roman"],
        preferredLanguages: ["tr", "en"],
        acceptsUnsolicited: false,
      },
    });

    expect(step).toBe("publisher_details");
    expect(response.details.role).toBe("publisher");
  });

  it("accepts document sample processing failures as stable safe codes", () => {
    const code = DocumentProcessingFailureCodeSchema.parse(
      "empty_extracted_text",
    );
    const document = DocumentSchema.parse({
      id,
      manuscriptId: "00000000-0000-4000-8000-000000000003",
      authorId: userId,
      originalFileName: "chapter.txt",
      mimeType: "text/plain",
      fileSizeBytes: 1024,
      storageStatus: "uploaded",
      processingStatus: "failed",
      processingFailureCode: code,
      adminReviewStatus: "not_submitted",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      uploadId: "upload-1",
      retentionExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(document.processingFailureCode).toBe("empty_extracted_text");
  });

  it("accepts admin dashboard and review contracts", () => {
    const access = AdminAccessResponseSchema.parse({
      access: true,
      status: "allowed",
      mfaVerified: true,
    });

    const dashboard = AdminDashboardResponseSchema.parse({
      summary: {
        exceptionQueues: {
          needsReview: 4,
          quarantine: 1,
          reports: 1,
          systemFailures: 2,
        },
        automationHealth: {
          autoApproved: 16,
          needsReview: 4,
          quarantined: 1,
          autoApprovalRate: 0.76,
        },
        riskHotlist: [],
        systemHealth: {
          failedJobs: 2,
          paymentFailures: 1,
          openTrustSignals: 1,
        },
        reviewQueue: { pendingCount: 4, highRiskCount: 1 },
        jobHealth: {
          queued: 2,
          running: 1,
          failed: 0,
          lastRunAt: now,
        },
        paymentHealth: {
          recentFailures: 0,
          lastEventAt: now,
        },
        trustSafety: {
          pendingProfiles: 3,
          rejectedProfiles: 1,
          flaggedProfiles: 0,
        },
        recentAuditLogs: [
          {
            id,
            actorUserId: userId,
            action: "review.approved",
            targetType: "profile",
            targetId: id,
            metadata: {},
            createdAt: now,
          },
        ],
      },
    });

    const queue = AdminReviewQueueResponseSchema.parse({
      reviews: [
        {
          id,
          entityType: "profile",
          entityId: id,
          status: "pending",
          exceptionQueue: "needs_review",
          eligibilityStatus: "limited",
          reviewOutcome: "needs_review",
          riskLevel: "medium",
          source: "automated_checks",
          summary: "Profile awaiting moderation",
          submittedAt: now,
          updatedAt: now,
        },
      ],
    });

    const detail = AdminReviewDetailResponseSchema.parse({
      review: queue.reviews[0],
      submittedFields: { displayName: "Ayse" },
      riskWarnings: ["Low completion score"],
      relatedEvents: [{ label: "Profile created", createdAt: now }],
      auditHistory: dashboard.summary.recentAuditLogs,
      decisionNotesRequired: true,
    });

    const pendingProfiles = AdminPendingProfilesResponseSchema.parse({
      profiles: [
        {
          id,
          userId,
          role: "author",
          displayName: "Ayşe Yılmaz",
          profilePhotoUrl: null,
          signupIntent: "find_publisher",
          approvalStatus: "pending",
          locale: "tr",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const profileDecision = AdminProfileDecisionRequestSchema.parse({
      decision: "approved",
    });

    const decision = AdminReviewDecisionRequestSchema.parse({
      decision: "rejected",
      internalNote: "Missing required identity data",
    });

    const queueQuery = AdminReviewQueueQuerySchema.parse({
      entityType: "manuscript",
      status: "pending",
      exceptionQueue: "needs_review",
    });
    expect(queueQuery.limit).toBe(50);
    expect(AdminReviewQueueQuerySchema.parse({ limit: "25" }).limit).toBe(25);
    expect(() => AdminReviewQueueQuerySchema.parse({ limit: 101 })).toThrow();

    const jobs = AdminJobHealthResponseSchema.parse({
      summary: dashboard.summary.jobHealth,
      runs: [
        {
          id,
          jobType: "matching",
          status: "running",
          source: "queue-worker",
          errorMessage: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const payments = AdminPaymentHealthResponseSchema.parse({
      summary: dashboard.summary.paymentHealth,
      events: [
        {
          id,
          provider: "paytr",
          eventType: "subscription.renewed",
          status: "processed",
          failureReason: null,
          occurredAt: now,
        },
      ],
    });

    const trustSafety = AdminTrustSafetyResponseSchema.parse({
      summary: dashboard.summary.trustSafety,
      signals: [
        {
          id,
          profileId: id,
          signalType: "identity_mismatch",
          severity: "high",
          status: "open",
          note: "Name mismatch in verification flow",
          createdAt: now,
        },
      ],
    });

    expect(access.access).toBe(true);
    expect(dashboard.summary.exceptionQueues.needsReview).toBe(4);
    expect(pendingProfiles.profiles[0]?.approvalStatus).toBe("pending");
    expect(profileDecision.decision).toBe("approved");
    expect(detail.review.id).toBe(id);
    expect(decision.decision).toBe("rejected");
    expect(queueQuery.entityType).toBe("manuscript");
    expect(jobs.runs[0]?.jobType).toBe("matching");
    expect(payments.events[0]?.provider).toBe("paytr");
    expect(trustSafety.signals[0]?.signalType).toBe("identity_mismatch");
  });

  it("accepts MFA-required admin access payloads", () => {
    const parsed = AdminAccessResponseSchema.parse({
      access: false,
      status: "mfa_required",
      mfaVerified: false,
    });

    expect(parsed.status).toBe("mfa_required");
  });

  it("exports routes for onboarding and admin vertical slices", () => {
    expect(ApiRoutes.health.get.path).toBe("/health");
    expect(ApiRoutes.profiles.me.path).toBe("/api/v1/profiles/me");
    expect(ApiRoutes.profiles.create.path).toBe("/api/v1/profiles");
    expect(ApiRoutes.admin.access.path).toBe("/api/v1/admin/access");
    expect(ApiRoutes.admin.dashboard.path).toBe("/api/v1/admin/dashboard");
    expect(ApiRoutes.admin.pendingProfiles.path).toBe(
      "/api/v1/admin/pending-profiles",
    );
    expect(ApiRoutes.admin.profileDecision.path).toBe(
      "/api/v1/admin/profiles/:profileId/decision",
    );
    expect(ApiRoutes.admin.reviewQueue.path).toBe("/api/v1/admin/reviews");
    expect(ApiRoutes.admin.reviewDetail.path).toBe(
      "/api/v1/admin/reviews/:reviewId",
    );
    expect(ApiRoutes.admin.reviewDecision.path).toBe(
      "/api/v1/admin/reviews/:reviewId/decision",
    );
    expect(ApiRoutes.admin.jobsHealth.path).toBe("/api/v1/admin/jobs/health");
    expect(ApiRoutes.admin.paymentsHealth.path).toBe(
      "/api/v1/admin/payments/health",
    );
    expect(ApiRoutes.admin.trustSafety.path).toBe("/api/v1/admin/trust-safety");
    expect(ApiRoutes.manuscripts.list.path).toBe("/api/v1/manuscripts");
    expect(ApiRoutes.manuscripts.create.path).toBe("/api/v1/manuscripts");
    expect(ApiRoutes.uploads.requestSignedUrl.path).toBe(
      "/api/v1/uploads/signed-url",
    );
    expect(ApiRoutes.uploads.localUpload.path).toBe(
      "/api/v1/uploads/local/:uploadToken",
    );
    expect(ApiRoutes.documents.completeUpload.path).toBe(
      "/api/v1/documents/:id/complete-upload",
    );
    expect(Object.keys(ApiRoutes)).toEqual([
      "health",
      "profiles",
      "admin",
      "manuscripts",
      "uploads",
      "documents",
    ]);
  });

  it("builds typed API client requests from shared route contracts", async () => {
    const calls: Array<{ input: string; body?: string }> = [];
    const client = createApiClient({
      baseUrl: "https://api.example.test",
      getAuthToken: () => "token-1",
      fetcher: async (input, init) => {
        calls.push({ input, body: init.body });

        return {
          ok: true,
          status: 200,
          json: async () => ({
            profile: {
              id,
              userId,
              role: "author",
              displayName: "Ayşe Yılmaz",
              profilePhotoUrl: null,
              signupIntent: "find_publisher",
              approvalStatus: "pending",
              eligibilityStatus: "limited",
              reviewOutcome: "needs_review",
              locale: "tr",
              createdAt: now,
              updatedAt: now,
            },
            details: null,
          }),
        };
      },
    });

    const response = await client.request(ApiRoutes.profiles.create, {
      body: {
        role: "author",
        displayName: "Ayşe Yılmaz",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });

    expect(response.profile.role).toBe("author");
    expect(calls[0]?.input).toBe("https://api.example.test/api/v1/profiles");
    expect(calls[0]?.body).toContain("Ayşe");
  });

  it("builds route paths with query values", () => {
    expect(buildApiPath("/api/v1/profiles/me", undefined, {})).toBe(
      "/api/v1/profiles/me",
    );
  });

  it("emits OpenAPI paths for onboarding and admin vertical slices", () => {
    const document = buildOpenApiDocument();

    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/v1/admin/access",
      "/api/v1/admin/audit-logs",
      "/api/v1/admin/dashboard",
      "/api/v1/admin/jobs/health",
      "/api/v1/admin/payments/health",
      "/api/v1/admin/pending-profiles",
      "/api/v1/admin/profiles/{profileId}/decision",
      "/api/v1/admin/reviews",
      "/api/v1/admin/reviews/{reviewId}",
      "/api/v1/admin/reviews/{reviewId}/decision",
      "/api/v1/admin/trust-safety",
      "/api/v1/documents/{id}",
      "/api/v1/documents/{id}/complete-upload",
      "/api/v1/documents/{id}/download-url",
      "/api/v1/manuscripts",
      "/api/v1/manuscripts/{id}",
      "/api/v1/profiles",
      "/api/v1/profiles/me",
      "/api/v1/profiles/me/onboarding-details",
      "/api/v1/uploads/local/{uploadToken}",
      "/api/v1/uploads/signed-url",
      "/health",
    ]);
    expect(document.paths["/api/v1/profiles"]?.post).toMatchObject({
      operationId: "profiles_create",
    });
    expect(document.components.schemas.ApiError).toMatchObject({
      type: "object",
    });
  });
});
