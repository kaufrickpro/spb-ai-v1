export class IntroRequestServiceError extends Error {
  constructor(
    readonly kind:
      | "not_found"
      | "forbidden"
      | "conflict"
      | "not_eligible"
      | "quota"
      | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
