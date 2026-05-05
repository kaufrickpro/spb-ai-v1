import { ApiRoutes, CreateProfileRequestSchema } from "@marketplace/contracts";
import { getApiErrorCode, webApiClient } from "../api/client";
import {
  resolvePublicStaffAuthRoute,
  resolveAdminLandingRoute,
  resolveAuthenticatedLandingRoute,
} from "./entryRouting";
import { clearSignupDraft, loadSignupDraft } from "./authFlowStorage";

export async function resolvePostAuthRoute(input?: {
  allowAdminLanding?: boolean;
  onPublicStaffSession?: () => Promise<void> | void;
}) {
  const adminResponse = await webApiClient.request(ApiRoutes.admin.access);
  if (adminResponse.status !== "no_access") {
    clearSignupDraft();
    if (input?.allowAdminLanding) {
      return resolveAdminLandingRoute(adminResponse.status);
    }

    await input?.onPublicStaffSession?.();
    return resolvePublicStaffAuthRoute();
  }

  try {
    await webApiClient.request(ApiRoutes.profiles.me);
    clearSignupDraft();
    return resolveAuthenticatedLandingRoute({
      hasAdminAccess: false,
      hasProfile: true,
    });
  } catch (error) {
    if (getApiErrorCode(error) === "not_found") {
      const savedDraft =
        CreateProfileRequestSchema.safeParse(loadSignupDraft());

      if (savedDraft.success) {
        try {
          await webApiClient.request(ApiRoutes.profiles.create, {
            body: savedDraft.data,
          });
        } catch (profileError) {
          if (getApiErrorCode(profileError) !== "profile_already_exists") {
            throw profileError;
          }
        }

        clearSignupDraft();
        return resolveAuthenticatedLandingRoute({
          hasAdminAccess: false,
          hasProfile: true,
        });
      }

      return resolveAuthenticatedLandingRoute({
        hasAdminAccess: false,
        hasProfile: false,
      });
    }

    throw error;
  }
}
