import { describe, expect, it } from "vitest";
import { isVisibleMatch, scoreMatchCandidate } from "./scoring.js";

describe("matching scoring", () => {
  it("applies soft penalties without using subscription data as a boost", () => {
    const source = {
      genre: "Roman",
      audienceCategories: ["adult"],
      manuscriptForm: "novel",
      logline: "A memory and power story in a near-future city.",
      declaredThemes: ["memory", "power"],
      subscriptionPlan: "free",
    };
    const paidCandidate = scoreMatchCandidate({
      candidate: {
        acceptedAudienceCategories: ["children"],
        acceptedManuscriptForms: ["essay"],
        acceptedPrimaryGenres: ["Poetry"],
        focusGenres: ["Poetry"],
        subscriptionPlan: "publisher_pro",
        submissionGuidelines: "Poetry and essays only.",
      },
      candidateKind: "publisher",
      rankSeed: "same",
      source,
    });
    const freeCandidate = scoreMatchCandidate({
      candidate: {
        acceptedAudienceCategories: ["children"],
        acceptedManuscriptForms: ["essay"],
        acceptedPrimaryGenres: ["Poetry"],
        focusGenres: ["Poetry"],
        subscriptionPlan: "free",
        submissionGuidelines: "Poetry and essays only.",
      },
      candidateKind: "publisher",
      rankSeed: "same",
      source,
    });

    expect(paidCandidate.finalScore).toBe(freeCandidate.finalScore);
    expect(paidCandidate.penalties.map((penalty) => penalty.code)).toContain(
      "genre_gap",
    );
  });

  it("hides candidates below the visible threshold", () => {
    const result = scoreMatchCandidate({
      candidate: {
        acceptedAudienceCategories: ["children"],
        acceptedManuscriptForms: ["picture_book"],
        acceptedPrimaryGenres: ["Poetry"],
        excludedTopics: ["state violence"],
        submissionGuidelines: "Short poems for children.",
      },
      candidateKind: "publisher",
      rankSeed: "threshold",
      source: {
        audienceCategories: ["adult"],
        declaredContentWarnings: ["state violence"],
        genre: "Distopya",
        manuscriptForm: "novel",
      },
    });

    expect(isVisibleMatch(result)).toBe(false);
    expect(result.scoreBand).toBe("weak");
  });
});
