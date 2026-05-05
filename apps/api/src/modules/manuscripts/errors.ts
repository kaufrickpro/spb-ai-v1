export class ManuscriptServiceError extends Error {
  constructor(
    readonly kind: "not_found" | "conflict" | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
