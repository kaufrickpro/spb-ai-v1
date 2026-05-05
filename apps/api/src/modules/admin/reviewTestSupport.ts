import type {
  AdminAuditLog,
  AdminReviewDecisionRequest,
  AdminReviewDecisionResponse,
} from "@marketplace/contracts";
import { TEST_USER_ID } from "../auth/requestAuth.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import {
  getAnyTestDocument,
  getTestManuscript,
  setTestDocumentReviewStatus,
  setTestManuscriptReviewStatus,
} from "../manuscripts/testState.js";
import type { AdminTestState } from "./testState.js";

export function buildReviewDecisionAuditLog(input: {
  actorUserId: string;
  auditLogId: string;
  decision: AdminReviewDecisionRequest;
  now: string;
  review: AdminReviewDecisionResponse["review"];
  reviewId: string;
}): AdminAuditLog {
  return {
    id: input.auditLogId,
    actorUserId: input.actorUserId,
    action:
      input.decision.decision === "approved"
        ? "review.approved"
        : input.decision.decision === "quarantined"
          ? "review.quarantined"
          : input.decision.decision === "restored"
            ? "review.restored"
            : input.decision.decision === "suspended"
              ? "review.suspended"
              : "review.rejected",
    targetType: input.review.entityType,
    targetId: input.review.entityId,
    metadata: {
      internalNote:
        input.decision.internalNote ?? input.decision.rejectionNote ?? null,
      reviewId: input.reviewId,
    },
    createdAt: input.now,
  };
}

export function updateTestReviewedEntityLifecycle(
  manuscriptState: ManuscriptTestState,
  review: AdminReviewDecisionResponse["review"],
  input: { decision: AdminReviewDecisionRequest["decision"]; now: string },
): void {
  const reviewStatus = input.decision === "approved" ? "approved" : "rejected";
  if (review.entityType === "manuscript") {
    setTestManuscriptReviewStatus(
      manuscriptState,
      review.entityId,
      reviewStatus,
      input.now,
    );
    return;
  }

  if (review.entityType === "document") {
    setTestDocumentReviewStatus(
      manuscriptState,
      review.entityId,
      reviewStatus,
      input.now,
    );
  }
}

export function getTestAdminReviewDetail(
  state: AdminTestState,
  manuscriptState: ManuscriptTestState,
  reviewId: string,
) {
  const review = state.reviews.find((item) => item.id === reviewId);
  if (!review) {
    return null;
  }

  const manuscript = getTestManuscript(
    manuscriptState,
    review.entityId,
    TEST_USER_ID,
  );
  const document = getAnyTestDocument(manuscriptState, review.entityId);

  return {
    review,
    submittedFields: buildTestReviewSubmittedFields({
      document,
      manuscript,
      entityType: review.entityType,
    }),
    riskWarnings: ["Manual identity check is pending"],
    relatedEvents: buildTestReviewRelatedEvents(review.entityType, document),
    auditHistory: state.auditLogs.filter(
      (entry) =>
        entry.targetType === review.entityType &&
        entry.targetId === review.entityId,
    ),
    decisionNotesRequired: true,
  };
}

function buildTestReviewSubmittedFields(input: {
  document: ReturnType<typeof getAnyTestDocument>;
  entityType: string;
  manuscript: ReturnType<typeof getTestManuscript>;
}) {
  if (input.entityType === "manuscript" && input.manuscript) {
    return {
      title: input.manuscript.title,
      genre: input.manuscript.genre,
      language: input.manuscript.language,
      synopsis: input.manuscript.synopsis,
      wordCount: input.manuscript.wordCount,
    };
  }

  if (input.entityType === "document" && input.document) {
    return {
      originalFileName: input.document.originalFileName,
      mimeType: input.document.mimeType,
      fileSizeBytes: input.document.fileSizeBytes,
      storageStatus: input.document.storageStatus,
      processingStatus: input.document.processingStatus,
    };
  }

  return { displayName: "Test Author" };
}

function buildTestReviewRelatedEvents(
  entityType: string,
  document: ReturnType<typeof getAnyTestDocument>,
) {
  const defaultCreatedAt = new Date("2026-05-01T08:00:00.000Z").toISOString();

  if (entityType !== "document") {
    return [{ label: "Profile created", createdAt: defaultCreatedAt }];
  }

  const createdAt = document?.updatedAt ?? defaultCreatedAt;
  return [
    { label: "Upload completed", createdAt },
    { label: "Processing pending", createdAt },
  ];
}
