import { z } from "zod";
import {
  ApprovalStatusSchema,
  EligibilityStatusSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  ProfileRoleSchema,
  PublicProfileRoleSchema,
  ReviewOutcomeSchema,
  UuidSchema,
} from "./common.js";

export const OnboardingStepSchema = z.enum([
  "role_selection",
  "author_details",
  "publisher_details",
  "complete",
]);
const GenreLabelSchema = z.string().trim().min(2).max(80);
const WritingLanguagesSchema = z.array(LocaleSchema).min(1).max(2);
const ProfilePhotoUrlSchema = z
  .union([z.string().trim().url().max(2048), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const AUTHOR_SIGNUP_INTENTS = [
  "find_publisher",
  "compare_publishers",
  "prepare_submission",
] as const;

export const PUBLISHER_SIGNUP_INTENTS = [
  "discover_manuscripts",
  "source_authors",
  "manage_submissions",
] as const;

export const AuthorSignupIntentSchema = z.enum(AUTHOR_SIGNUP_INTENTS);
export const PublisherSignupIntentSchema = z.enum(PUBLISHER_SIGNUP_INTENTS);
export const SignupIntentSchema = z.union([
  AuthorSignupIntentSchema,
  PublisherSignupIntentSchema,
]);

const BaseCreateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  locale: LocaleSchema.default("tr"),
  profilePhotoUrl: ProfilePhotoUrlSchema,
});

export const ProfileSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  role: ProfileRoleSchema,
  displayName: z.string().trim().min(1).max(120),
  profilePhotoUrl: z.string().trim().url().max(2048).nullable(),
  signupIntent: SignupIntentSchema,
  approvalStatus: ApprovalStatusSchema,
  eligibilityStatus: EligibilityStatusSchema.default("limited"),
  reviewOutcome: ReviewOutcomeSchema.default("needs_review"),
  locale: LocaleSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateProfileRequestSchema = z.discriminatedUnion("role", [
  BaseCreateProfileRequestSchema.extend({
    role: z.literal(PublicProfileRoleSchema.options[0]),
    signupIntent: AuthorSignupIntentSchema,
  }),
  BaseCreateProfileRequestSchema.extend({
    role: z.literal(PublicProfileRoleSchema.options[1]),
    signupIntent: PublisherSignupIntentSchema,
  }),
]);

export const AuthorProfileDetailsSchema = z.object({
  role: z.literal("author"),
  biography: z.string().trim().min(24).max(1000),
  primaryGenre: GenreLabelSchema,
  writingLanguages: WritingLanguagesSchema,
});

export const PublisherProfileDetailsSchema = z.object({
  role: z.literal("publisher"),
  focusGenres: z.array(GenreLabelSchema).min(1).max(5),
  preferredLanguages: WritingLanguagesSchema,
  acceptsUnsolicited: z.boolean(),
});

export const ProfileDetailsSchema = z.discriminatedUnion("role", [
  AuthorProfileDetailsSchema,
  PublisherProfileDetailsSchema,
]);

export const CompleteOnboardingDetailsRequestSchema = ProfileDetailsSchema;

export const ProfileResponseSchema = z.object({
  profile: ProfileSchema,
  details: ProfileDetailsSchema.nullable(),
});

export const OnboardingDetailsResponseSchema = z.object({
  profile: ProfileSchema,
  details: ProfileDetailsSchema,
});

export type CreateProfileRequest = z.infer<typeof CreateProfileRequestSchema>;
export type CompleteOnboardingDetailsRequest = z.infer<
  typeof CompleteOnboardingDetailsRequestSchema
>;
export type AuthorProfileDetails = z.infer<typeof AuthorProfileDetailsSchema>;
export type AuthorSignupIntent = z.infer<typeof AuthorSignupIntentSchema>;
export type PublisherProfileDetails = z.infer<
  typeof PublisherProfileDetailsSchema
>;
export type PublisherSignupIntent = z.infer<typeof PublisherSignupIntentSchema>;
export type ProfileDetails = z.infer<typeof ProfileDetailsSchema>;
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type OnboardingDetailsResponse = z.infer<
  typeof OnboardingDetailsResponseSchema
>;
export type SignupIntent = z.infer<typeof SignupIntentSchema>;
