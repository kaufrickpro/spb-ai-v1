export class MatchingServiceError extends Error {
  constructor(
    readonly kind:
      | "forbidden"
      | "not_found"
      | "not_ready"
      | "rate_limited"
      | "storage"
      | "ai_failed",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
