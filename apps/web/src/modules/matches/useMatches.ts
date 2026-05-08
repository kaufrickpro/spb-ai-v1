import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiRoutes,
  type MatchRun,
  type MatchRunRequest,
} from "@marketplace/contracts";
import { webApiClient } from "../api/client";

type MatchRunListResponse = { runs: MatchRun[] };

export const matchKeys = {
  all: ["matches"] as const,
  list: () => [...matchKeys.all, "list"] as const,
  profileHistory: () => [...matchKeys.all, "profileHistory"] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
  candidate: (runId: string, candidateId: string) =>
    [...matchKeys.detail(runId), "candidate", candidateId] as const,
};

export function useMatchRuns() {
  return useQuery({
    queryKey: matchKeys.list(),
    queryFn: () => webApiClient.request(ApiRoutes.matches.list),
  });
}

export function useProfileHistory() {
  const routes = ApiRoutes.matches as typeof ApiRoutes.matches & {
    profileHistory?: typeof ApiRoutes.matches.list;
  };
  const route = routes.profileHistory ?? ApiRoutes.matches.list;

  return useQuery<MatchRunListResponse>({
    queryKey: matchKeys.profileHistory(),
    queryFn: () => webApiClient.request(route as typeof ApiRoutes.matches.list),
  });
}

export function useMatchRun(matchRunId: string) {
  return useQuery({
    queryKey: matchKeys.detail(matchRunId),
    queryFn: () =>
      webApiClient.request(ApiRoutes.matches.get, {
        params: { matchRunId },
      }),
    enabled: Boolean(matchRunId),
  });
}

export function useMatchCandidate(matchRunId: string, candidateId: string) {
  return useQuery({
    queryKey: matchKeys.candidate(matchRunId, candidateId),
    queryFn: () =>
      webApiClient.request(ApiRoutes.matches.candidate, {
        params: { matchRunId, candidateId },
      }),
    enabled: Boolean(matchRunId && candidateId),
  });
}

export function useRunMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MatchRunRequest) =>
      webApiClient.request(ApiRoutes.matches.run, { body }),
    onSuccess: (response) => {
      queryClient.setQueryData(matchKeys.detail(response.run.id), response);
      void queryClient.invalidateQueries({ queryKey: matchKeys.list() });
    },
  });
}
