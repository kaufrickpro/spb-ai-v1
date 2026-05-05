import type { AuthorRequestContext } from "./access.js";
import { ManuscriptServiceError } from "./errors.js";
import { mapDbDocument } from "./mappers.js";
import type { ManuscriptTestState } from "./testState.js";
import { getTestDocument } from "./testState.js";

export async function getAuthorDocument(
  context: AuthorRequestContext,
  testState: ManuscriptTestState,
  input: { authorId: string; documentId: string },
) {
  if (context.mode === "test") {
    const document = getTestDocument(testState, input.documentId, input.authorId);
    if (!document) {
      throw new ManuscriptServiceError("not_found", "Document not found");
    }
    return document;
  }

  const { data, error } = await context.db
    .from("documents")
    .select()
    .eq("id", input.documentId)
    .eq("author_id", input.authorId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ManuscriptServiceError(
        "not_found",
        "Document not found",
        error,
      );
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to fetch document",
      error,
    );
  }

  return mapDbDocument(data);
}

export async function assertAuthorCanDownloadDocument(
  context: AuthorRequestContext,
  testState: ManuscriptTestState,
  input: { authorId: string; documentId: string },
) {
  if (context.mode === "test") {
    const document = getTestDocument(testState, input.documentId, input.authorId);
    if (!document || document.storageStatus === "deleted") {
      throw new ManuscriptServiceError("not_found", "Document not found");
    }
    return;
  }

  const { data, error } = await context.db
    .from("documents")
    .select("id, storage_status")
    .eq("id", input.documentId)
    .eq("author_id", input.authorId)
    .single();

  if (error || !data || data.storage_status === "deleted") {
    throw new ManuscriptServiceError("not_found", "Document not found", error);
  }
}
