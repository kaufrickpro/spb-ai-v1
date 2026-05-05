import { describe, expect, it } from "vitest";
import {
  APP_REGISTERED_ROUTE_PATHS,
  DOCUMENTED_APP_ROUTES,
  DOCUMENTED_PUBLIC_ROUTES,
  WEB_ROUTES,
  matchCandidatePath,
} from "./routes";

describe("web route map", () => {
  it("keeps documented public routes in route constants", () => {
    expect(DOCUMENTED_PUBLIC_ROUTES).toEqual([
      "/",
      "/features",
      "/pricing",
      "/publishers",
      "/authors",
      "/editorial",
      "/works",
      "/login",
      "/signup",
      "/auth/callback",
      "/forgot-password",
      "/terms",
      "/privacy",
      "/kvkk",
      "/cookies",
    ]);
  });

  it("keeps documented app routes in route constants", () => {
    expect(DOCUMENTED_APP_ROUTES).toEqual([
      "/onboarding",
      "/app/dashboard",
      "/app/manuscripts",
      "/app/manuscripts/:id",
      "/app/matches",
      "/app/matches/:matchRunId/candidates/:candidateId",
      "/app/discover/authors",
      "/app/discover/publishers",
      "/app/requests",
      "/app/profile",
      "/app/billing",
      "/app/settings",
    ]);
  });

  it("registers the documented public and app routes in App", () => {
    expect(APP_REGISTERED_ROUTE_PATHS).toEqual(
      expect.arrayContaining([
        ...DOCUMENTED_PUBLIC_ROUTES,
        ...DOCUMENTED_APP_ROUTES,
      ]),
    );
  });

  it("builds match candidate detail paths", () => {
    expect(
      matchCandidatePath({
        matchRunId: "run-1",
        candidateId: "candidate-2",
      }),
    ).toBe("/app/matches/run-1/candidates/candidate-2");
    expect(WEB_ROUTES.matchCandidate).toBe(
      "/app/matches/:matchRunId/candidates/:candidateId",
    );
  });
});
