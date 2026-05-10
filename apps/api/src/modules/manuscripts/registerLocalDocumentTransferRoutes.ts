import type { FastifyInstance } from "fastify";
import { MAX_FILE_SIZE_BYTES } from "@marketplace/contracts";
import { sendNotFound, sendValidationError } from "../../lib/http/errors.js";
import { readLocalUpload, saveLocalUpload } from "../storage/localStorage.js";
import {
  verifyLocalDownloadToken,
  verifyLocalUploadToken,
} from "../storage/localTokens.js";
import { getStoredDocumentRecord } from "./service.js";
import {
  escapeContentDispositionFilename,
  getBaseContentType,
  readRequestBodyBuffer,
} from "./routeSupport.js";
import type { RegisterManuscriptRoutesOptions } from "./routeTypes.js";

export function registerLocalDocumentTransferRoutes(
  app: FastifyInstance,
  options: RegisterManuscriptRoutesOptions,
) {
  const { auth, testState } = options;
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
