import {
  CompleteOnboardingDetailsRequestSchema,
  CreateProfileRequestSchema,
  AuthorProfilePageResponseSchema,
  MatchVisibleContactSettingsResponseSchema,
  OnboardingDetailsResponseSchema,
  ProfileResponseSchema,
  PublisherProfilePageResponseSchema,
  PublicPublisherDirectoryResponseSchema,
  UpdateMatchVisibleContactSettingsRequestSchema,
} from "@marketplace/contracts";
import type { FastifyInstance } from "fastify";
import {
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendConflict,
  sendForbidden,
  sendInternalServerError,
  sendNotFound,
} from "../../lib/http/errors.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import {
  getAuthorProfilePage,
  getPublisherProfilePage,
  listPublicPublishers,
  MatchProfileServiceError,
  updateOwnMatchVisibleContacts,
} from "./matchProfileService.js";
import {
  completeMarketplaceOnboardingDetails,
  createMarketplaceProfile,
  getOwnMarketplaceProfile,
  ProfileOnboardingError,
} from "./service.js";
import type { ProfileTestState } from "./testState.js";

export function registerProfileRoutes(
  app: FastifyInstance,
  auth: AuthDependencies,
  testState: ProfileTestState,
  manuscriptTestState?: ManuscriptTestState,
) {
  app.get("/api/v1/public/publishers", async (_request, reply) => {
    try {
      const response = await listPublicPublishers({
        config: auth.config,
        testState,
      });
      return reply.send(PublicPublisherDirectoryResponseSchema.parse(response));
    } catch (error) {
      app.log.error(error, "Failed to fetch public publisher directory");
      return sendInternalServerError(reply);
    }
  });

  app.post("/api/v1/profiles", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) {
      return;
    }

    const input = CreateProfileRequestSchema.parse(request.body);

    try {
      const response = await createMarketplaceProfile({
        config: auth.config,
        profile: input,
        testState,
        user,
      });

      return reply.code(201).send(ProfileResponseSchema.parse(response));
    } catch (error) {
      if (error instanceof ProfileOnboardingError) {
        if (error.kind === "admin_account") {
          return sendConflict(
            reply,
            "admin_account_cannot_create_profile",
            error.message,
          );
        }
        if (error.kind === "duplicate") {
          return sendConflict(reply, "profile_already_exists", error.message);
        }
      }

      app.log.error(error, "Failed to create marketplace profile");
      return sendInternalServerError(reply);
    }
  });

  app.get("/api/v1/profiles/me", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) {
      return;
    }

    try {
      const response = await getOwnMarketplaceProfile({
        config: auth.config,
        testState,
        user,
      });
      return reply.send(ProfileResponseSchema.parse(response));
    } catch (error) {
      if (
        error instanceof ProfileOnboardingError &&
        error.kind === "not_found"
      ) {
        return sendNotFound(reply, error.message);
      }

      app.log.error(error, "Failed to fetch marketplace profile");
      return sendInternalServerError(reply);
    }
  });

  app.post("/api/v1/profiles/me/onboarding-details", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) {
      return;
    }

    const input = CompleteOnboardingDetailsRequestSchema.parse(request.body);

    try {
      const response = await completeMarketplaceOnboardingDetails({
        config: auth.config,
        details: input,
        testState,
        user,
      });

      return reply.send(OnboardingDetailsResponseSchema.parse(response));
    } catch (error) {
      if (error instanceof ProfileOnboardingError) {
        if (error.kind === "not_found") {
          return sendNotFound(reply, error.message);
        }

        if (error.kind === "role_mismatch") {
          return sendConflict(reply, "profile_role_mismatch", error.message);
        }
      }

      app.log.error(error, "Failed to complete marketplace onboarding");
      return sendInternalServerError(reply);
    }
  });

  app.put(
    "/api/v1/profiles/me/match-visible-contacts",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) {
        return;
      }

      const input = UpdateMatchVisibleContactSettingsRequestSchema.parse(
        request.body,
      );

      try {
        const response = await updateOwnMatchVisibleContacts({
          config: auth.config,
          settings: input,
          testState,
          user,
        });
        return reply.send(
          MatchVisibleContactSettingsResponseSchema.parse(response),
        );
      } catch (error) {
        if (
          error instanceof MatchProfileServiceError &&
          error.kind === "not_found"
        ) {
          return sendNotFound(reply, error.message);
        }

        app.log.error(error, "Failed to update match-visible contacts");
        return sendInternalServerError(reply);
      }
    },
  );

  app.get(
    "/api/v1/profiles/publishers/:publisherProfileId",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) {
        return;
      }

      const publisherProfileId = parseUuidParam(
        request.params,
        "publisherProfileId",
      );
      if (!publisherProfileId) {
        return sendNotFound(reply, "Publisher profile not found");
      }

      try {
        const response = await getPublisherProfilePage({
          config: auth.config,
          publisherProfileId,
          testState,
          user,
        });
        return reply.send(PublisherProfilePageResponseSchema.parse(response));
      } catch (error) {
        if (
          error instanceof MatchProfileServiceError &&
          error.kind === "not_found"
        ) {
          return sendNotFound(reply, error.message);
        }
        if (
          error instanceof MatchProfileServiceError &&
          error.kind === "forbidden"
        ) {
          return sendForbidden(reply, error.message);
        }

        app.log.error(error, "Failed to fetch publisher profile page");
        return sendInternalServerError(reply);
      }
    },
  );

  app.get(
    "/api/v1/profiles/authors/:authorProfileId",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) {
        return;
      }

      const authorProfileId = parseUuidParam(request.params, "authorProfileId");
      if (!authorProfileId || !manuscriptTestState) {
        return sendNotFound(reply, "Author profile not found");
      }

      try {
        const response = await getAuthorProfilePage({
          authorProfileId,
          config: auth.config,
          manuscriptTestState,
          testState,
          user,
        });
        return reply.send(AuthorProfilePageResponseSchema.parse(response));
      } catch (error) {
        if (
          error instanceof MatchProfileServiceError &&
          error.kind === "not_found"
        ) {
          return sendNotFound(reply, error.message);
        }

        app.log.error(error, "Failed to fetch author profile page");
        return sendInternalServerError(reply);
      }
    },
  );
}

function parseUuidParam(params: unknown, key: string): string | null {
  const value = (params as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
