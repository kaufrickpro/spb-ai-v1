import type { FastifyInstance } from "fastify";
import {
  CompleteUploadResponseSchema,
  DocumentDownloadUrlResponseSchema,
  DocumentResponseSchema,
  UploadSignedUrlRequestSchema,
  UploadSignedUrlResponseSchema,
} from "@marketplace/contracts";
import { sendNotFound, sendValidationError } from "../../lib/http/errors.js";
import { requireAuthenticatedUser } from "../auth/requestAuth.js";
import { assertCanUploadSample } from "../billing/service.js";
import { canPublisherDownloadAcceptedIntroSample } from "../introRequests/service.js";
import { requireAuthorRequest } from "./access.js";
import {
  assertAuthorCanDownloadDocument,
  completeAuthorDocumentUpload,
  createAuthorDocumentUpload,
  getAuthorDocument,
  getStoredDocumentRecord,
} from "./service.js";
import {
  buildDownloadUrlResponse,
  buildUploadUrlResponse,
} from "./uploadUrls.js";
import {
  normalizeDownloadDocument,
  parseUuidParam,
  sendManuscriptServiceError,
} from "./routeSupport.js";
import { registerLocalDocumentTransferRoutes } from "./registerLocalDocumentTransferRoutes.js";
import type { RegisterManuscriptRoutesOptions } from "./routeTypes.js";

export function registerDocumentRoutes(
  app: FastifyInstance,
  options: RegisterManuscriptRoutesOptions,
) {
  const {
    adminTestState,
    auth,
    billingTestState,
    introTestState,
    matchingTestState,
    profileTestState,
    testState,
  } = options;
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
      await assertCanUploadSample({
        billingTestState,
        config: auth.config,
        fileSizeBytes: input.data.fileSizeBytes,
        manuscriptId: input.data.manuscriptId,
        manuscriptTestState: testState,
        profileTestState,
        user,
      });
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
      const pendingDocument = await getStoredDocumentRecord(
        auth,
        testState,
        documentId,
      );
      await assertCanUploadSample({
        billingTestState,
        config: auth.config,
        fileSizeBytes: pendingDocument?.fileSizeBytes ?? 0,
        manuscriptId: pendingDocument?.manuscriptId ?? null,
        manuscriptTestState: testState,
        profileTestState,
        user,
      });
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

  registerLocalDocumentTransferRoutes(app, options);
}
