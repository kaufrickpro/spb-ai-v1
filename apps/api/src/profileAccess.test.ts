import { describe, expect, it } from "vitest";
import { buildApp } from "./server.js";
import {
  TEST_OTHER_AUTHOR_USER_ID,
  TEST_PUBLISHER_USER_ID,
  TEST_USER_ID,
} from "./modules/auth/requestAuth.js";
import {
  addTestProfileAccessGrant,
  completeTestProfileDetails,
  createProfileTestState,
  createTestProfile,
} from "./modules/profiles/testState.js";
import {
  createManuscriptTestState,
  TEST_AUTHOR_MANUSCRIPT_ID,
  TEST_OTHER_AUTHOR_MANUSCRIPT_ID,
} from "./modules/manuscripts/testState.js";

const testConfig = {
  authMode: "test" as const,
  appConfigMode: "local" as const,
  host: "127.0.0.1",
  logLevel: "silent" as const,
  port: 4000,
  webAppUrl: "http://localhost:5173",
};

function buildProfileAccessFixture() {
  const profiles = createProfileTestState();
  const manuscripts = createManuscriptTestState();

  const author = createTestProfile(profiles, TEST_USER_ID, {
    role: "author",
    displayName: "Ayse Yilmaz",
    profilePhotoUrl: null,
    signupIntent: "find_publisher",
    locale: "tr",
  });
  completeTestProfileDetails(profiles, TEST_USER_ID, {
    role: "author",
    biography: "Roman ve oyku projeleri uzerinde calisiyorum.",
    primaryGenre: "Roman",
    writingLanguages: ["tr"],
    styleStatement: "Atmosferik ve karakter odakli anlatilar.",
    influences: ["Latife Tekin"],
  });

  const otherAuthor = createTestProfile(profiles, TEST_OTHER_AUTHOR_USER_ID, {
    role: "author",
    displayName: "Derya Kaya",
    profilePhotoUrl: null,
    signupIntent: "find_publisher",
    locale: "tr",
  });
  completeTestProfileDetails(profiles, TEST_OTHER_AUTHOR_USER_ID, {
    role: "author",
    biography: "Aile ve bellek temali romanlar yaziyorum.",
    primaryGenre: "Roman",
    writingLanguages: ["tr"],
  });

  const publisher = createTestProfile(profiles, TEST_PUBLISHER_USER_ID, {
    role: "publisher",
    displayName: "Istanbul Books",
    profilePhotoUrl: "https://example.com/logo.png",
    signupIntent: "discover_manuscripts",
    locale: "tr",
  });
  completeTestProfileDetails(profiles, TEST_PUBLISHER_USER_ID, {
    role: "publisher",
    focusGenres: ["Roman"],
    preferredLanguages: ["tr"],
    acceptsUnsolicited: true,
    about: "Independent publisher focused on Turkish fiction.",
    editorialFocus: "Literary and speculative fiction.",
    lookingFor: "Voice-led novels with strong premises.",
    submissionGuidelines: "Send a query package through our form.",
    recentAcquisitions: ["Sonbahar Defteri"],
    bestSellingBooks: ["Kiyidaki Ev"],
  });

  addTestProfileAccessGrant(profiles, {
    viewerUserId: TEST_PUBLISHER_USER_ID,
    targetProfileId: otherAuthor.profile.id,
    source: "match_candidate",
    manuscriptId: TEST_OTHER_AUTHOR_MANUSCRIPT_ID,
  });
  addTestProfileAccessGrant(profiles, {
    viewerUserId: TEST_USER_ID,
    targetProfileId: publisher.profile.id,
    source: "match_candidate",
    manuscriptId: TEST_AUTHOR_MANUSCRIPT_ID,
  });

  return {
    app: buildApp({ config: testConfig, testState: { manuscripts, profiles } }),
    author,
    manuscripts,
    otherAuthor,
    profiles,
    publisher,
  };
}

