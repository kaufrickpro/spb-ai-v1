import {
  type CreateManuscriptRequest,
  type UpdateManuscriptRequest,
} from "@marketplace/contracts";
import type { AdminTestState } from "../admin/testState.js";
import type { AuthorRequestContext } from "./access.js";
import { ManuscriptServiceError } from "./errors.js";
import { mapDbManuscript } from "./mappers.js";
import type { ManuscriptTestState } from "./testState.js";
import {
  createTestManuscript,
  getTestManuscript,
  listTestManuscripts,
  updateTestManuscript,
} from "./testState.js";

export async function listAuthorManuscripts(
  context: AuthorRequestContext,
  testState: ManuscriptTestState,
  authorId: string,
) {
  if (context.mode === "test") {
    return listTestManuscripts(testState, authorId);
  }

  const { data, error } = await context.db
    .from("manuscripts")
    .select()
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to list manuscripts",
      error,
    );
  }

  return (data ?? []).map(mapDbManuscript);
}

export async function createAuthorManuscript(
  context: AuthorRequestContext,
  input: {
    adminTestState: AdminTestState;
    authorId: string;
    request: CreateManuscriptRequest;
    testState: ManuscriptTestState;
  },
) {
  if (context.mode === "test") {
    return createTestManuscript(
      input.testState,
      input.authorId,
      input.request,
    );
  }

  const { data, error } = await context.db
    .from("manuscripts")
    .insert({
      author_id: input.authorId,
      title: input.request.title,
      genre: input.request.genre,
      language: input.request.language,
      word_count: input.request.wordCount ?? null,
      synopsis: input.request.synopsis ?? null,
      target_age_min: input.request.targetAgeMin ?? null,
      target_age_max: input.request.targetAgeMax ?? null,
      status: "draft",
      admin_review_status: "not_submitted",
      eligibility_status: "eligible",
      review_outcome: "auto_approved",
    })
    .select()
    .single();

  if (error) {
    throw new ManuscriptServiceError(
      "storage",
      "Failed to create manuscript",
      error,
    );
  }

  return mapDbManuscript(data);
}

export async function getAuthorManuscript(
  context: AuthorRequestContext,
  testState: ManuscriptTestState,
  input: { authorId: string; manuscriptId: string },
) {
  if (context.mode === "test") {
    const manuscript = getTestManuscript(
      testState,
      input.manuscriptId,
      input.authorId,
    );
    if (!manuscript) {
      throw new ManuscriptServiceError("not_found", "Manuscript not found");
    }
    return manuscript;
  }

  const { data, error } = await context.db
    .from("manuscripts")
    .select()
    .eq("id", input.manuscriptId)
    .eq("author_id", input.authorId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ManuscriptServiceError(
        "not_found",
        "Manuscript not found",
        error,
      );
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to fetch manuscript",
      error,
    );
  }

  return mapDbManuscript(data);
}

export async function updateAuthorManuscript(
  context: AuthorRequestContext,
  testState: ManuscriptTestState,
  input: {
    authorId: string;
    manuscriptId: string;
    request: UpdateManuscriptRequest;
  },
) {
  if (context.mode === "test") {
    const manuscript = updateTestManuscript(
      testState,
      input.manuscriptId,
      input.authorId,
      input.request,
    );
    if (!manuscript) {
      throw new ManuscriptServiceError("not_found", "Manuscript not found");
    }
    return manuscript;
  }

  const { data, error } = await context.db
    .from("manuscripts")
    .update(buildManuscriptUpdatePayload(input.request))
    .eq("id", input.manuscriptId)
    .eq("author_id", input.authorId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ManuscriptServiceError(
        "not_found",
        "Manuscript not found",
        error,
      );
    }
    throw new ManuscriptServiceError(
      "storage",
      "Failed to update manuscript",
      error,
    );
  }

  return mapDbManuscript(data);
}

function buildManuscriptUpdatePayload(
  input: UpdateManuscriptRequest,
): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = {};
  if (input.title !== undefined) updatePayload["title"] = input.title;
  if (input.genre !== undefined) updatePayload["genre"] = input.genre;
  if (input.language !== undefined) updatePayload["language"] = input.language;
  if (input.wordCount !== undefined) updatePayload["word_count"] = input.wordCount;
  if (input.synopsis !== undefined) updatePayload["synopsis"] = input.synopsis;
  if (input.targetAgeMin !== undefined) {
    updatePayload["target_age_min"] = input.targetAgeMin;
  }
  if (input.targetAgeMax !== undefined) {
    updatePayload["target_age_max"] = input.targetAgeMax;
  }
  return updatePayload;
}
