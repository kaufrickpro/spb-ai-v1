export class ManuscriptProfileAccessError extends Error {
  constructor(
    readonly kind:
      | "conflict"
      | "forbidden"
      | "not_found"
      | "not_requestable"
      | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
