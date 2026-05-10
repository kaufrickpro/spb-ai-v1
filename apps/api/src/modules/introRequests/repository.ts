import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiConfig } from "../config/config.js";
import { createServiceRoleSupabaseClient } from "../supabase/client.js";
import { IntroRequestServiceError } from "./errors.js";
import {
  profileSelectColumns,
  type DocumentRecord,
  type ManuscriptRecord,
  type ProfileRecord,
} from "./types.js";

export function createIntroDb(config: ApiConfig) {
  return createServiceRoleSupabaseClient(
    config.supabaseUrl!,
    config.supabaseServiceRoleKey!,
  );
}

export async function getDbViewerProfile(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("profiles")
    .select(profileSelectColumns)
    .eq("user_id", userId)
    .maybeSingle();
  if (error)
    throw new IntroRequestServiceError(
      "storage",
      "Failed to load profile",
      error,
    );
  return (data as ProfileRecord | null) ?? null;
}

export async function getDbProfileByUserId(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("profiles")
    .select(profileSelectColumns)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProfileRecord | null) ?? null;
}

export async function getDbProfileById(db: SupabaseClient, profileId: string) {
  const { data } = await db
    .from("profiles")
    .select(profileSelectColumns)
    .eq("id", profileId)
    .maybeSingle();
  return (data as ProfileRecord | null) ?? null;
}

export async function getDbManuscriptById(
  db: SupabaseClient,
  manuscriptId: string,
) {
  const { data } = await db
    .from("manuscripts")
    .select("id,author_id,title,eligibility_status,sample_document_id")
    .eq("id", manuscriptId)
    .maybeSingle();
  return (data as ManuscriptRecord | null) ?? null;
}

export async function getDbDocumentById(
  db: SupabaseClient,
  documentId: string,
) {
  const { data } = await db
    .from("documents")
    .select(
      "id,manuscript_id,author_id,original_file_name,mime_type,upload_id,storage_status,processing_status,eligibility_status",
    )
    .eq("id", documentId)
    .maybeSingle();
  return (data as DocumentRecord | null) ?? null;
}

export function mapDbIntroError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return new IntroRequestServiceError(
      "conflict",
      error.message ?? "Intro request conflict",
      error,
    );
  }
  if (error.code === "22023") {
    const message = error.message ?? "Intro request is not allowed";
    if (message.toLowerCase().includes("not currently eligible")) {
      return new IntroRequestServiceError("not_eligible", message, error);
    }
    return new IntroRequestServiceError(
      message.toLowerCase().includes("quota") ? "quota" : "conflict",
      message,
      error,
    );
  }
  if (error.code === "42501") {
    return new IntroRequestServiceError(
      "forbidden",
      error.message ?? "Forbidden",
      error,
    );
  }
  if (error.code === "P0002") {
    return new IntroRequestServiceError(
      "not_found",
      "Intro request not found",
      error,
    );
  }
  return new IntroRequestServiceError(
    "storage",
    error.message ?? "Intro request failed",
    error,
  );
}
