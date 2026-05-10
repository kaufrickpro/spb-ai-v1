import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import {
  createManuscriptTestState,
  createTestManuscript,
  createTestDocument,
  TEST_AUTHOR_MANUSCRIPT_ID,
} from "./modules/manuscripts/testState.js";
import {
  addTestPaymentEvent,
  addTestSubscription,
  createBillingTestState,
} from "./modules/billing/testState.js";
import { TEST_USER_ID } from "./modules/auth/requestAuth.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  paytrProviderMode: "disabled" as const,
  paytrTokenUrl: "https://www.paytr.com/odeme/api/get-token",
  webAppUrl: "http://localhost:5173",
};

describe("Step 13a billing and entitlement", () => {
  it("returns catalog, trial availability, and zero usage before trial start", async () => {
    const app = buildApp({ config: testConfig });
    await createEligibleAuthor(app);

    const subscription = await app.inject({
      method: "GET",
      url: "/api/v1/billing/subscription",
      headers: { authorization: "Bearer test-user" },
    });
    const usage = await app.inject({
      method: "GET",
      url: "/api/v1/billing/usage",
      headers: { authorization: "Bearer test-user" },
    });

    expect(subscription.statusCode).toBe(200);
    expect(subscription.json().subscription).toMatchObject({
      active: false,
      entitlementStatus: "trial_available",
      role: "author",
      trial: { available: true, used: false },
    });
    expect(
      subscription
        .json()
        .subscription.plans.map((plan: { slug: string }) => plan.slug),
    ).toEqual([
      "author-trial",
      "publisher-trial",
      "author-pro-monthly",
      "author-pro-annual",
      "publisher-pro-monthly",
      "publisher-pro-annual",
    ]);
    expect(usage.statusCode).toBe(200);
    expect(usage.json().usage.introRequests.used).toBe(0);
  });

  it("starts the role-derived trial once and makes upload entitlement active", async () => {
    const app = buildApp({ config: testConfig });
    await createEligibleAuthor(app);

    const started = await app.inject({
      method: "POST",
      url: "/api/v1/billing/trial/start",
      headers: { authorization: "Bearer test-user" },
    });
    const repeated = await app.inject({
      method: "POST",
      url: "/api/v1/billing/trial/start",
      headers: { authorization: "Bearer test-user" },
    });

    expect(started.statusCode).toBe(200);
    expect(started.json().subscription.currentSubscription.plan.slug).toBe(
      "author-trial",
    );
    expect(started.json().subscription.capabilities.uploadSample.allowed).toBe(
      true,
    );
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().subscription.currentSubscription.id).toBe(
      started.json().subscription.currentSubscription.id,
    );
  });

  it("denies gated upload and match actions before the trial starts", async () => {
    const app = buildApp({ config: testConfig });
    await createEligibleAuthor(app);

    const upload = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: "10000000-0000-4000-8000-000000000001",
        fileName: "sample.txt",
        mimeType: "text/plain",
        fileSizeBytes: 12,
      },
    });
    const match = await app.inject({
      method: "POST",
      url: "/api/v1/matches/run",
      headers: { authorization: "Bearer test-user" },
      payload: {
        direction: "author_to_publisher",
        manuscriptId: "10000000-0000-4000-8000-000000000001",
      },
    });

    expect(upload.statusCode).toBe(400);
    expect(upload.json().error).toMatchObject({
      code: "entitlement_denied",
      details: { reason: "trial_not_started", recoveryAction: "start_trial" },
    });
    expect(match.statusCode).toBe(400);
    expect(match.json().error.details.reason).toBe("trial_not_started");
  });

  it("denies author uploads that would exceed active storage limits", async () => {
    const manuscripts = createManuscriptTestState();
    const otherManuscript = createTestManuscript(manuscripts, TEST_USER_ID, {
      title: "Other manuscript",
      genre: "Roman",
      language: "tr",
    });
    const activeDocument = createTestDocument(
      manuscripts,
      "30000000-0000-4000-8000-000000000001",
      "existing-upload",
      otherManuscript.id,
      TEST_USER_ID,
      "existing.txt",
      "text/plain",
      49 * 1024 * 1024,
    );
    manuscripts.documents[0] = {
      ...activeDocument,
      eligibilityStatus: "eligible",
      processingStatus: "succeeded",
      reviewOutcome: "auto_approved",
      storageStatus: "uploaded",
    };
    const app = buildApp({ config: testConfig, testState: { manuscripts } });
    await createEligibleAuthor(app);
    await app.inject({
      method: "POST",
      url: "/api/v1/billing/trial/start",
      headers: { authorization: "Bearer test-user" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/uploads/signed-url",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
        fileName: "too-much.txt",
        mimeType: "text/plain",
        fileSizeBytes: 2 * 1024 * 1024,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details.reason).toBe("storage_limit_exceeded");
  });

  it("denies trial start for incomplete role details and staff identities", async () => {
    const app = buildApp({ config: testConfig });
    await app.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "author",
        displayName: "Test Author",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });

    const incomplete = await app.inject({
      method: "POST",
      url: "/api/v1/billing/trial/start",
      headers: { authorization: "Bearer test-user" },
    });
    const admin = await app.inject({
      method: "POST",
      url: "/api/v1/billing/trial/start",
      headers: { authorization: "Bearer test-admin-mfa" },
    });

    expect(incomplete.statusCode).toBe(400);
    expect(incomplete.json().error.details.reason).toBe(
      "role_details_incomplete",
    );
    expect(admin.statusCode).toBe(403);
  });

  it("creates browser-safe PayTR checkout tokens for paid monthly and annual plans", async () => {
    const app = buildApp({ config: testConfig });
    await createEligibleAuthor(app);

    const monthly = await app.inject({
      method: "POST",
      url: "/api/v1/billing/paytr/checkout-token",
      headers: { authorization: "Bearer test-user" },
      payload: { planSlug: "author-pro-monthly" },
    });
    const annual = await app.inject({
      method: "POST",
      url: "/api/v1/billing/paytr/checkout-token",
      headers: { authorization: "Bearer test-user" },
      payload: { planSlug: "author-pro-annual" },
    });

    expect(monthly.statusCode).toBe(200);
    expect(annual.statusCode).toBe(200);
    expect(monthly.json().checkout).toMatchObject({
      provider: "paytr",
      plan: { slug: "author-pro-monthly" },
    });
    expect(monthly.json().checkout.iframeUrl).toContain(
      "https://www.paytr.com/odeme/guvenli/",
    );
    expect(JSON.stringify(monthly.json())).not.toContain("merchant");
    expect(JSON.stringify(monthly.json())).not.toContain("salt");
  });

  it("denies invalid checkout plans and ineligible profiles", async () => {
    const app = buildApp({ config: testConfig });
    await createEligibleAuthor(app);
    const invalidPlan = await app.inject({
      method: "POST",
      url: "/api/v1/billing/paytr/checkout-token",
      headers: { authorization: "Bearer test-user" },
      payload: { planSlug: "publisher-pro-monthly" },
    });

    const incompleteApp = buildApp({ config: testConfig });
    await incompleteApp.inject({
      method: "POST",
      url: "/api/v1/profiles",
      headers: { authorization: "Bearer test-user" },
      payload: {
        role: "author",
        displayName: "Incomplete Author",
        profilePhotoUrl: null,
        signupIntent: "find_publisher",
        locale: "tr",
      },
    });
    const ineligible = await incompleteApp.inject({
      method: "POST",
      url: "/api/v1/billing/paytr/checkout-token",
      headers: { authorization: "Bearer test-user" },
      payload: { planSlug: "author-pro-monthly" },
    });

    expect(invalidPlan.statusCode).toBe(400);
    expect(invalidPlan.json().error.details.reason).toBe("role_not_allowed");
    expect(ineligible.statusCode).toBe(400);
  });

  it("processes PayTR webhooks idempotently and stores invalid hash callbacks", async () => {
    const billing = createBillingTestState();
    const app = buildApp({ config: testConfig, testState: { billing } });
    await createEligibleAuthor(app);
    const checkout = await app.inject({
      method: "POST",
      url: "/api/v1/billing/paytr/checkout-token",
      headers: { authorization: "Bearer test-user" },
      payload: { planSlug: "author-pro-monthly" },
    });
    const unknownCheckout = await app.inject({
      method: "POST",
      url: "/api/v1/billing/paytr/checkout-token",
      headers: { authorization: "Bearer test-user" },
      payload: { planSlug: "author-pro-annual" },
    });
    const orderId = checkout.json().checkout.orderId;

    const valid = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/paytr",
      payload: {
        merchant_oid: orderId,
        status: "success",
        total_amount: "10000",
        hash: "valid-test-hash",
      },
    });
    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/paytr",
      payload: {
        merchant_oid: orderId,
        status: "success",
        total_amount: "10000",
        hash: "valid-test-hash",
      },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/paytr",
      payload: {
        merchant_oid: unknownCheckout.json().checkout.orderId,
        status: "provider_new_status",
        total_amount: "100000",
        hash: "valid-test-hash",
      },
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/paytr",
      payload: {
        merchant_oid: "SPBINVALIDHASH",
        status: "success",
        total_amount: "10000",
        hash: "bad",
      },
    });

    expect(valid.statusCode).toBe(200);
    expect(valid.body).toBe("OK");
    expect(replay.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(billing.subscriptions).toHaveLength(1);
    expect(
      billing.paymentEvents.some(
        (event) =>
          event.eventType === "provider_new_status" &&
          event.processingStatus === "stored",
      ),
    ).toBe(true);
    expect(billing.paymentEvents).toHaveLength(3);
    expect(invalid.statusCode).toBe(403);
    expect(JSON.stringify(billing.paymentEvents)).not.toContain("bad");
  });

  it("keeps inactive paid states blocked for new actions while billing history remains readable", async () => {
    const billing = createBillingTestState();
    const app = buildApp({ config: testConfig, testState: { billing } });
    await createEligibleAuthor(app);
    const subscription = await app.inject({
      method: "GET",
      url: "/api/v1/billing/subscription",
      headers: { authorization: "Bearer test-user" },
    });
    const profileId = subscription.json().subscription.profileId;
    for (const status of ["past_due", "cancelled", "expired"] as const) {
      billing.subscriptions.length = 0;
      addTestSubscription(billing, {
        currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
        currentPeriodStart: new Date().toISOString(),
        planSlug: "author-pro-monthly",
        profileId,
        status,
        trialEndsAt: null,
        trialStartedAt: null,
        userId: TEST_USER_ID,
      });

      const read = await app.inject({
        method: "GET",
        url: "/api/v1/billing/subscription",
        headers: { authorization: "Bearer test-user" },
      });
      const upload = await app.inject({
        method: "POST",
        url: "/api/v1/uploads/signed-url",
        headers: { authorization: "Bearer test-user" },
        payload: {
          manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
          fileName: "sample.txt",
          mimeType: "text/plain",
          fileSizeBytes: 12,
        },
      });

      expect(read.statusCode).toBe(200);
      expect(read.json().subscription.entitlementStatus).toBe("inactive");
      expect(upload.statusCode).toBe(400);
      expect(upload.json().error.details.reason).toBe("subscription_inactive");
    }
  });

  it("requires admin MFA for narrow billing repair and forbids free comp creation", async () => {
    const billing = createBillingTestState();
    const event = addTestPaymentEvent(billing, {
      eventType: "success",
      profileId: null,
      processedAt: null,
      processingStatus: "failed",
      providerEventId: "SPBREPAIR1",
      safePayload: { merchant_oid: "SPBREPAIR1" },
      subscriptionId: null,
    });
    const app = buildApp({ config: testConfig, testState: { billing } });

    const nonAdmin = await app.inject({
      method: "POST",
      url: "/api/v1/admin/billing/repair",
      headers: { authorization: "Bearer test-user" },
      payload: {
        action: "mark_event_processed",
        paymentEventId: event.id,
        internalNote: "Provider event reconciled.",
      },
    });
    const noComp = await app.inject({
      method: "POST",
      url: "/api/v1/admin/billing/repair",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: {
        action: "reconcile_subscription_status",
        status: "active",
        internalNote: "Try to create free access.",
      },
    });
    const repaired = await app.inject({
      method: "POST",
      url: "/api/v1/admin/billing/repair",
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: {
        action: "mark_event_processed",
        paymentEventId: event.id,
        internalNote: "Provider event reconciled.",
      },
    });

    expect(nonAdmin.statusCode).toBe(403);
    expect(noComp.statusCode).toBe(400);
    expect(repaired.statusCode).toBe(200);
    expect(billing.paymentEvents[0]?.processingStatus).toBe("processed");
  });
});

async function createEligibleAuthor(app: ReturnType<typeof buildApp>) {
  await app.inject({
    method: "POST",
    url: "/api/v1/profiles",
    headers: { authorization: "Bearer test-user" },
    payload: {
      role: "author",
      displayName: "Test Author",
      profilePhotoUrl: null,
      signupIntent: "find_publisher",
      locale: "tr",
    },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/profiles/me/onboarding-details",
    headers: { authorization: "Bearer test-user" },
    payload: {
      role: "author",
      biography: "Author biography long enough for validation.",
      primaryGenre: "Roman",
      writingLanguages: ["tr"],
    },
  });
}
