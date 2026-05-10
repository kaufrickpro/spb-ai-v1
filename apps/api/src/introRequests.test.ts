import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import { createIntroRequestTestState } from "./modules/introRequests/testState.js";
import {
  createManuscriptTestState,
  createTestDocument,
  TEST_AUTHOR_MANUSCRIPT_ID,
} from "./modules/manuscripts/testState.js";
import { createProfileTestState } from "./modules/profiles/testState.js";
import { createMatchingTestState } from "./modules/matching/testState.js";
import { createEmailTestState } from "./modules/email/testState.js";
import { TEST_USER_ID } from "./modules/auth/requestAuth.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  webAppUrl: "http://localhost:5173",
};

describe("Step 11 intro requests", () => {
  it("rejects forged create fields before they can be stripped", async () => {
    const { app, publisherProfileId } = await buildIntroFixture();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
        publisherProfileId,
        requesterProfileId: publisherProfileId,
        status: "accepted",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("creates an intro request from match evidence and records safe side effects", async () => {
    const { app, introRequests, publisherProfileId } =
      await buildIntroFixture();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
        publisherProfileId,
        message: "Could we talk about this manuscript?",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().request.introState.status).toBe("pending_sent");
    expect(introRequests.notifications).toHaveLength(1);
    expect(introRequests.productAuditEvents).toHaveLength(1);
    expect(JSON.stringify(introRequests.productAuditEvents)).not.toContain(
      "Could we talk",
    );
  });

  it("blocks duplicate pending intro requests for the same pair", async () => {
    const { app, publisherProfileId } = await buildIntroFixture();
    const payload = {
      manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
      publisherProfileId,
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
      payload,
    });
    expect(first.statusCode).toBe(201);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
      payload,
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("rechecks current eligibility before accepting an intro request", async () => {
    const { app, manuscripts, publisherProfileId } = await buildIntroFixture();

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
        publisherProfileId,
      },
    });
    expect(created.statusCode).toBe(201);

    manuscripts.manuscripts[0] = {
      ...manuscripts.manuscripts[0],
      eligibilityStatus: "blocked",
    };

    const accepted = await app.inject({
      method: "POST",
      url: `/api/v1/intro-requests/${created.json().request.id}/accept`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(accepted.statusCode).toBe(400);
  });

  it("lets the recipient accept and then unlocks contact plus publisher sample download", async () => {
    const { app, documentId, email, publisherProfileId } =
      await buildIntroFixture();

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
      payload: {
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
        publisherProfileId,
      },
    });
    expect(created.statusCode).toBe(201);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/v1/intro-requests/${created.json().request.id}/accept`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(accepted.statusCode).toBe(200);
    expect(email.outbox[0].templateKey).toBe("intro_request_accepted");
    expect(email.outbox[0].recipientProfileId).toBe(
      created.json().request.requesterProfileId,
    );

    const authorList = await app.inject({
      method: "GET",
      url: "/api/v1/intro-requests",
      headers: { authorization: "Bearer test-user" },
    });
    expect(authorList.json().requests[0].acceptedIntroContact.email).toBe(
      "rights@example.com",
    );

    const download = await app.inject({
      method: "GET",
      url: `/api/v1/documents/${documentId}/download-url`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(download.statusCode).toBe(200);
    expect(download.json().downloadUrl).toContain(
      "/api/v1/documents/local-download/",
    );
  });
});

async function buildIntroFixture() {
  const manuscripts = createManuscriptTestState();
  const profiles = createProfileTestState();
  const matching = createMatchingTestState();
  const introRequests = createIntroRequestTestState();
  const email = createEmailTestState();
  const document = createTestDocument(
    manuscripts,
    "20000000-0000-4000-8000-000000000011",
    "intro-upload",
    TEST_AUTHOR_MANUSCRIPT_ID,
    TEST_USER_ID,
    "sample.txt",
    "text/plain",
    12,
  );
  manuscripts.documents[0] = {
    ...document,
    storageStatus: "uploaded",
    processingStatus: "succeeded",
    eligibilityStatus: "eligible",
    reviewOutcome: "auto_approved",
  };
  manuscripts.manuscripts[0] = {
    ...manuscripts.manuscripts[0],
    sampleDocumentId: document.id,
  };

  const app = buildApp({
    config: testConfig,
    testState: { email, introRequests, manuscripts, matching, profiles },
  });

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
  await app.inject({
    method: "POST",
    url: "/api/v1/billing/trial/start",
    headers: { authorization: "Bearer test-user" },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/profiles",
    headers: { authorization: "Bearer test-publisher" },
    payload: {
      role: "publisher",
      displayName: "Test Publisher",
      profilePhotoUrl: null,
      signupIntent: "discover_manuscripts",
      locale: "tr",
    },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/profiles/me/onboarding-details",
    headers: { authorization: "Bearer test-publisher" },
    payload: {
      role: "publisher",
      publisherName: "Test Publisher",
      focusGenres: ["Roman"],
      preferredLanguages: ["tr"],
      acceptsUnsolicited: true,
      acceptedAudienceCategories: ["adult"],
      acceptedManuscriptForms: ["novel"],
      submissionGuidelines: "Send a concise pitch.",
    },
  });
  await app.inject({
    method: "POST",
    url: "/api/v1/billing/trial/start",
    headers: { authorization: "Bearer test-publisher" },
  });
  await app.inject({
    method: "PUT",
    url: "/api/v1/profiles/me/match-visible-contacts",
    headers: { authorization: "Bearer test-publisher" },
    payload: {
      publicEmail: "rights@example.com",
      publicPhone: null,
      websiteUrl: "https://publisher.example.com",
      socialLinks: [],
      visibility: {
        publicEmail: true,
        publicPhone: false,
        websiteUrl: true,
        socialLinks: false,
      },
    },
  });

  const match = await app.inject({
    method: "POST",
    url: "/api/v1/matches/run",
    headers: { authorization: "Bearer test-user" },
    payload: {
      direction: "author_to_publisher",
      manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
    },
  });

  return {
    app,
    documentId: document.id,
    email,
    introRequests,
    manuscripts,
    publisherProfileId: match.json().candidates[0].candidateProfileId as string,
  };
}
