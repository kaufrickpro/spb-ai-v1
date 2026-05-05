import {
  CompleteOnboardingDetailsRequestSchema,
  CreateProfileRequestSchema,
  OnboardingDetailsResponseSchema,
  ProfileResponseSchema,
} from "@marketplace/contracts";
import type { FastifyInstance } from "fastify";
import {
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendConflict,
  sendInternalServerError,
  sendNotFound,
} from "../../lib/http/errors.js";
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
  testState?: ProfileTestState,
) {
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
}
