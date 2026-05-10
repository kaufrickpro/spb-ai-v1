import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import {
  createManuscriptTestState,
  createTestDocument,
  TEST_AUTHOR_MANUSCRIPT_ID,
} from "./modules/manuscripts/testState.js";
import { createProfileTestState } from "./modules/profiles/testState.js";
import { TEST_USER_ID } from "./modules/auth/requestAuth.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  webAppUrl: "http://localhost:5173",
};

describe("Matching routes", () => {
  it("runs an author-to-publisher match and grants publisher profile access", async () => {
    const { app } = await buildMatchingApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/matches/run",
      headers: { authorization: "Bearer test-user" },
      payload: {
        direction: "author_to_publisher",
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.run.direction).toBe("author_to_publisher");
    expect(body.run.candidateCount).toBe(1);
    expect(body.candidates[0]).toMatchObject({
      candidateType: "publisher",
      explanationStatus: "generated",
      safeSnippets: expect.any(Array),
    });
    expect(JSON.stringify(body)).not.toContain("finalScore");

    const profileResponse = await app.inject({
      method: "GET",
      url: body.candidates[0].profilePath.replace("/app", "/api/v1"),
      headers: { authorization: "Bearer test-user" },
    });
    expect(profileResponse.statusCode).toBe(200);
  });

  it("denies author matching when the manuscript has no processed eligible sample", async () => {
    const { app } = await buildMatchingApp({ processedSample: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/matches/run",
      headers: { authorization: "Bearer test-user" },
      payload: {
        direction: "author_to_publisher",
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("match_not_ready");
  });

  it("runs a publisher-to-manuscript match with redacted manuscript candidates", async () => {
    const { app } = await buildMatchingApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/matches/run",
      headers: { authorization: "Bearer test-publisher" },
      payload: { direction: "publisher_to_manuscript" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.run.direction).toBe("publisher_to_manuscript");
    expect(body.candidates[0]).toMatchObject({
      candidateType: "manuscript",
      candidateManuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
    });
    expect(JSON.stringify(body)).not.toContain("downloadUrl");
    expect(JSON.stringify(body)).not.toContain("sample text");
    expect(JSON.stringify(body)).not.toContain("finalScore");
  });

  it("marks old history entries stale after a match-relevant manuscript edit", async () => {
    const { app } = await buildMatchingApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/matches/run",
      headers: { authorization: "Bearer test-user" },
      payload: {
        direction: "author_to_publisher",
        manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
      },
    });

    await app.inject({
      method: "PATCH",
      url: `/api/v1/manuscripts/${TEST_AUTHOR_MANUSCRIPT_ID}`,
      headers: { authorization: "Bearer test-user" },
      payload: { logline: "A changed logline.", arcSummary: "A changed arc." },
    });

    const history = await app.inject({
      method: "GET",
      url: "/api/v1/profile/history",
      headers: { authorization: "Bearer test-user" },
    });

    expect(history.statusCode).toBe(200);
    expect(history.json().runs[0].stale).toBe(true);
  });
});

async function buildMatchingApp(input: { processedSample?: boolean } = {}) {
  const manuscripts = createManuscriptTestState();
  const profiles = createProfileTestState();
  if (input.processedSample !== false) {
    const document = createTestDocument(
      manuscripts,
      "20000000-0000-4000-8000-000000000001",
      "match-upload",
      TEST_AUTHOR_MANUSCRIPT_ID,
      TEST_USER_ID,
      "sample.txt",
      "text/plain",
      12,
    );
    const manuscriptIndex = manuscripts.manuscripts.findIndex(
      (item) => item.id === TEST_AUTHOR_MANUSCRIPT_ID,
    );
    manuscripts.documents[0] = {
      ...document,
      storageStatus: "uploaded",
      processingStatus: "succeeded",
      eligibilityStatus: "eligible",
      reviewOutcome: "auto_approved",
    };
    manuscripts.manuscripts[manuscriptIndex] = {
      ...manuscripts.manuscripts[manuscriptIndex],
      sampleDocumentId: document.id,
    };
  }
  const app = buildApp({
    config: testConfig,
    testState: { manuscripts, profiles },
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

  return { app, manuscripts, profiles };
}
