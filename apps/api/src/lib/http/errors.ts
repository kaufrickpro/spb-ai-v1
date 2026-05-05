import type { FastifyReply } from "fastify";

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  });
}

export function sendUnauthorized(reply: FastifyReply) {
  return sendApiError(
    reply,
    401,
    "unauthorized",
    "Missing or invalid bearer token",
  );
}

export function sendForbidden(
  reply: FastifyReply,
  message = "Admin access is required",
  code = "forbidden",
) {
  return sendApiError(reply, 403, code, message);
}

export function sendNotFound(reply: FastifyReply, message: string) {
  return sendApiError(reply, 404, "not_found", message);
}

export function sendConflict(
  reply: FastifyReply,
  code: string,
  message: string,
) {
  return sendApiError(reply, 409, code, message);
}

export function sendValidationError(
  reply: FastifyReply,
  message: string,
  details?: unknown,
  code = "validation_error",
) {
  return sendApiError(reply, 400, code, message, details);
}

export function sendInternalServerError(reply: FastifyReply) {
  return sendApiError(reply, 500, "internal_error", "Internal Server Error");
}
