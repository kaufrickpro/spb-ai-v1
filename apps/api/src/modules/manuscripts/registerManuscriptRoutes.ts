import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CompleteUploadResponseSchema,
  CreateManuscriptRequestSchema,
  DocumentDownloadUrlResponseSchema,
  DocumentResponseSchema,
  ManuscriptAccessRequestListResponseSchema,
  ManuscriptAccessRequestResponseSchema,
  MAX_FILE_SIZE_BYTES,
  ManuscriptListResponseSchema,
  ManuscriptProfileResponseSchema,
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
  sendForbidden,
  sendInternalServerError,
  sendNotFound,
  sendValidationError,
} from "../../lib/http/errors.js";
import type { AdminTestState } from "../admin/testState.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import type { MatchingTestState } from "../matching/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
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
import {
  createManuscriptAccessRequest,
  decideManuscriptAccessRequest,
  getManuscriptProfilePage,
  listManuscriptAccessRequests,
  ManuscriptProfileAccessError,
} from "./profileAccessService.js";
import { canPublisherDownloadAcceptedIntroSample } from "../introRequests/service.js";

type RegisterManuscriptRoutesOptions = {
  adminTestState: AdminTestState;
  auth: AuthDependencies;
  introTestState?: IntroRequestTestState;
  matchingTestState?: MatchingTestState;
  profileTestState: ProfileTestState;
  testState: ManuscriptTestState;
};

export function registerManuscriptRoutes(
  app: FastifyInstance,
  {
    adminTestState,
    auth,
    introTestState,
    matchingTestState,
    profileTestState,
    testState,
  }: RegisterManuscriptRoutesOptions,
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
      return reply.code(201).send(
        UploadSignedUrlResponseSchema.parse(
          await buildUploadUrlResponse(auth, {
            authorId: user.userId,
            documentId,
            fileName: input.data.fileName,
            mimeType: input.data.mimeType,
            uploadId,
          }),
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
      if (auth.config.storageProvider === "gcs") {
        return sendNotFound(reply, "Upload target not found");
      }

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
        config: auth.config,
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

    if (introTestState && matchingTestState) {
      const acceptedIntroDocument =
        await canPublisherDownloadAcceptedIntroSample({
          config: auth.config,
          documentId,
          introTestState,
          manuscriptTestState: testState,
          matchingTestState,
          profileTestState,
          user,
        });
      if (acceptedIntroDocument) {
        const document = normalizeDownloadDocument(
          acceptedIntroDocument as Record<string, unknown>,
        );
        return reply.send(
          DocumentDownloadUrlResponseSchema.parse(
            await buildDownloadUrlResponse(
              auth,
              {
                authorId: document.authorId,
                documentId: document.id,
                fileName: document.originalFileName,
                mimeType: document.mimeType,
                uploadId: document.uploadId,
              },
              "accepted_intro",
            ),
          ),
        );
      }
    }

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
      const document = await getStoredDocumentRecord(
        auth,
        testState,
        documentId,
      );
      if (!document) {
        return sendNotFound(reply, "Document not found");
      }
      return reply.send(
        DocumentDownloadUrlResponseSchema.parse(
          await buildDownloadUrlResponse(
            auth,
            {
              authorId: user.userId,
              documentId,
              fileName: document.originalFileName,
              mimeType: document.mimeType,
              uploadId: document.uploadId,
            },
            "author",
          ),
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
    "/api/v1/profiles/manuscripts/:manuscriptId",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const manuscriptId = parseUuidParam(
        request.params,
        "manuscriptId",
        reply,
      );
      if (!manuscriptId) return;

      try {
        const response = await getManuscriptProfilePage({
          config: auth.config,
          introTestState,
          manuscriptId,
          manuscriptTestState: testState,
          matchingTestState,
          profileTestState: profileTestState,
          user,
        });
        return reply.send(ManuscriptProfileResponseSchema.parse(response));
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.post(
    "/api/v1/manuscripts/:manuscriptId/access-requests",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const manuscriptId = parseUuidParam(
        request.params,
        "manuscriptId",
        reply,
      );
      if (!manuscriptId) return;

      try {
        const response = await createManuscriptAccessRequest({
          config: auth.config,
          manuscriptId,
          manuscriptTestState: testState,
          profileTestState,
          user,
        });
        return reply
          .code(201)
          .send(ManuscriptAccessRequestResponseSchema.parse(response));
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.get("/api/v1/manuscript-access-requests", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, auth);
    if (!user) return;

    try {
      const response = await listManuscriptAccessRequests({
        config: auth.config,
        manuscriptTestState: testState,
        profileTestState,
        user,
      });
      return reply.send(
        ManuscriptAccessRequestListResponseSchema.parse(response),
      );
    } catch (error) {
      return sendManuscriptProfileAccessError(app, reply, error);
    }
  });

  app.post(
    "/api/v1/manuscript-access-requests/:requestId/approve",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const requestId = parseUuidParam(request.params, "requestId", reply);
      if (!requestId) return;

      try {
        const response = await decideManuscriptAccessRequest({
          config: auth.config,
          decision: "approved",
          manuscriptTestState: testState,
          profileTestState,
          requestId,
          user,
        });
        return reply.send(
          ManuscriptAccessRequestResponseSchema.parse(response),
        );
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.post(
    "/api/v1/manuscript-access-requests/:requestId/reject",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, auth);
      if (!user) return;

      const requestId = parseUuidParam(request.params, "requestId", reply);
      if (!requestId) return;

      try {
        const response = await decideManuscriptAccessRequest({
          config: auth.config,
          decision: "rejected",
          manuscriptTestState: testState,
          profileTestState,
          requestId,
          user,
        });
        return reply.send(
          ManuscriptAccessRequestResponseSchema.parse(response),
        );
      } catch (error) {
        return sendManuscriptProfileAccessError(app, reply, error);
      }
    },
  );

  app.get(
    "/api/v1/documents/local-download/:downloadToken",
    async (request, reply) => {
      if (auth.config.storageProvider === "gcs") {
        return sendNotFound(reply, "Document file not found");
      }

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

function normalizeDownloadDocument(document: Record<string, unknown>) {
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

function sendManuscriptProfileAccessError(
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
