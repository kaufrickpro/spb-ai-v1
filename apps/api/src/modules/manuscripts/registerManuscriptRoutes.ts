import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CompleteUploadResponseSchema,
  CreateManuscriptRequestSchema,
  DocumentDownloadUrlResponseSchema,
  DocumentResponseSchema,
  MAX_FILE_SIZE_BYTES,
  ManuscriptListResponseSchema,
  ManuscriptResponseSchema,
  UpdateManuscriptRequestSchema,
  UploadSignedUrlRequestSchema,
  UploadSignedUrlResponseSchema,
} from "@marketplace/contracts";
import {
  requireAuthenticatedUser,
  type AuthDependencies,
} from "../auth/requestAuth.js";
import {
  sendConflict,
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { AdminTestState } from "../admin/testState.js";
import { readLocalUpload, saveLocalUpload } from "../storage/localStorage.js";
import {
  verifyLocalDownloadToken,
  verifyLocalUploadToken,
} from "../storage/localTokens.js";
import { requireAuthorRequest } from "./access.js";
import {
  assertAuthorCanDownloadDocument,
  completeAuthorDocumentUpload,
  createAuthorDocumentUpload,
  createAuthorManuscript,
  getAuthorDocument,
  getAuthorManuscript,
  getStoredDocumentRecord,
  listAuthorManuscripts,
  ManuscriptServiceError,
  updateAuthorManuscript,
} from "./service.js";
import type { ManuscriptTestState } from "./testState.js";
import {
  buildDownloadUrlResponse,
  buildUploadUrlResponse,
  SUPPORTED_SAMPLE_MIME_TYPES,
} from "./uploadUrls.js";

type RegisterManuscriptRoutesOptions = {
  adminTestState: AdminTestState;
  auth: AuthDependencies;
  testState: ManuscriptTestState;
};

export function registerManuscriptRoutes(
  app: FastifyInstance,
  { adminTestState, auth, testState }: RegisterManuscriptRoutesOptions,
) {
  registerSampleContentTypeParsers(app);

  app.get("/api/v1/manuscripts", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can access manuscripts",
    );
    if (!context) return;

    try {
      const manuscripts = await listAuthorManuscripts(
        context,
        testState,
        user.userId,
      );
      return reply.send(ManuscriptListResponseSchema.parse({ manuscripts }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.post("/api/v1/manuscripts", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const input = CreateManuscriptRequestSchema.parse(request.body);
    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can create manuscripts",
    );
    if (!context) return;

    try {
      const manuscript = await createAuthorManuscript(context, {
        adminTestState,
        authorId: user.userId,
        request: input,
        testState,
      });
      return reply
        .code(201)
        .send(ManuscriptResponseSchema.parse({ manuscript }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.get("/api/v1/manuscripts/:id", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const manuscriptId = parseUuidParam(request.params, "id", reply);
    if (!manuscriptId) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can access manuscripts",
    );
    if (!context) return;

    try {
      const manuscript = await getAuthorManuscript(context, testState, {
        authorId: user.userId,
        manuscriptId,
      });
      return reply.send(ManuscriptResponseSchema.parse({ manuscript }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.patch("/api/v1/manuscripts/:id", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const manuscriptId = parseUuidParam(request.params, "id", reply);
    if (!manuscriptId) return;

    const input = UpdateManuscriptRequestSchema.parse(request.body);
    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can update manuscripts",
    );
    if (!context) return;

    try {
      const manuscript = await updateAuthorManuscript(context, testState, {
        authorId: user.userId,
        manuscriptId,
        request: input,
      });
      return reply.send(ManuscriptResponseSchema.parse({ manuscript }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.post("/api/v1/uploads/signed-url", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const input = UploadSignedUrlRequestSchema.safeParse(request.body);
    if (!input.success) {
      return sendValidationError(
        reply,
        "Invalid upload request",
        input.error.issues,
      );
    }

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can upload manuscript samples",
    );
    if (!context) return;

    try {
      const { documentId, uploadId } = await createAuthorDocumentUpload(
        context,
        testState,
        { ...input.data, authorId: user.userId },
      );
      return reply
        .code(201)
        .send(
          UploadSignedUrlResponseSchema.parse(
            buildUploadUrlResponse(auth, documentId, uploadId, user.userId),
          ),
        );
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.put(
    "/api/v1/uploads/local/:uploadToken",
    { config: { rawBody: true } },
    async (request, reply) => {
      const uploadToken =
        (request.params as { uploadToken?: string }).uploadToken ?? "";
      const tokenData = verifyLocalUploadToken(uploadToken);

      if (!tokenData) {
        return sendValidationError(
          reply,
          "Upload token is invalid or expired",
          [],
          "upload_token_invalid",
        );
      }

      const document = await getStoredDocumentRecord(
        auth,
        testState,
        tokenData.documentId,
      );

      if (
        !document ||
        document.uploadId !== tokenData.uploadId ||
        document.authorId !== tokenData.authorId
      ) {
        return sendValidationError(
          reply,
          "Upload token does not match an active document upload",
          [],
          "upload_token_invalid",
        );
      }

      if (document.storageStatus !== "pending_upload") {
        return sendValidationError(
          reply,
          "Upload token does not match an active pending upload",
          [],
          "upload_not_pending",
        );
      }

      const requestContentType = getBaseContentType(
        request.headers["content-type"],
      );
      if (requestContentType !== document.mimeType) {
        return sendValidationError(
          reply,
          "Upload content type does not match the declared file type",
          [],
          "upload_content_type_mismatch",
        );
      }

      const bytes = readRequestBodyBuffer(request);
      if (
        bytes.length !== document.fileSizeBytes ||
        bytes.length > MAX_FILE_SIZE_BYTES
      ) {
        return sendValidationError(
          reply,
          "Upload size does not match the declared file size",
          [],
          "upload_size_mismatch",
        );
      }

      await saveLocalUpload({
        documentId: document.id,
        fileName: document.originalFileName,
        uploadId: document.uploadId,
        bytes,
      });

      return reply.send({ ok: true as const });
    },
  );

  app.post("/api/v1/documents/:id/complete-upload", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const documentId = parseUuidParam(request.params, "id", reply);
    if (!documentId) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can complete uploads",
    );
    if (!context) return;

    try {
      const document = await completeAuthorDocumentUpload(context, {
        adminTestState,
        authorId: user.userId,
        documentId,
        testState,
      });
      return reply.send(CompleteUploadResponseSchema.parse({ document }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.get("/api/v1/documents/:id/download-url", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const documentId = parseUuidParam(request.params, "id", reply);
    if (!documentId) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can access document downloads",
    );
    if (!context) return;

    try {
      await assertAuthorCanDownloadDocument(context, testState, {
        authorId: user.userId,
        documentId,
      });
      return reply.send(
        DocumentDownloadUrlResponseSchema.parse(
          buildDownloadUrlResponse(auth, documentId, user.userId, "author"),
        ),
      );
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.get("/api/v1/documents/:id", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    const documentId = parseUuidParam(request.params, "id", reply);
    if (!documentId) return;

    const context = await requireAuthorRequest(
      auth,
      user,
      reply,
      "Only authors can access documents",
    );
    if (!context) return;

    try {
      const document = await getAuthorDocument(context, testState, {
        authorId: user.userId,
        documentId,
      });
      return reply.send(DocumentResponseSchema.parse({ document }));
    } catch (error) {
      return sendManuscriptServiceError(app, reply, error);
    }
  });

  app.get(
    "/api/v1/documents/local-download/:downloadToken",
    async (request, reply) => {
      const downloadToken =
        (request.params as { downloadToken?: string }).downloadToken ?? "";
      const tokenData = verifyLocalDownloadToken(downloadToken);

      if (!tokenData) {
        return sendValidationError(
          reply,
          "Download token is invalid or expired",
          [],
          "download_token_invalid",
        );
      }

      const document = await getStoredDocumentRecord(
        auth,
        testState,
        tokenData.documentId,
      );
      if (!document) {
        return sendValidationError(
          reply,
          "Download token does not match a stored document",
          [],
          "download_token_invalid",
        );
      }

      if (
        tokenData.accessType === "author" &&
        tokenData.authorId !== document.authorId
      ) {
        return sendValidationError(
          reply,
          "Download token does not match the document owner",
          [],
          "download_token_invalid",
        );
      }

      const bytes = await readLocalUpload({
        documentId: document.id,
        fileName: document.originalFileName,
        uploadId: document.uploadId,
      });

      if (!bytes) {
        return sendNotFound(reply, "Document file not found");
      }

      reply.header("content-type", document.mimeType);
      reply.header(
        "content-disposition",
        `attachment; filename="${escapeContentDispositionFilename(
          document.originalFileName,
        )}"`,
      );
      return reply.send(bytes);
    },
  );
}

function escapeContentDispositionFilename(fileName: string): string {
  return fileName.replace(/["\\]/g, "_");
}

function registerSampleContentTypeParsers(app: FastifyInstance): void {
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

function getBaseContentType(contentType: unknown): string | null {
  if (typeof contentType !== "string") {
    return null;
  }

  return contentType.split(";")[0]?.trim().toLowerCase() || null;
}

function sendManuscriptServiceError(
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

  app.log.error(error, "Failed to handle manuscript request");
  return sendInternalServerError(reply);
}

function parseUuidParam(
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

function readRequestBodyBuffer(request: { body?: unknown }): Buffer {
  if (Buffer.isBuffer(request.body)) {
    return request.body;
  }

  if (typeof request.body === "string") {
    return Buffer.from(request.body);
  }

  return Buffer.alloc(0);
}
