import { createHash } from "node:crypto";
import type { MatchScoreBand } from "@marketplace/contracts";

type CandidateKind = "publisher" | "manuscript";
type PenaltySeverity = "low" | "medium" | "high";

export type MatchScoringInput = {
  candidateKind: CandidateKind;
  rankSeed: string;
  source: Record<string, unknown>;
  candidate: Record<string, unknown>;
};

export type MatchPenalty = {
  code: string;
  label: string;
  severity: PenaltySeverity;
};

export type MatchSafeSnippet = {
  label: string;
  text: string;
};

export type MatchScoringResult = {
  axisBands: Record<"premise" | "voice" | "arc", MatchScoreBand>;
  finalScore: number;
  scoreBand: MatchScoreBand;
  fitReasons: string[];
  riskReasons: string[];
  penalties: MatchPenalty[];
  safeSnippets: MatchSafeSnippet[];
};

const THRESHOLD_VISIBLE_SCORE = 0.35;

export function scoreMatchCandidate(
  input: MatchScoringInput,
): MatchScoringResult {
  const premise = boundedScore(
    overlapScore(
      collectText(input.source, [
        "genre",
        "primaryGenre",
        "subgenres",
        "audienceCategories",
        "manuscriptForm",
        "logline",
        "synopsis",
        "focusGenres",
        "acceptedPrimaryGenres",
        "acceptedAudienceCategories",
        "acceptedManuscriptForms",
        "submissionGuidelines",
      ]),
      collectText(input.candidate, [
        "genre",
        "primaryGenre",
        "subgenres",
        "audienceCategories",
        "manuscriptForm",
        "logline",
        "synopsis",
        "focusGenres",
        "acceptedPrimaryGenres",
        "acceptedAudienceCategories",
        "acceptedManuscriptForms",
        "submissionGuidelines",
      ]),
    ) + seededJitter(input.rankSeed, "premise"),
  );
  const voice = boundedScore(
    overlapScore(
      collectText(input.source, [
        "styleStatement",
        "influences",
        "declaredThemes",
        "shortTeaser",
        "imprintTone",
        "marketPositioning",
        "whatWeAreLookingFor",
      ]),
      collectText(input.candidate, [
        "styleStatement",
        "influences",
        "declaredThemes",
        "shortTeaser",
        "imprintTone",
        "marketPositioning",
        "whatWeAreLookingFor",
      ]),
    ) + seededJitter(input.rankSeed, "voice"),
  );
  const arc = boundedScore(
    overlapScore(
      collectText(input.source, [
        "arcSummary",
        "chapterSummaries",
        "editorWishlist",
        "recentAcquisitions",
        "submissionGuidelines",
      ]),
      collectText(input.candidate, [
        "arcSummary",
        "chapterSummaries",
        "editorWishlist",
        "recentAcquisitions",
        "submissionGuidelines",
      ]),
    ) + seededJitter(input.rankSeed, "arc"),
  );

  const penalties = buildPenalties(input.source, input.candidate);
  const penaltyTotal = penalties.reduce(
    (total, penalty) => total + penaltyValue(penalty.severity),
    0,
  );
  const finalScore = boundedScore(
    premise * 0.42 + voice * 0.25 + arc * 0.33 - penaltyTotal,
  );

  return {
    axisBands: {
      premise: scoreBand(premise),
      voice: scoreBand(voice),
      arc: scoreBand(arc),
    },
    finalScore,
    scoreBand: scoreBand(finalScore),
    fitReasons: buildFitReasons(input.candidateKind, premise, voice, arc),
    riskReasons: penalties.map((penalty) => penalty.label).slice(0, 8),
    penalties,
    safeSnippets: buildSafeSnippets(input.source, input.candidate),
  };
}

export function isVisibleMatch(result: MatchScoringResult): boolean {
  return result.finalScore >= THRESHOLD_VISIBLE_SCORE;
}

export function compareScoredCandidates(
  left: { result: MatchScoringResult; stableId: string },
  right: { result: MatchScoringResult; stableId: string },
): number {
  if (right.result.finalScore !== left.result.finalScore) {
    return right.result.finalScore - left.result.finalScore;
  }
  return left.stableId.localeCompare(right.stableId);
}

function buildFitReasons(
  candidateKind: CandidateKind,
  premise: number,
  voice: number,
  arc: number,
): string[] {
  const reasons: string[] = [];
  if (premise >= 0.55) reasons.push("Premise and market signals overlap.");
  if (voice >= 0.55) {
    reasons.push("Voice and positioning signals are compatible.");
  }
  if (arc >= 0.55) reasons.push("Story arc and acquisition signals line up.");
  if (reasons.length === 0) {
    reasons.push(
      candidateKind === "publisher"
        ? "Publisher metadata has a limited but usable overlap."
        : "Manuscript metadata has a limited but usable overlap.",
    );
  }
  return reasons.slice(0, 8);
}

