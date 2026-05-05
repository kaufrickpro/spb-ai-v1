import { useQuery } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { getApiErrorCode, webApiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function useMarketplaceProfile(input?: { enabled?: boolean }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["profiles", "me", session?.user.id],
    queryFn: async () => {
      try {
        return await webApiClient.request(ApiRoutes.profiles.me);
      } catch (error) {
        if (getApiErrorCode(error) === "not_found") {
          return null;
        }

        throw error;
      }
    },
    enabled: (input?.enabled ?? true) && Boolean(session),
    retry: false,
  });
}
