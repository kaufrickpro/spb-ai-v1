import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRoutes, type NotificationListQuery } from "@marketplace/contracts";
import { webApiClient } from "../api/client";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (query: Partial<NotificationListQuery>) =>
    ["notifications", "list", query] as const,
};

export function useNotifications(
  query: Partial<NotificationListQuery> = {},
  options: { enabled?: boolean; refetchInterval?: number | false } = {},
) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () =>
      webApiClient.request(ApiRoutes.notifications.list, { query }),
    queryKey: notificationKeys.list(query),
    refetchInterval: options.refetchInterval,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      webApiClient.request(ApiRoutes.notifications.markRead, {
        params: { notificationId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => webApiClient.request(ApiRoutes.notifications.markAllRead),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function invalidateNotifications(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}
