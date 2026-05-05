import type { AdminReviewQueueItem, Profile } from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapDbAdminReview } from "./mappers.js";
import { mapDbProfile } from "../profiles/mappers.js";
import type { AdminTestState } from "./testState.js";

export class AdminProfileReviewError extends Error {
  constructor(
    readonly kind: "not_found" | "storage",
    message: string,
    readonly source?: unknown,
  ) {
    super(message);
  }
}

export async function getPendingProfiles(
  db: SupabaseClient,
): Promise<Profile[]> {
  const { data, error } = await db
    .from("profiles")
    .select()
    .eq("eligibility_status", "limited")
    .eq("review_outcome", "needs_review")
    .in("role", ["author", "publisher"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminProfileReviewError(
      "storage",
      "Failed to fetch pending profiles",
      error,
    );
  }

  return (data ?? []).map(mapDbProfile);
}

export async function getPendingProfileReview(
  db: SupabaseClient,
  profileId: string,
): Promise<AdminReviewQueueItem> {
  const { data, error } = await db
    .from("admin_reviews")
    .select()
    .eq("entity_type", "profile")
    .eq("entity_id", profileId)
    .eq("status", "pending")
    .eq("exception_queue", "needs_review")
    .eq("eligibility_status", "limited")
    .eq("review_outcome", "needs_review")
    .order("submitted_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AdminProfileReviewError(
      "storage",
      "Failed to fetch pending profile review",
      error,
    );
  }

  if (!data) {
    throw new AdminProfileReviewError(
      "not_found",
      "Pending profile review not found",
    );
  }

  return mapDbAdminReview(data);
}

export async function getProfileById(
  db: SupabaseClient,
  profileId: string,
): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .select()
    .eq("id", profileId)
    .in("role", ["author", "publisher"])
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AdminProfileReviewError(
        "not_found",
        "Profile not found",
        error,
      );
    }

    throw new AdminProfileReviewError(
      "storage",
      "Failed to fetch profile",
      error,
    );
  }

  return mapDbProfile(data);
}

export function getTestPendingProfiles(state: AdminTestState): Profile[] {
  return state.profiles
    .filter(
      (profile) =>
        profile.eligibilityStatus === "limited" &&
        profile.reviewOutcome === "needs_review",
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getTestPendingProfileReview(
  state: AdminTestState,
  profileId: string,
): AdminReviewQueueItem {
  const review = state.reviews.find(
    (item) =>
      item.entityType === "profile" &&
      item.entityId === profileId &&
      item.status === "pending" &&
      item.exceptionQueue === "needs_review" &&
      item.eligibilityStatus === "limited" &&
      item.reviewOutcome === "needs_review",
  );

  if (!review) {
    throw new AdminProfileReviewError(
      "not_found",
      "Pending profile review not found",
    );
  }

  return review;
}
