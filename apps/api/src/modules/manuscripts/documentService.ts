import type { AdminTestState } from "../admin/testState.js";
import type { AuthorRequestContext } from "./access.js";
import { assertLocalUploadExists } from "./documentStorage.js";
import { ManuscriptServiceError } from "./errors.js";
import {
  queueSupabaseDocumentIngestionJob,
  queueTestDocumentIngestionJob,
} from "./ingestionJobs.js";
import { mapDbDocument } from "./mappers.js";
import type { ManuscriptTestState } from "./testState.js";
import { completeTestDocumentUpload } from "./testState.js";

export async function completeAuthorDocumentUpload(
  context: AuthorRequestContext,
  input: {
    adminTestState: AdminTestState;
    authorId: string;
    documentId: string;
    testState: ManuscriptTestState;
  },
) {
  if (context.mode === "test") {
    return completeTestUploadAndQueueReview(input);
  }

  const docRow = await getPendingSupabaseDocument(context, input);
  await assertLocalUploadExists({
    id: docRow.id,
    originalFileName: docRow.original_file_name,
    uploadId: docRow.upload_id,
  });

  const updatedRow = await completeSupabaseDocumentUpload(context, input);
  await queueSupabaseDocumentIngestionJob(context, {
    documentId: updatedRow.id,
    fileSizeBytes: Number(updatedRow.file_size_bytes),
    mimeType: updatedRow.mime_type,
    originalFileName: updatedRow.original_file_name,
    uploadId: updatedRow.upload_id,
  });
  return mapDbDocument(updatedRow);
}

async function completeTestUploadAndQueueReview(input: {
  adminTestState: AdminTestState;
  authorId: string;
  documentId: string;
  testState: ManuscriptTestState;
}) {
  await assertExistingTestUploadWasStored(input);

  const document = completeTestDocumentUpload(
    input.testState,
    input.documentId,
    input.authorId,
  );
  if (!document) {
    throw new ManuscriptServiceError("not_found", "Document not found");
  }

  queueTestDocumentIngestionJob(input.adminTestState, {
    documentId: document.id,
    fileSizeBytes: document.fileSizeBytes,
    mimeType: document.mimeType,
    originalFileName: document.originalFileName,
    uploadId: document.uploadId,
    updatedAt: document.updatedAt,
  });

  return document;
}

async function assertExistingTestUploadWasStored(input: {
  authorId: string;
  documentId: string;
  testState: ManuscriptTestState;
}): Promise<void> {
  const document = input.testState.documents.find(
    (item) => item.id === input.documentId && item.authorId === input.authorId,
  );
  if (!document) {
    throw new ManuscriptServiceError("not_found", "Document not found");
  }

  await assertLocalUploadExists(document);
}

async function getPendingSupabaseDocument(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: { authorId: string; documentId: string },
) {
  const { data, error } = await context.db
    .from("documents")
    .select()
    .eq("id", input.documentId)
    .eq("author_id", input.authorId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ManuscriptServiceError("not_found", "Document not found", error);
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to load document before upload completion",
      error,
    );
  }

  if (data.storage_status !== "pending_upload") {
    throw new ManuscriptServiceError(
      "conflict",
      "The upload is no longer pending completion",
    );
  }

  return data;
}

async function completeSupabaseDocumentUpload(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: { authorId: string; documentId: string },
) {
  const { data, error } = await context.db.rpc("complete_document_upload", {
    p_actor_user_id: input.authorId,
    p_document_id: input.documentId,
  });

  if (error) {
    if (error.code === "P0002" || error.code === "P0003") {
      throw new ManuscriptServiceError(
        "conflict",
        "The upload is no longer pending completion",
        error,
      );
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to complete document upload",
      error,
    );
  }

  return data;
}
