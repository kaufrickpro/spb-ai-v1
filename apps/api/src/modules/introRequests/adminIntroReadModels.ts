import {
  ProductAuditEventSchema,
  type AdminIntroRequestListQuery,
  type IntroRequest,
} from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isDbPairCurrentlyEligible,
  isTestPairCurrentlyEligible,
} from "./acceptedIntroAccess.js";
import { mapDbIntroRequest } from "./introReadModels.js";
import type { IntroRequestDeps } from "./types.js";

export function toAdminSummary(input: IntroRequestDeps, request: IntroRequest) {
  return {
    id: request.id,
    manuscriptId: request.manuscriptId,
    manuscriptTitle: request.manuscriptTitle,
    authorProfileId: request.authorProfileId,
    authorName: request.authorName,
    publisherProfileId: request.publisherProfileId,
    publisherName: request.publisherName,
    requesterProfileId: request.requesterProfileId,
    requesterRole:
      request.requesterProfileId === request.authorProfileId
        ? ("author" as const)
        : ("publisher" as const),
    recipientProfileId: request.recipientProfileId,
    status: request.status,
    currentUnlockStatus: {
      contact:
        request.status === "accepted" &&
        isTestPairCurrentlyEligible(input, request),
      publisherSample:
        request.status === "accepted" &&
        isTestPairCurrentlyEligible(input, request),
    },
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    respondedAt: request.respondedAt,
  };
}

export async function toDbAdminSummary(
  db: SupabaseClient,
  row: Record<string, unknown>,
) {
  const request = await mapDbIntroRequest(
    db,
    row,
    String(row.requester_profile_id),
  );
  const eligible = await isDbPairCurrentlyEligible(db, row);
  return {
    id: request.id,
    manuscriptId: request.manuscriptId,
    manuscriptTitle: request.manuscriptTitle,
    authorProfileId: request.authorProfileId,
    authorName: request.authorName,
    publisherProfileId: request.publisherProfileId,
    publisherName: request.publisherName,
    requesterProfileId: request.requesterProfileId,
    requesterRole:
      request.requesterProfileId === request.authorProfileId
        ? ("author" as const)
        : ("publisher" as const),
    recipientProfileId: request.recipientProfileId,
    status: request.status,
    currentUnlockStatus: {
      contact: request.status === "accepted" && eligible,
      publisherSample: request.status === "accepted" && eligible,
    },
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    respondedAt: request.respondedAt,
  };
}

export function filterAdminTestRequest(
  request: IntroRequest,
  query: AdminIntroRequestListQuery,
) {
  if (query.status !== "all" && request.status !== query.status) return false;
  if (query.manuscriptId && request.manuscriptId !== query.manuscriptId)
    return false;
  if (
    query.authorProfileId &&
    request.authorProfileId !== query.authorProfileId
  )
    return false;
  if (
    query.publisherProfileId &&
    request.publisherProfileId !== query.publisherProfileId
  )
    return false;
  if (query.createdFrom && request.createdAt < query.createdFrom) return false;
  if (query.createdTo && request.createdAt > query.createdTo) return false;
  if (query.requesterRole) {
    const role =
      request.requesterProfileId === request.authorProfileId
        ? "author"
        : "publisher";
    if (role !== query.requesterRole) return false;
  }
  return true;
}

export function mapDbProductAuditEvent(row: Record<string, unknown>) {
  return ProductAuditEventSchema.parse({
    id: row.id,
    actorProfileId: row.actor_profile_id ?? null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  });
}
