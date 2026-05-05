import type { AuthDependencies } from "../auth/requestAuth.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { hasLocalUpload } from "../storage/localStorage.js";
import { ManuscriptServiceError } from "./errors.js";
import type { ManuscriptTestState } from "./testState.js";
import { getAnyTestDocument } from "./testState.js";

export type StoredDocumentRecord = {
  authorId: string;
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  originalFileName: string;
  storageStatus: string;
  uploadId: string;
};

export async function getStoredDocumentRecord(
  auth: AuthDependencies,
  testState: ManuscriptTestState,
  documentId: string,
): Promise<StoredDocumentRecord | null> {
  if (auth.config.authMode === "test") {
    const document = getAnyTestDocument(testState, documentId);
    return document
      ? {
          id: document.id,
          authorId: document.authorId,
          fileSizeBytes: document.fileSizeBytes,
          mimeType: document.mimeType,
          originalFileName: document.originalFileName,
          storageStatus: document.storageStatus,
          uploadId: document.uploadId,
        }
      : null;
  }

  const db = createServiceRoleSupabaseClient(
    auth.config.supabaseUrl!,
    auth.config.supabaseServiceRoleKey!,
  );
  const { data, error } = await db
    .from("documents")
    .select(
      "id, author_id, file_size_bytes, mime_type, original_file_name, storage_status, upload_id",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    authorId: data.author_id,
    fileSizeBytes: Number(data.file_size_bytes),
    mimeType: data.mime_type,
    originalFileName: data.original_file_name,
    storageStatus: data.storage_status,
    uploadId: data.upload_id,
  };
}

export async function assertLocalUploadExists(input: {
  id: string;
  originalFileName: string;
  uploadId: string;
}): Promise<void> {
  const hasStoredFile = await hasLocalUpload({
    documentId: input.id,
    fileName: input.originalFileName,
    uploadId: input.uploadId,
  });

  if (!hasStoredFile) {
    throw new ManuscriptServiceError(
      "conflict",
      "The upload token is stale or the local file is missing",
    );
  }
}
