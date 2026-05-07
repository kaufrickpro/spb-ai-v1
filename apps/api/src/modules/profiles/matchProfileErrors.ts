export class MatchProfileServiceError extends Error {
  constructor(
    readonly kind:
      | "forbidden"
      | "not_found"
      | "not_ready"
      | "role_mismatch"
      | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
