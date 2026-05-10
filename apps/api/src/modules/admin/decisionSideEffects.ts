import type { FastifyInstance } from "fastify";
import type { AuthDependencies } from "../auth/requestAuth.js";
import { enqueueProductEmail } from "../email/outboxService.js";
import type { EmailTestState } from "../email/testState.js";
import { pushIntroNotification } from "../introRequests/testState.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";

export async function enqueueDecisionSideEffects(
  app: FastifyInstance,
  input: {
    auth: AuthDependencies;
    emailTestState: EmailTestState;
    introTestState: IntroRequestTestState;
    manuscriptTestState: ManuscriptTestState;
    profileTestState: ProfileTestState;
    response: {
      review: {
        entityId: string;
        entityType: string;
        status: string;
        summary?: string;
      };
    };
  },
) {
  if (input.auth.config.authMode !== "test") return;

  const target = resolveDecisionRecipient(input);
  const notificationType = buildDecisionNotificationType(
    input.response.review.entityType,
    input.response.review.status,
  );
  if (!target || !notificationType) return;

  try {
    pushIntroNotification(input.introTestState, {
      actorProfileId: null,
      metadata: {
        decision_label: input.response.review.summary ?? "Review decision",
      },
      notificationType,
      recipientProfileId: target.recipientProfileId,
      targetId: input.response.review.entityId,
      targetType:
        input.response.review.entityType === "profile"
          ? "profile"
          : "manuscript",
    });
    await enqueueProductEmail({
      config: input.auth.config,
      email: {
        ctaPath:
          input.response.review.entityType === "profile"
            ? "/app/profile"
            : `/app/manuscripts/${input.response.review.entityId}`,
        idempotencyKey: `decision:${input.response.review.entityType}:${input.response.review.entityId}:${notificationType}`,
        recipientProfileId: target.recipientProfileId,
        targetLabel: input.response.review.summary ?? "Review decision",
        templateKey: notificationType,
      },
      emailTestState: input.emailTestState,
    });
  } catch (error) {
    app.log.warn(error, "Failed to enqueue decision notification/email");
  }
}

function resolveDecisionRecipient(input: {
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  response: { review: { entityId: string; entityType: string } };
}): { recipientProfileId: string } | null {
  if (input.response.review.entityType === "profile") {
    return { recipientProfileId: input.response.review.entityId };
  }
  if (input.response.review.entityType !== "manuscript") {
    return null;
  }
  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === input.response.review.entityId,
  ) as { authorId?: string } | undefined;
  const profile = manuscript?.authorId
    ? input.profileTestState.profilesByUserId.get(manuscript.authorId)
    : null;
  return profile ? { recipientProfileId: profile.profile.id } : null;
}

function buildDecisionNotificationType(entityType: string, status: string) {
  if (entityType !== "profile" && entityType !== "manuscript") return null;
  if (status === "approved") return `${entityType}_approved` as const;
  if (status === "rejected") return `${entityType}_rejected` as const;
  if (status === "quarantined") return `${entityType}_quarantined` as const;
  return null;
}
