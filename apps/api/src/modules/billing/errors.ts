import type { EntitlementDenial } from "@marketplace/contracts";

export class BillingServiceError extends Error {
  constructor(
    readonly kind:
      | "forbidden"
      | "not_found"
      | "not_ready"
      | "entitlement_denied"
      | "storage",
    message: string,
    readonly details?: EntitlementDenial,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
