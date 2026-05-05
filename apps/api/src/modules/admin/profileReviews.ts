import type { Profile } from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function applyProfileDecision(
  db: SupabaseClient,
  input: {
    decision: "approved" | "rejected";
    profileId: string;
  },
): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .update({
      approval_status: input.decision,
      eligibility_status:
        input.decision === "approved" ? "eligible" : "blocked",
      review_outcome:
        input.decision === "approved" ? "admin_approved" : "admin_rejected",
    })
    .eq("id", input.profileId)
    .in("role", ["author", "publisher"])
    .select()
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
      "Failed to update profile approval status",
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

export function applyTestProfileDecision(
  state: AdminTestState,
  input: {
    decision: "approved" | "rejected";
    now: string;
    profileId: string;
  },
): Profile {
  const profileIndex = state.profiles.findIndex(
    (profile) => profile.id === input.profileId,
  );

  if (profileIndex < 0) {
    throw new AdminProfileReviewError("not_found", "Profile not found");
  }

  const updatedProfile: Profile = {
    ...state.profiles[profileIndex],
    approvalStatus: input.decision,
    eligibilityStatus: input.decision === "approved" ? "eligible" : "blocked",
    reviewOutcome:
      input.decision === "approved" ? "admin_approved" : "admin_rejected",
    updatedAt: input.now,
  };

  state.profiles[profileIndex] = updatedProfile;

  return updatedProfile;
}
