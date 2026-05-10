import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiRoutes,
  type CompleteOnboardingDetailsRequest,
  type MatchVisibleContactSettings,
} from "@marketplace/contracts";
import { webApiClient } from "../api/client";

export const profileSurfaceKeys = {
  all: ["profile-surfaces"] as const,
  publicPublishers: ["public-publishers"] as const,
  publisher: (id: string) =>
    ["profile-surfaces", "publisher-profile", id] as const,
  author: (id: string) => ["profile-surfaces", "author-profile", id] as const,
  manuscript: (id: string) =>
    ["profile-surfaces", "manuscript-profile", id] as const,
  accessRequests: ["profile-surfaces", "manuscript-access-requests"] as const,
};

export function usePublicPublishers() {
  return useQuery({
    queryKey: profileSurfaceKeys.publicPublishers,
    queryFn: () => webApiClient.request(ApiRoutes.profiles.publicPublishers),
  });
}

export function usePublisherProfile(publisherProfileId: string) {
  return useQuery({
    queryKey: profileSurfaceKeys.publisher(publisherProfileId),
    queryFn: () =>
      webApiClient.request(ApiRoutes.profiles.publisherProfile, {
        params: { publisherProfileId },
      }),
    enabled: Boolean(publisherProfileId),
  });
}

export function useAuthorProfile(authorProfileId: string) {
  return useQuery({
    queryKey: profileSurfaceKeys.author(authorProfileId),
    queryFn: () =>
      webApiClient.request(ApiRoutes.profiles.authorProfile, {
        params: { authorProfileId },
      }),
    enabled: Boolean(authorProfileId),
  });
}

export function useManuscriptProfile(manuscriptId: string) {
  return useQuery({
    queryKey: profileSurfaceKeys.manuscript(manuscriptId),
    queryFn: () =>
      webApiClient.request(ApiRoutes.manuscripts.profile, {
        params: { manuscriptId },
      }),
    enabled: Boolean(manuscriptId),
  });
}

export function useUpdateMatchVisibleContacts() {
  return useMutation({
    mutationFn: (body: MatchVisibleContactSettings) =>
      webApiClient.request(ApiRoutes.profiles.updateMatchVisibleContacts, {
        body,
      }),
  });
}

export function useCompleteOnboardingDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CompleteOnboardingDetailsRequest) =>
      webApiClient.request(ApiRoutes.profiles.completeDetails, {
        body,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profiles", "me"] });
    },
  });
}

export function useManuscriptAccessRequests() {
  return useQuery({
    queryKey: profileSurfaceKeys.accessRequests,
    queryFn: () =>
      webApiClient.request(ApiRoutes.manuscripts.listAccessRequests),
  });
}

export function useRequestManuscriptAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (manuscriptId: string) =>
      webApiClient.request(ApiRoutes.manuscripts.requestAccess, {
        params: { manuscriptId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: profileSurfaceKeys.accessRequests,
      });
    },
  });
}

export function useDecideManuscriptAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      decision,
    }: {
      requestId: string;
      decision: "approve" | "reject";
    }) =>
      webApiClient.request(
        decision === "approve"
          ? ApiRoutes.manuscripts.approveAccessRequest
          : ApiRoutes.manuscripts.rejectAccessRequest,
        { params: { requestId } },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: profileSurfaceKeys.accessRequests,
      });
    },
  });
}
