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
const OptionalHttpsUrlSchema = z
  .union([z.string().trim().url().max(2048), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      throw new Error("Only https URLs are allowed");
    }

    return trimmed;
  });
const HttpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine(
    (value) => new URL(value).protocol === "https:",
    "Only https URLs are allowed",
  );

export const MatchVisibleContactSchema = z.object({
  email: z.string().trim().email().max(254).nullable(),
  phone: z.string().trim().min(3).max(40).nullable(),
  websiteUrl: z.string().trim().url().max(2048).nullable(),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z.string().trim().url().max(2048),
      }),
    )
    .max(8),
});

export const MatchVisibleContactSettingsSchema = z.object({
  publicEmail: z.string().trim().email().max(254).optional().nullable(),
  publicPhone: z.string().trim().min(3).max(40).optional().nullable(),
  websiteUrl: OptionalHttpsUrlSchema,
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z.string().trim().url().max(2048),
        visible: z.boolean().default(false),
      }),
    )
    .max(8)
    .optional()
    .default([]),
  visibility: z.object({
    publicEmail: z.boolean().default(false),
    publicPhone: z.boolean().default(false),
    websiteUrl: z.boolean().default(false),
    socialLinks: z.boolean().default(false),
  }),
});

export const UpdateMatchVisibleContactSettingsRequestSchema =
  MatchVisibleContactSettingsSchema;

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
  styleStatement: z.string().trim().max(1000).optional().nullable(),
  influences: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
});

export const PublisherProfileDetailsSchema = z.object({
  role: z.literal("publisher"),
  publisherName: z.string().trim().min(2).max(160).optional().nullable(),
  logoUrl: OptionalHttpsUrlSchema,
  websiteUrl: OptionalHttpsUrlSchema,
  focusGenres: z.array(GenreLabelSchema).min(1).max(5),
  preferredLanguages: WritingLanguagesSchema,
  acceptsUnsolicited: z.boolean(),
  about: z.string().trim().max(1200).optional().nullable(),
  editorialFocus: z.string().trim().max(1200).optional().nullable(),
  lookingFor: z.string().trim().max(1200).optional().nullable(),
  acceptedAudienceCategories: z
    .array(z.string().trim().min(1).max(80))
    .max(12)
    .optional(),
  acceptedManuscriptForms: z
    .array(z.string().trim().min(1).max(80))
    .max(12)
    .optional(),
  submissionGuidelines: z.string().trim().max(2000).optional().nullable(),
  recentAcquisitions: z
    .array(z.string().trim().min(1).max(160))
    .max(12)
    .optional(),
  bestSellingBooks: z
    .array(z.string().trim().min(1).max(160))
    .max(12)
    .optional(),
  excludedTopics: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  editorWishlist: z.string().trim().max(2000).optional().nullable(),
  imprintTone: z.string().trim().max(1000).optional().nullable(),
  marketPositioning: z.string().trim().max(1000).optional().nullable(),
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

export const PublicPublisherDirectoryItemSchema = z.object({
  id: UuidSchema,
  name: z.string().trim().min(1).max(120),
  logoUrl: HttpsUrlSchema,
  websiteUrl: HttpsUrlSchema,
});

export const PublicPublisherDirectoryResponseSchema = z.object({
  publishers: z.array(PublicPublisherDirectoryItemSchema),
});

export const PublisherProfilePageSchema = z.object({
  id: UuidSchema,
  name: z.string().trim().min(1).max(120),
  logoUrl: z.string().trim().url().max(2048).nullable(),
  websiteUrl: z.string().trim().url().max(2048).nullable(),
  about: z.string().trim().max(1200).nullable(),
  editorialFocus: z.string().trim().max(1200).nullable(),
  lookingFor: z.string().trim().max(1200).nullable(),
  acceptedGenres: z.array(z.string().trim().min(1).max(80)),
  acceptedLanguages: z.array(LocaleSchema),
  acceptedAudienceCategories: z.array(z.string().trim().min(1).max(80)),
  acceptedManuscriptForms: z.array(z.string().trim().min(1).max(80)),
  acceptsUnsolicited: z.boolean(),
  submissionGuidelines: z.string().trim().max(2000).nullable(),
  excludedTopics: z.array(z.string().trim().min(1).max(120)),
  editorWishlist: z.string().trim().max(2000).nullable(),
  imprintTone: z.string().trim().max(1000).nullable(),
  marketPositioning: z.string().trim().max(1000).nullable(),
  recentAcquisitions: z.array(z.string().trim().min(1).max(160)),
  bestSellingBooks: z.array(z.string().trim().min(1).max(160)),
  contact: MatchVisibleContactSchema,
});

export const PublisherProfilePageResponseSchema = z.object({
  publisher: PublisherProfilePageSchema,
});

export const AuthorVisibleManuscriptSchema = z.object({
  id: UuidSchema,
  title: z.string().trim().min(1).max(200),
  genre: z.string().trim().min(1).max(80),
  manuscriptForm: z.string().trim().max(80).nullable(),
  shortTeaser: z.string().trim().max(500).nullable(),
  logline: z.string().trim().max(500).nullable().optional(),
  synopsis: z.string().trim().max(2000).nullable().optional(),
  access: z.enum(["full", "requestable_teaser"]),
  requestStatus: z
    .enum(["none", "pending", "approved", "rejected"])
    .default("none"),
});

export const AuthorProfilePageSchema = z.object({
  id: UuidSchema,
  displayName: z.string().trim().min(1).max(120),
  photoUrl: z.string().trim().url().max(2048).nullable(),
  biography: z.string().trim().max(1000).nullable(),
  styleStatement: z.string().trim().max(1000).nullable(),
  influences: z.array(z.string().trim().min(1).max(120)),
  contact: MatchVisibleContactSchema,
  manuscripts: z.array(AuthorVisibleManuscriptSchema),
});

export const AuthorProfilePageResponseSchema = z.object({
  author: AuthorProfilePageSchema,
});

export const PublicDirectoryDecisionRequestSchema = z.object({
  status: z.enum(["approved", "hidden", "rejected"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const PublicDirectoryDecisionResponseSchema = z.object({
  publisherProfileId: UuidSchema,
  status: z.enum(["approved", "hidden", "rejected"]),
});

export const MatchVisibleContactSettingsResponseSchema = z.object({
  settings: MatchVisibleContactSettingsSchema,
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
export type AuthorProfilePage = z.infer<typeof AuthorProfilePageSchema>;
export type AuthorVisibleManuscript = z.infer<
  typeof AuthorVisibleManuscriptSchema
>;
export type MatchVisibleContact = z.infer<typeof MatchVisibleContactSchema>;
export type MatchVisibleContactSettings = z.infer<
  typeof MatchVisibleContactSettingsSchema
>;
export type PublicPublisherDirectoryItem = z.infer<
  typeof PublicPublisherDirectoryItemSchema
>;
export type PublisherProfilePage = z.infer<typeof PublisherProfilePageSchema>;
