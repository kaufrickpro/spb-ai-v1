import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import {
  TEST_PUBLISHER_USER_ID,
  TEST_USER_ID,
} from "./modules/auth/requestAuth.js";
import {
  createIntroRequestTestState,
  pushIntroNotification,
} from "./modules/introRequests/testState.js";
import {
  createProfileTestState,
  createTestProfile,
} from "./modules/profiles/testState.js";

const testConfig = {
  appConfigMode: "local" as const,
  authMode: "test" as const,
  documentProcessingProvider: "local" as const,
  documentScannerMode: "local_fake" as const,
  emailProviderMode: "local_fake" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  paytrProviderMode: "disabled" as const,
  paytrTokenUrl: "https://www.paytr.com/odeme/api/get-token",
  port: 4000,
  sentryEnvironment: "local",
  sentryTracesSampleRate: 0,
  storageProvider: "local" as const,
  webAppUrl: "http://localhost:5173",
};

describe("Step 14 notification API", () => {
  it("lists recipient notifications without raw metadata or sensitive text", async () => {
    const { app, introRequests, publisherProfileId } = buildFixture();

    pushIntroNotification(introRequests, {
      actorProfileId: publisherProfileId,
      metadata: {
        manuscript_title: "Quiet Days",
        message: "private intro message",
        signed_url: "https://signed.example",
        token: "secret-token",
      },
      notificationType: "intro_request_created",
      recipientProfileId: publisherProfileId,
      targetId: "20000000-0000-4000-8000-000000000099",
      targetType: "intro_request",
    });
    pushIntroNotification(introRequests, {
      actorProfileId: publisherProfileId,
      metadata: {},
      notificationType: "unknown_future_type",
      recipientProfileId: publisherProfileId,
      targetId: "20000000-0000-4000-8000-000000000098",
      targetType: "intro_request",
    });

    const response = await app.inject({
      headers: { authorization: "Bearer test-publisher" },
      method: "GET",
      url: "/api/v1/notifications",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0]).toMatchObject({
      ctaPath: "/app/requests?box=received",
      target: { label: "Quiet Days", type: "intro_request" },
      type: "intro_request_created",
    });
    const serialized = response.body;
    expect(serialized).not.toContain("private intro message");
    expect(serialized).not.toContain("signed.example");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("metadata");
  });

  it("marks recipient notifications read and denies cross-profile access", async () => {
    const { app, introRequests, publisherProfileId } = buildFixture();
    pushIntroNotification(introRequests, {
      actorProfileId: null,
      metadata: { manuscript_title: "Quiet Days" },
      notificationType: "intro_request_created",
      recipientProfileId: publisherProfileId,
      targetId: "20000000-0000-4000-8000-000000000099",
      targetType: "intro_request",
    });
    const notificationId = introRequests.notifications[0].id;

    const denied = await app.inject({
      headers: { authorization: "Bearer test-user" },
      method: "POST",
      url: `/api/v1/notifications/${notificationId}/read`,
    });
    expect(denied.statusCode).toBe(404);

    const marked = await app.inject({
      headers: { authorization: "Bearer test-publisher" },
      method: "POST",
      url: `/api/v1/notifications/${notificationId}/read`,
    });
    expect(marked.statusCode).toBe(200);
    expect(marked.json().notification.readAt).toEqual(expect.any(String));
    expect(marked.json().unreadCount).toBe(0);
  });

  it("marks all unread notifications for the current profile", async () => {
    const { app, introRequests, publisherProfileId } = buildFixture();
    for (const suffix of ["097", "098", "099"]) {
      pushIntroNotification(introRequests, {
        actorProfileId: null,
        metadata: { manuscript_title: "Quiet Days" },
        notificationType: "intro_request_created",
        recipientProfileId: publisherProfileId,
        targetId: `20000000-0000-4000-8000-000000000${suffix}`,
        targetType: "intro_request",
      });
    }

    const response = await app.inject({
      headers: { authorization: "Bearer test-publisher" },
      method: "POST",
      url: "/api/v1/notifications/read-all",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().unreadCount).toBe(0);
    expect(
      introRequests.notifications.every((item) => item.readAt !== null),
    ).toBe(true);
  });
});

function buildFixture() {
  const profiles = createProfileTestState();
  const introRequests = createIntroRequestTestState();
  createTestProfile(profiles, TEST_USER_ID, {
    displayName: "Author One",
    locale: "tr",
    profilePhotoUrl: null,
    role: "author",
    signupIntent: "find_publisher",
  });
  const publisher = createTestProfile(profiles, TEST_PUBLISHER_USER_ID, {
    displayName: "Publisher One",
    locale: "tr",
    profilePhotoUrl: null,
    role: "publisher",
    signupIntent: "discover_manuscripts",
  });
  const app = buildApp({
    config: testConfig,
    testState: { introRequests, profiles },
  });
  return {
    app,
    introRequests,
    publisherProfileId: publisher.profile.id,
  };
}
