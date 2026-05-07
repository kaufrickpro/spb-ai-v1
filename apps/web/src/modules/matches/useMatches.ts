import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRoutes, type MatchRunRequest } from "@marketplace/contracts";
import { webApiClient } from "../api/client";

export const matchKeys = {
  all: ["matches"] as const,
  list: () => [...matchKeys.all, "list"] as const,
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
