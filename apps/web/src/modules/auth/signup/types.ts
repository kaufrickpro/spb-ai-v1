import type {
  CreateProfileRequest,
  PublicProfileRole,
} from "@marketplace/contracts";

export type SignupFormState = {
  email: string;
  password: string;
  confirmPassword: string;
  role: PublicProfileRole;
  displayName: string;
  profilePhotoUrl: string;
  signupIntent: CreateProfileRequest["signupIntent"];
};

export const stepRoleOptions: PublicProfileRole[] = ["author", "publisher"];
export const totalSignupSteps = 3;
