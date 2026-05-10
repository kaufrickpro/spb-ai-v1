export class NotificationServiceError extends Error {
  constructor(
    readonly kind: "not_found" | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}