describe("Step 10 profile access foundation", () => {
  it("lists only admin-approved eligible publishers with logo and https website", async () => {
    const { app, publisher } = buildProfileAccessFixture();

    await app.inject({
      method: "PUT",
      url: "/api/v1/profiles/me/match-visible-contacts",
      headers: { authorization: "Bearer test-publisher" },
      payload: {
        publicEmail: "submissions@example.com",
        publicPhone: null,
        websiteUrl: "https://publisher.example.com",
        socialLinks: [],
        visibility: {
          publicEmail: false,
          publicPhone: false,
          websiteUrl: true,
          socialLinks: false,
        },
      },
    });

    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/public/publishers",
        })
      ).json(),
    ).toEqual({ publishers: [] });

    const approval = await app.inject({
      method: "POST",
      url: `/api/v1/admin/publishers/${publisher.profile.id}/public-directory`,
      headers: { authorization: "Bearer test-admin-mfa" },
      payload: { status: "approved" },
    });
    expect(approval.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/public/publishers",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      publishers: [
        {
          id: publisher.profile.id,
          name: "Istanbul Books",
          logoUrl: "https://example.com/logo.png",
          websiteUrl: "https://publisher.example.com",
        },
      ],
    });
  });

  it("redacts disabled contact fields on match-revealed publisher profiles", async () => {
    const { app, publisher } = buildProfileAccessFixture();

    await app.inject({
      method: "PUT",
      url: "/api/v1/profiles/me/match-visible-contacts",
      headers: { authorization: "Bearer test-publisher" },
      payload: {
        publicEmail: "submissions@example.com",
        publicPhone: "555-0101",
        websiteUrl: "https://publisher.example.com",
        socialLinks: [
          {
            label: "Catalog",
            url: "https://publisher.example.com/catalog",
            visible: true,
          },
        ],
        visibility: {
          publicEmail: false,
          publicPhone: false,
          websiteUrl: true,
          socialLinks: true,
        },
      },
    });

    const denied = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/publishers/${publisher.profile.id}`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(denied.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/publishers/${publisher.profile.id}`,
      headers: { authorization: "Bearer test-user" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().publisher.contact).toEqual({
      email: null,
      phone: null,
      websiteUrl: "https://publisher.example.com",
      socialLinks: [
        { label: "Catalog", url: "https://publisher.example.com/catalog" },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain(
      "submissions@example.com",
    );
  });

  it("denies unmatched viewers and allows matched author/manuscript access", async () => {
    const { app, otherAuthor } = buildProfileAccessFixture();

    const denied = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/authors/${otherAuthor.profile.id}`,
      headers: { authorization: "Bearer test-user" },
    });
    expect(denied.statusCode).toBe(404);

    const authorResponse = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/authors/${otherAuthor.profile.id}`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(authorResponse.statusCode).toBe(200);
    expect(authorResponse.json().author.manuscripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: TEST_OTHER_AUTHOR_MANUSCRIPT_ID,
          access: "full",
        }),
      ]),
    );

    const manuscriptResponse = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/manuscripts/${TEST_OTHER_AUTHOR_MANUSCRIPT_ID}`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(manuscriptResponse.statusCode).toBe(200);
    expect(JSON.stringify(manuscriptResponse.json())).not.toContain(
      "downloadUrl",
    );
  });

  it("lets matched publishers request another requestable manuscript and authors approve it", async () => {
    const { app, otherAuthor } = buildProfileAccessFixture();

    const request = await app.inject({
      method: "POST",
      url: `/api/v1/manuscripts/${TEST_OTHER_AUTHOR_MANUSCRIPT_ID}/access-requests`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(request.statusCode).toBe(201);
    expect(request.json().request.status).toBe("pending");

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/manuscripts/${TEST_OTHER_AUTHOR_MANUSCRIPT_ID}/access-requests`,
      headers: { authorization: "Bearer test-publisher" },
    });
    expect(duplicate.statusCode).toBe(409);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/manuscript-access-requests",
      headers: { authorization: "Bearer test-other-author" },
    });
    expect(listed.json().requests).toHaveLength(1);
    expect(listed.json().requests[0].authorProfileId).toBe(
      otherAuthor.profile.id,
    );

    const approved = await app.inject({
      method: "POST",
      url: `/api/v1/manuscript-access-requests/${request.json().request.id}/approve`,
      headers: { authorization: "Bearer test-other-author" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().request.status).toBe("approved");
  });
});
