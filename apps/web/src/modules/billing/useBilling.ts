import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiErrorSchema, ApiRoutes } from "@marketplace/contracts";
import type {
  BillingPlanSlug,
  EntitlementDenial,
} from "@marketplace/contracts";
import { webApiClient } from "../api/client";

export const billingKeys = {
  all: ["billing"] as const,
  subscription: () => [...billingKeys.all, "subscription"] as const,
  usage: () => [...billingKeys.all, "usage"] as const,
};

export function useBillingSubscription(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.subscription(),
    queryFn: () => webApiClient.request(ApiRoutes.billing.subscription),
    enabled: options.enabled ?? true,
  });
}

export function useBillingUsage(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingKeys.usage(),
    queryFn: () => webApiClient.request(ApiRoutes.billing.usage),
    enabled: options.enabled ?? true,
  });
}

export function useStartTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => webApiClient.request(ApiRoutes.billing.startTrial),
    onSuccess: (response) => {
      queryClient.setQueryData(billingKeys.subscription(), {
        subscription: response.subscription,
      });
      queryClient.setQueryData(billingKeys.usage(), { usage: response.usage });
      void queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}

export function usePaytrCheckoutToken() {
  return useMutation({
    mutationFn: (planSlug: BillingPlanSlug) =>
      webApiClient.request(ApiRoutes.billing.paytrCheckoutToken, {
        body: { planSlug },
      }),
  });
}

export function getEntitlementDenial(error: unknown): EntitlementDenial | null {
  const parsed = ApiErrorSchema.safeParse(error);
  if (!parsed.success || parsed.data.error.code !== "entitlement_denied") {
    return null;
  }
  const details = parsed.data.error
    .details as Partial<EntitlementDenial> | null;
  if (!details?.reason || !details.message) {
    return null;
  }
  return {
    reason: details.reason,
    recoveryAction: details.recoveryAction ?? null,
    message: details.message,
  } as EntitlementDenial;
}
