import type { MatchCandidate } from "@marketplace/contracts";

const REDACTION_PATTERN = /redacted|masked|private|hidden/i;

export function visibleText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || REDACTION_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function visibleList(values: string[]): string[] {
  return values
    .map(visibleText)
    .filter((value): value is string => Boolean(value));
}

export function shouldShowExplanation(candidate: MatchCandidate): boolean {
  return (
    candidate.rank <= 10 &&
    candidate.explanationStatus === "generated" &&
    Boolean(visibleText(candidate.explanation))
  );
}
