import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  webAppUrl: "http://localhost:5173",
};

describe("API scaffold", () => {
  it("serves the health contract", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
  });

  it("requires authentication before profile creation", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      payload: {
        role: "author",
        displayName: "Ayse Yilmaz",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates a limited onboarding profile in test auth mode", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "publisher",
        displayName: "Istanbul Books",
        profilePhotoUrl: "https://example.com/istanbul-books.png",
        signupIntent: "discover_manuscripts",
        locale: "tr",
      },
    });

    const body = response.json();
    expect(response.statusCode).toBe(201);
    expect(body.profile).toMatchObject({
      userId: "00000000-0000-4000-8000-000000000010",
      role: "publisher",
      displayName: "Istanbul Books",
      profilePhotoUrl: "https://example.com/istanbul-books.png",
      signupIntent: "discover_manuscripts",
      approvalStatus: "pending",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
      locale: "tr",
    });
    expect(body.details).toBeNull();
  });

  it("blocks admin accounts from creating marketplace profiles", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: {
        role: "author",
        displayName: "Root User",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "admin_account_cannot_create_profile",
        message: "Admin accounts cannot create marketplace profiles",
      },
    });
  });

  it("requires authentication before fetching own profile", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/me",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns own profile in test auth mode", async () => {
    const app = buildApp({ config: testConfig });

    await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "author",
        displayName: "Test User",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/me",
      headers: { authorization: "Bearer test-user" },
    });

    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.profile).toMatchObject({
      userId: "00000000-0000-4000-8000-000000000010",
      profilePhotoUrl: null,
      signupIntent: "find_publisher",
      approvalStatus: "pending",
      eligibilityStatus: "limited",
      reviewOutcome: "needs_review",
    });
    expect(body.details).toBeNull();
  });

  it("completes author onboarding details", async () => {
    const app = buildApp({ config: testConfig });

    await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "author",
        displayName: "Ayse Yilmaz",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profiles/me/onboarding-details",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "author",
        biography: "Roman ve oyku projeleri uzerinde calisiyorum.",
        primaryGenre: "Roman",
        writingLanguages: ["tr", "en"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      profile: {
        role: "author",
        approvalStatus: "approved",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
      },
      details: {
        role: "author",
        primaryGenre: "Roman",
        writingLanguages: ["tr", "en"],
      },
    });
  });

  it("completes publisher onboarding details", async () => {
    const app = buildApp({ config: testConfig });

    await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "publisher",
        displayName: "Istanbul Books",
        profilePhotoUrl: null,
        signupIntent: "discover_manuscripts",
        locale: "tr",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profiles/me/onboarding-details",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "publisher",
        focusGenres: ["Roman", "Cocuk"],
        preferredLanguages: ["tr"],
        acceptsUnsolicited: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      profile: {
        role: "publisher",
        approvalStatus: "approved",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
      },
      details: {
        role: "publisher",
        focusGenres: ["Roman", "Cocuk"],
        preferredLanguages: ["tr"],
        acceptsUnsolicited: true,
      },
    });
  });

  it("rejects onboarding detail submissions that do not match the saved role", async () => {
    const app = buildApp({ config: testConfig });

    await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "author",
        displayName: "Ayse Yilmaz",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/profiles/me/onboarding-details",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "publisher",
        focusGenres: ["Roman"],
        preferredLanguages: ["tr"],
        acceptsUnsolicited: false,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "profile_role_mismatch",
        message: "Onboarding details must match the saved marketplace role",
      },
    });
  });

  it("returns not found for admin accounts with no marketplace profile", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/me",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "not_found",
        message: "No profile found for this account",
      },
    });
  });

  it("blocks non-admin users from admin routes", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: { authorization: "Bearer test-user" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("reports admin access status for authenticated users", async () => {
    const app = buildApp({ config: testConfig });

    const nonAdminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/access",
      headers: { authorization: "Bearer test-user" },
    });

    expect(nonAdminResponse.statusCode).toBe(200);
    expect(nonAdminResponse.json()).toEqual({
      access: false,
      status: "no_access",
      mfaVerified: false,
    });

    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/access",
      headers: { authorization: "Bearer test-admin" },
    });

    expect(adminResponse.statusCode).toBe(200);
    expect(adminResponse.json()).toEqual({
      access: false,
      status: "mfa_required",
      mfaVerified: false,
    });
  });

  it("reports allowed admin access when MFA is satisfied", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/access",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      access: true,
      status: "allowed",
      mfaVerified: true,
    });
  });

  it("reports revoked admin access for revoked staff accounts", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/access",
      headers: { authorization: "Bearer test-admin-revoked" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      access: false,
      status: "revoked",
      mfaVerified: true,
    });
  });

  it("answers CORS preflight requests for authenticated admin access", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/admin/access",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-methods"]).toContain("GET");
    expect(response.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );
  });

  it("allows localhost fallback ports for CORS in local mode", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/admin/access",
      headers: {
        origin: "http://localhost:5175",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5175",
    );
  });

  it("returns CORS headers on authenticated admin access responses", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/access",
      headers: {
        authorization: "Bearer test-admin-mfa",
        origin: "http://localhost:5173",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.json()).toEqual({
      access: true,
      status: "allowed",
      mfaVerified: true,
    });
  });

  it("returns admin dashboard for admin users", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().summary).toMatchObject({
      exceptionQueues: {
        needsReview: 3,
        quarantine: 1,
        reports: 1,
        systemFailures: 2,
      },
      automationHealth: {
        needsReview: 3,
        quarantined: 1,
      },
      systemHealth: {
        failedJobs: 1,
        paymentFailures: 1,
        openTrustSignals: 1,
      },
      reviewQueue: { pendingCount: 4, highRiskCount: 2 },
    });
    expect(response.json().summary.riskHotlist[0]).toMatchObject({
      riskLevel: "high",
    });
  });

  it("lists pending profiles for admin users", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/pending-profiles",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().profiles).toMatchObject([
      {
        id: "00000000-0000-4000-8000-000000000211",
        displayName: "Ayşe Yılmaz",
        approvalStatus: "pending",
        eligibilityStatus: "limited",
        reviewOutcome: "needs_review",
        role: "author",
      },
      {
        id: "00000000-0000-4000-8000-000000000212",
        displayName: "İstanbul Kitapları",
        approvalStatus: "pending",
        eligibilityStatus: "limited",
        reviewOutcome: "needs_review",
        role: "publisher",
      },
    ]);
  });

  it("updates and audits pending profile decisions from the legacy admin endpoint", async () => {
    const app = buildApp({ config: testConfig });
    const profileId = "00000000-0000-4000-8000-000000000211";

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/profiles/${profileId}/decision`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "approved" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().profile).toMatchObject({
      id: profileId,
      approvalStatus: "approved",
      eligibilityStatus: "eligible",
      reviewOutcome: "admin_approved",
    });

    const pendingResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/pending-profiles",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(pendingResponse.statusCode).toBe(200);
    expect(pendingResponse.json().profiles).toHaveLength(1);
    expect(pendingResponse.json().profiles[0]?.id).toBe(
      "00000000-0000-4000-8000-000000000212",
    );

    const logsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json().logs[0]).toMatchObject({
      action: "review.approved",
      targetType: "profile",
      targetId: profileId,
    });
  });

  it("rejects legacy profile decisions after the pending review is decided", async () => {
    const app = buildApp({ config: testConfig });
    const profileId = "00000000-0000-4000-8000-000000000211";

    const firstResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/profiles/${profileId}/decision`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "approved" },
    });

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/profiles/${profileId}/decision`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "rejected" },
    });

    expect(secondResponse.statusCode).toBe(404);
    expect(secondResponse.json()).toEqual({
      error: {
        code: "not_found",
        message: "Pending profile review not found",
      },
    });
  });

  it("requires internal notes when the legacy admin endpoint rejects a pending profile", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/profiles/00000000-0000-4000-8000-000000000211/decision",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "rejected" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("audits legacy profile rejections with the supplied internal note", async () => {
    const app = buildApp({ config: testConfig });
    const profileId = "00000000-0000-4000-8000-000000000211";

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/profiles/${profileId}/decision`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: {
        decision: "rejected",
        internalNote: "Identity check failed",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().profile).toMatchObject({
      id: profileId,
      approvalStatus: "rejected",
      eligibilityStatus: "blocked",
      reviewOutcome: "admin_rejected",
    });

    const logsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json().logs[0]).toMatchObject({
      action: "review.rejected",
      targetType: "profile",
      targetId: profileId,
      metadata: { internalNote: "Identity check failed" },
    });
  });

  it("returns not found when a profile decision targets an unknown profile", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/profiles/00000000-0000-4000-8000-000000000299/decision",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "rejected" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Pending profile review not found",
      },
    });
  });

  it("requires rejection notes when admin rejects a review", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/reviews/00000000-0000-4000-8000-000000000111/decision",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "rejected" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("requires internal notes when admin quarantines a review", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/reviews/00000000-0000-4000-8000-000000000111/decision",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "quarantined" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("writes an audit log when admin approves a review", async () => {
    const app = buildApp({ config: testConfig });

    const reviewId = "00000000-0000-4000-8000-000000000111";

    const decisionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/reviews/${reviewId}/decision`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "approved" },
    });

    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json().review).toMatchObject({
      id: reviewId,
      status: "approved",
    });

    const logsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json().logs[0]).toMatchObject({
      action: "review.approved",
      targetType: "profile",
      targetId: "00000000-0000-4000-8000-000000000211",
    });
  });

  it("writes an audit log and quarantine outcome when admin quarantines a review", async () => {
    const app = buildApp({ config: testConfig });

    const reviewId = "00000000-0000-4000-8000-000000000111";

    const decisionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/reviews/${reviewId}/decision`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: {
        decision: "quarantined",
        internalNote: "Potential malware signal from document scanner",
      },
    });

    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json().review).toMatchObject({
      id: reviewId,
      status: "rejected",
      eligibilityStatus: "quarantined",
      reviewOutcome: "quarantined",
    });

    const logsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/audit-logs",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json().logs[0]).toMatchObject({
      action: "review.quarantined",
      targetType: "profile",
    });
  });

  it("returns not found when admin decides a missing review", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/reviews/00000000-0000-4000-8000-000000000999/decision",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { decision: "approved" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("filters review queue by entity type", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reviews?entityType=manuscript",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reviews).toHaveLength(1);
    expect(response.json().reviews[0].entityType).toBe("manuscript");
  });

  it("limits review queue results with deterministic priority ordering", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reviews?limit=2",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reviews).toHaveLength(2);
    expect(
      response.json().reviews.map((review: { id: string }) => review.id),
    ).toEqual([
      "00000000-0000-4000-8000-000000000111",
      "00000000-0000-4000-8000-000000000114",
    ]);
  });

  it("preserves review queue filters when a limit is supplied", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reviews?exceptionQueue=needs_review&limit=1",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reviews).toHaveLength(1);
    expect(response.json().reviews[0]).toMatchObject({
      exceptionQueue: "needs_review",
      riskLevel: "high",
    });
  });

  it("filters review queue by exception queue", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/reviews?exceptionQueue=quarantine",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reviews).toHaveLength(1);
    expect(response.json().reviews[0]).toMatchObject({
      exceptionQueue: "quarantine",
      eligibilityStatus: "quarantined",
    });
  });

  it("returns admin jobs health feed for admin users", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/jobs/health",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: { queued: 1, running: 1, failed: 1 },
    });
    expect(response.json().runs[0]).toMatchObject({
      jobType: "document_ingestion",
    });
  });

  it("returns admin payments health feed for admin users", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/payments/health",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: { recentFailures: 1 },
    });
    expect(response.json().events[0]).toMatchObject({
      provider: "paytr",
    });
  });

  it("returns trust/safety feed for admin users", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/trust-safety",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: { flaggedProfiles: 1 },
    });
    expect(response.json().signals[0]).toMatchObject({
      signalType: "identity_mismatch",
    });
  });

  it("blocks admin routes until MFA is satisfied", async () => {
    const app = buildApp({ config: testConfig });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/dashboard",
      headers: { authorization: "Bearer test-admin" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: "forbidden",
        message: "Admin access is required",
      },
    });
  });
});
