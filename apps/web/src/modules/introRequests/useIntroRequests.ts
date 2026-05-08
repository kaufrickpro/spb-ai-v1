import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiRoutes,
  type CreateIntroRequestRequest,
  type RejectIntroRequestRequest,
} from "@marketplace/contracts";
import { webApiClient } from "../api/client";
import { matchKeys } from "../matches/useMatches";
import { profileSurfaceKeys } from "../profiles/useProfileSurfaces";

export const introRequestKeys = {
  all: ["intro-requests"] as const,
  list: () => [...introRequestKeys.all, "list"] as const,
  adminList: () => ["admin", "intro-requests"] as const,
  adminDetail: (requestId: string | null) =>
    ["admin", "intro-requests", requestId] as const,
};

function invalidateIntroSurfaces(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: introRequestKeys.all });
  void queryClient.invalidateQueries({ queryKey: matchKeys.all });
  void queryClient.invalidateQueries({ queryKey: profileSurfaceKeys.all });
}

export function useIntroRequests() {
  return useQuery({
    queryKey: introRequestKeys.list(),
    queryFn: () => webApiClient.request(ApiRoutes.introRequests.list),
  });
}

export function useCreateIntroRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIntroRequestRequest) =>
      webApiClient.request(ApiRoutes.introRequests.create, { body }),
    onSuccess: () => invalidateIntroSurfaces(queryClient),
  });
}

export function useTransitionIntroRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      note,
      requestId,
    }: {
      action: "accept" | "reject" | "cancel";
      note?: string | null;
      requestId: string;
    }) => {
      if (action === "accept") {
        return webApiClient.request(ApiRoutes.introRequests.accept, {
          params: { requestId },
        });
      }
      if (action === "cancel") {
        return webApiClient.request(ApiRoutes.introRequests.cancel, {
          params: { requestId },
        });
      }
      const body: RejectIntroRequestRequest = { note: note ?? null };
      return webApiClient.request(ApiRoutes.introRequests.reject, {
        body,
        params: { requestId },
      });
    },
    onSuccess: () => invalidateIntroSurfaces(queryClient),
  });
}

export function useAdminIntroRequests() {
  return useQuery({
    queryKey: introRequestKeys.adminList(),
    queryFn: () => webApiClient.request(ApiRoutes.admin.introRequests),
    retry: false,
  });
}

export function useAdminIntroRequestDetail(requestId: string | null) {
  return useQuery({
    enabled: Boolean(requestId),
    queryKey: introRequestKeys.adminDetail(requestId),
    queryFn: () =>
      webApiClient.request(ApiRoutes.admin.introRequestDetail, {
        params: { requestId: requestId! },
      }),
    retry: false,
  });
}
