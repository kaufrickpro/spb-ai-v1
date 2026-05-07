import { randomUUID, createHash } from "node:crypto";
import type {
  MatchCandidate,
  MatchDirection,
  MatchRun,
} from "@marketplace/contracts";

export type MatchingTestState = {
  runs: MatchRun[];
  candidates: MatchCandidate[];
};

export function createMatchingTestState(): MatchingTestState {
  return { runs: [], candidates: [] };
}

export function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 32);
}

export function createTestMatchRun(input: {
  candidateCount: number;
  direction: MatchDirection;
  requesterProfileId: string;
  sourceManuscriptId: string | null;
  sourcePublisherProfileId: string | null;
  sourceTitle: string;
  stale: boolean;
  status?: MatchRun["status"];
}): MatchRun {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    direction: input.direction,
    requesterProfileId: input.requesterProfileId,
    sourceManuscriptId: input.sourceManuscriptId,
    sourcePublisherProfileId: input.sourcePublisherProfileId,
    status: input.status ?? "succeeded",
    stale: input.stale,
    candidateCount: input.candidateCount,
    failureCode: null,
    inputFingerprint: fingerprint(input),
    sourceTitle: input.sourceTitle,
    createdAt: now,
    updatedAt: now,
  };
}
