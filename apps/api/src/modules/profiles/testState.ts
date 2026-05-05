import { randomUUID } from "node:crypto";
import {
  type CompleteOnboardingDetailsRequest,
  type Profile,
  type ProfileDetails,
  ProfileResponseSchema,
} from "@marketplace/contracts";

export type ProfileTestState = {
  profilesByUserId: Map<
    string,
    {
      profile: Profile;
      details: ProfileDetails | null;
    }
  >;
};

export function createProfileTestState(): ProfileTestState {
  return {
    profilesByUserId: new Map(),
  };
}

export function createTestProfile(
  state: ProfileTestState,
  userId: string,
  input: {
    role: Profile["role"];
    displayName: string;
    profilePhotoUrl: Profile["profilePhotoUrl"];
    signupIntent: Profile["signupIntent"];
    locale: Profile["locale"];
  },
): { profile: Profile; details: null } {
  const now = new Date().toISOString();
  const profile = ProfileResponseSchema.shape.profile.parse({
    id: randomUUID(),
    userId,
    role: input.role,
    displayName: input.displayName,
    profilePhotoUrl: input.profilePhotoUrl,
    signupIntent: input.signupIntent,
    approvalStatus: "pending",
    eligibilityStatus: "limited",
    reviewOutcome: "needs_review",
    locale: input.locale,
    createdAt: now,
    updatedAt: now,
  });

  const record = { profile, details: null as null };
  state.profilesByUserId.set(userId, record);
  return record;
}

export function getTestProfile(
  state: ProfileTestState,
  userId: string,
): { profile: Profile; details: ProfileDetails | null } | null {
  return state.profilesByUserId.get(userId) ?? null;
}

export function completeTestProfileDetails(
  state: ProfileTestState,
  userId: string,
  input: CompleteOnboardingDetailsRequest,
): { profile: Profile; details: ProfileDetails } | null {
  const existing = state.profilesByUserId.get(userId);
  if (!existing) {
    return null;
  }

  const profile = ProfileResponseSchema.shape.profile.parse({
    ...existing.profile,
    approvalStatus: "approved",
    eligibilityStatus: "eligible",
    reviewOutcome: "auto_approved",
    updatedAt: new Date().toISOString(),
  });

  const record = { profile, details: input };
  state.profilesByUserId.set(userId, record);
  return record;
}
