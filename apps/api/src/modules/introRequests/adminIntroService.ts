import {
  AdminIntroRequestDetailResponseSchema,
  AdminIntroRequestListResponseSchema,
  type AdminIntroRequestListQuery,
} from "@marketplace/contracts";
import {
  filterAdminTestRequest,
  mapDbProductAuditEvent,
  toAdminSummary,
  toDbAdminSummary,
} from "./adminIntroReadModels.js";
import { IntroRequestServiceError } from "./errors.js";
import { createIntroDb } from "./repository.js";
import type { IntroRequestDeps } from "./types.js";

export async function listAdminIntroRequests(
  input: IntroRequestDeps & {
    query: AdminIntroRequestListQuery;
  },
) {
  if (input.config.authMode === "test") {
    const requests = input.introTestState.requests
      .filter((request) => filterAdminTestRequest(request, input.query))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, input.query.limit)
      .map((request) => toAdminSummary(input, request));
    return AdminIntroRequestListResponseSchema.parse({ requests });
  }

  const db = createIntroDb(input.config);
  let query = db
    .from("intro_requests")
    .select()
    .order("created_at", { ascending: false })
    .limit(input.query.limit);
  if (input.query.status !== "all")
    query = query.eq("status", input.query.status);
  if (input.query.manuscriptId)
    query = query.eq("manuscript_id", input.query.manuscriptId);
  if (input.query.authorProfileId)
    query = query.eq("author_profile_id", input.query.authorProfileId);
  if (input.query.publisherProfileId)
    query = query.eq("publisher_profile_id", input.query.publisherProfileId);
  if (input.query.createdFrom)
    query = query.gte("created_at", input.query.createdFrom);
  if (input.query.createdTo)
    query = query.lte("created_at", input.query.createdTo);
  const { data, error } = await query;
  if (error)
    throw new IntroRequestServiceError(
      "storage",
      "Failed to list admin intro requests",
      error,
    );
  const requests = [];
  for (const row of data ?? []) {
    const summary = await toDbAdminSummary(db, row as Record<string, unknown>);
    if (
      !input.query.requesterRole ||
      summary.requesterRole === input.query.requesterRole
    ) {
      requests.push(summary);
    }
  }
  return AdminIntroRequestListResponseSchema.parse({ requests });
}

export async function getAdminIntroRequestDetail(
  input: IntroRequestDeps & {
    requestId: string;
  },
) {
  if (input.config.authMode === "test") {
    const request = input.introTestState.requests.find(
      (item) => item.id === input.requestId,
    );
    if (!request) {
      throw new IntroRequestServiceError(
        "not_found",
        "Intro request not found",
      );
    }
    const timeline = input.introTestState.productAuditEvents.filter(
      (event) =>
        event.targetType === "intro_request" && event.targetId === request.id,
    );
    return AdminIntroRequestDetailResponseSchema.parse({
      request: toAdminSummary(input, request),
      timeline,
    });
  }

  const db = createIntroDb(input.config);
  const { data, error } = await db
    .from("intro_requests")
    .select()
    .eq("id", input.requestId)
    .maybeSingle();
  if (error || !data) {
    throw new IntroRequestServiceError(
      "not_found",
      "Intro request not found",
      error,
    );
  }
  const { data: events, error: eventsError } = await db
    .from("product_audit_events")
    .select()
    .eq("target_type", "intro_request")
    .eq("target_id", input.requestId)
    .order("created_at", { ascending: false });
  if (eventsError) {
    throw new IntroRequestServiceError(
      "storage",
      "Failed to load intro timeline",
      eventsError,
    );
  }
  return AdminIntroRequestDetailResponseSchema.parse({
    request: await toDbAdminSummary(db, data as Record<string, unknown>),
    timeline: (events ?? []).map(mapDbProductAuditEvent),
  });
}
