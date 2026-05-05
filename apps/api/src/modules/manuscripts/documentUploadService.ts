import { randomUUID } from "node:crypto";
import { generateUploadId } from "../storage/localTokens.js";
import type { AuthorRequestContext } from "./access.js";
import { ManuscriptServiceError } from "./errors.js";
import type { ManuscriptTestState } from "./testState.js";
import { createTestDocument, getTestManuscript } from "./testState.js";

export async function createAuthorDocumentUpload(
  context: AuthorRequestContext,
  testState: ManuscriptTestState,
  input: {
    authorId: string;
    fileName: string;
    fileSizeBytes: number;
    manuscriptId: string;
    mimeType: string;
  },
) {
  const documentId = randomUUID();
  const uploadId = generateUploadId();

  if (context.mode === "test") {
    createTestPendingDocument(testState, {
      ...input,
      documentId,
      uploadId,
    });
    return { documentId, uploadId };
  }

  await assertSupabaseManuscriptOwnership(context, input);
  await insertPendingDocument(context, {
    ...input,
    documentId,
    uploadId,
  });

  return { documentId, uploadId };
}

function createTestPendingDocument(
  testState: ManuscriptTestState,
  input: {
    authorId: string;
    documentId: string;
    fileName: string;
    fileSizeBytes: number;
    manuscriptId: string;
    mimeType: string;
    uploadId: string;
  },
): void {
  const manuscript = getTestManuscript(
    testState,
    input.manuscriptId,
    input.authorId,
  );
  if (!manuscript) {
    throw new ManuscriptServiceError("not_found", "Manuscript not found");
  }

  createTestDocument(
    testState,
    input.documentId,
    input.uploadId,
    input.manuscriptId,
    input.authorId,
    input.fileName,
    input.mimeType,
    input.fileSizeBytes,
  );
}

async function assertSupabaseManuscriptOwnership(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: { authorId: string; manuscriptId: string },
): Promise<void> {
  const { data, error } = await context.db
    .from("manuscripts")
    .select("id")
    .eq("id", input.manuscriptId)
    .eq("author_id", input.authorId)
    .single();

  if (error || !data) {
    throw new ManuscriptServiceError(
      "not_found",
      "Manuscript not found",
      error,
    );
  }
}

async function insertPendingDocument(
  context: Extract<AuthorRequestContext, { mode: "supabase" }>,
  input: {
    authorId: string;
    documentId: string;
    fileName: string;
    fileSizeBytes: number;
    manuscriptId: string;
    mimeType: string;
    uploadId: string;
  },
): Promise<void> {
  const { error } = await context.db.from("documents").insert({
    id: input.documentId,
    manuscript_id: input.manuscriptId,
    author_id: input.authorId,
    original_file_name: input.fileName,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    storage_status: "pending_upload",
    processing_status: "not_started",
    admin_review_status: "not_submitted",
    eligibility_status: "limited",
    review_outcome: "needs_review",
    upload_id: input.uploadId,
  });

  if (error) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to create pending document upload",
      error,
    );
  }
}
