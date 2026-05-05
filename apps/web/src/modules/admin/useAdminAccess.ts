import { useQuery } from "@tanstack/react-query";
import { ApiRoutes } from "@marketplace/contracts";
import { useAuth } from "../auth/AuthContext";
import { webApiClient } from "../api/client";

export function useAdminAccess() {
  const { session, loading } = useAuth();

  return useQuery({
    queryKey: ["admin", "access", session?.user.id],
    queryFn: () => webApiClient.request(ApiRoutes.admin.access),
    enabled: !loading && Boolean(session),
    retry: false,
    staleTime: 60_000,
  });
}