function buildPenalties(
  source: Record<string, unknown>,
  candidate: Record<string, unknown>,
): MatchPenalty[] {
  const penalties: MatchPenalty[] = [];
  if (
    !arraysOverlap(
      source,
      candidate,
      ["genre", "primaryGenre"],
      ["focusGenres", "acceptedPrimaryGenres", "genre"],
    )
  ) {
    penalties.push({
      code: "genre_gap",
      label: "Primary genre is not a direct declared overlap.",
      severity: "low",
    });
  }
  if (
    !arraysOverlap(
      source,
      candidate,
      ["audienceCategories"],
      ["acceptedAudienceCategories", "audienceCategories"],
    )
  ) {
    penalties.push({
      code: "audience_gap",
      label: "Audience category needs closer editorial review.",
      severity: "low",
    });
  }
  if (
    !arraysOverlap(
      source,
      candidate,
      ["manuscriptForm"],
      ["acceptedManuscriptForms", "manuscriptForm"],
    )
  ) {
    penalties.push({
      code: "form_gap",
      label: "Manuscript form is not explicitly listed as accepted.",
      severity: "medium",
    });
  }

  const sourceWarnings = normalizeTokens(source["declaredContentWarnings"]);
  const excluded = normalizeTokens(candidate["excludedTopics"]);
  if (sourceWarnings.some((warning) => excluded.includes(warning))) {
    penalties.push({
      code: "excluded_topic_overlap",
      label: "Declared content overlaps with an excluded topic.",
      severity: "high",
    });
  }
  return penalties.slice(0, 8);
}

function buildSafeSnippets(
  source: Record<string, unknown>,
  candidate: Record<string, unknown>,
): MatchSafeSnippet[] {
  const snippets = [
    snippet("Source", source["logline"] ?? source["submissionGuidelines"]),
    snippet(
      "Candidate",
      candidate["whatWeAreLookingFor"] ?? candidate["logline"],
    ),
    snippet("Arc", source["arcSummary"] ?? candidate["arcSummary"]),
  ].filter((item): item is MatchSafeSnippet => item !== null);
  return snippets.slice(0, 6);
}

function snippet(label: string, value: unknown): MatchSafeSnippet | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return { label, text: trimmed.slice(0, 360) };
}

function collectText(row: Record<string, unknown>, keys: string[]): string {
  return keys.flatMap((key) => normalizeTokens(row[key])).join(" ");
}

function overlapScore(left: string, right: string): number {
  const leftTokens = uniqueTokens(left);
  const rightTokens = uniqueTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0.4;
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return 0.45 + overlap / Math.max(leftTokens.length, rightTokens.length);
}

function arraysOverlap(
  source: Record<string, unknown>,
  candidate: Record<string, unknown>,
  sourceKeys: string[],
  candidateKeys: string[],
): boolean {
  const sourceTokens = sourceKeys.flatMap((key) =>
    normalizeTokens(source[key]),
  );
  const candidateTokens = candidateKeys.flatMap((key) =>
    normalizeTokens(candidate[key]),
  );
  if (sourceTokens.length === 0 || candidateTokens.length === 0) return true;
  const candidateSet = new Set(candidateTokens);
  return sourceTokens.some((token) => candidateSet.has(token));
}

function normalizeTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTokens(item));
  }
  if (typeof value === "number") {
    return [String(value)];
  }
  if (typeof value !== "string") {
    return [];
  }
  return uniqueTokens(value);
}

function uniqueTokens(value: string): string[] {
  const normalized = value
    .toLocaleLowerCase("tr")
    .split(/[^a-z0-9çğıöşü]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return [...new Set(normalized)];
}

function seededJitter(seed: string, axis: string): number {
  const hex = createHash("sha256")
    .update(`${seed}:${axis}`)
    .digest("hex")
    .slice(0, 4);
  return (Number.parseInt(hex, 16) / 0xffff) * 0.08;
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function scoreBand(score: number): MatchScoreBand {
  if (score >= 0.7) return "strong";
  if (score >= 0.5) return "moderate";
  return "weak";
}

function penaltyValue(severity: PenaltySeverity): number {
  if (severity === "high") return 0.2;
  if (severity === "medium") return 0.12;
  return 0.06;
}
