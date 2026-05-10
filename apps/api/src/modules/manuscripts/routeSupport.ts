import type { FastifyInstance, FastifyReply } from "fastify";
import {
  sendConflict,
  sendForbidden,
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import { BillingServiceError } from "../billing/errors.js";
import { sendBillingError } from "../billing/registerBillingRoutes.js";
import { ManuscriptServiceError } from "./service.js";
import { ManuscriptProfileAccessError } from "./profileAccessService.js";
import { SUPPORTED_SAMPLE_MIME_TYPES } from "./uploadUrls.js";

export function escapeContentDispositionFilename(fileName: string): string {
  return fileName.replace(/["\\]/g, "_");
}

export function normalizeDownloadDocument(document: Record<string, unknown>) {
  return {
    id: String(document["id"]),
    authorId: String(document["authorId"] ?? document["author_id"]),
    originalFileName: String(
      document["originalFileName"] ?? document["original_file_name"],
    ),
    mimeType: String(document["mimeType"] ?? document["mime_type"]),
    uploadId: String(document["uploadId"] ?? document["upload_id"]),
  };
}

export function registerSampleContentTypeParsers(app: FastifyInstance): void {
  for (const mimeType of SUPPORTED_SAMPLE_MIME_TYPES) {
    try {
      app.addContentTypeParser(
        mimeType,
        { parseAs: "buffer" },
        (_request, payload, done) => done(null, payload),
      );
    } catch {
      // Fastify may already know the parser in repeated test app setups.
    }
  }
}

export function getBaseContentType(contentType: unknown): string | null {
  if (typeof contentType !== "string") {
    return null;
  }

  return contentType.split(";")[0]?.trim().toLowerCase() || null;
}

export function sendManuscriptServiceError(
  app: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof ManuscriptServiceError) {
    if (error.kind === "not_found") {
      return sendNotFound(reply, error.message);
    }
    if (error.kind === "conflict") {
      return sendConflict(reply, "stale_upload_completion", error.message);
    }

    app.log.error(error.source ?? error, error.message);
    return sendInternalServerError(reply);
  }
  if (error instanceof BillingServiceError) {
    return sendBillingError(app, reply, error);
  }

  app.log.error(error, "Failed to handle manuscript request");
  return sendInternalServerError(reply);
}

export function sendManuscriptProfileAccessError(
  app: FastifyInstance,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof ManuscriptProfileAccessError) {
    if (error.kind === "not_found") {
      return sendNotFound(reply, error.message);
    }
    if (error.kind === "forbidden") {
      return sendForbidden(reply, error.message);
    }
    if (error.kind === "conflict") {
      return sendConflict(reply, "manuscript_access_conflict", error.message);
    }
    if (error.kind === "not_requestable") {
      return sendValidationError(reply, error.message, [], "not_requestable");
    }
  }

  app.log.error(error, "Failed to handle manuscript profile access request");
  return sendInternalServerError(reply);
}

export function parseUuidParam(
  params: unknown,
  key: string,
  reply: FastifyReply,
): string | null {
  const raw = (params as Record<string, unknown>)[key];
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) {
    sendValidationError(reply, `Invalid ${key}`, []);
    return null;
  }
  return raw;
}

export function readRequestBodyBuffer(request: { body?: unknown }): Buffer {
  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === "string") {
    return Buffer.from(request.body);
  }

  return Buffer.alloc(0);
}
