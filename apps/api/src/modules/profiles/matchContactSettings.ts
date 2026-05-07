import {
  type MatchVisibleContact,
  type MatchVisibleContactSettings,
} from "@marketplace/contracts";

export const emptyContactSettings: MatchVisibleContactSettings = {
  publicEmail: null,
  publicPhone: null,
  websiteUrl: null,
  socialLinks: [],
  visibility: {
    publicEmail: false,
    publicPhone: false,
    websiteUrl: false,
    socialLinks: false,
  },
};

export function buildVisibleContact(
  settings: MatchVisibleContactSettings | undefined,
): MatchVisibleContact {
  const contactSettings = settings ?? emptyContactSettings;
  return {
    email: contactSettings.visibility.publicEmail
      ? (contactSettings.publicEmail ?? null)
      : null,
    phone: contactSettings.visibility.publicPhone
      ? (contactSettings.publicPhone ?? null)
      : null,
    websiteUrl: contactSettings.visibility.websiteUrl
      ? (contactSettings.websiteUrl ?? null)
      : null,
    socialLinks: contactSettings.visibility.socialLinks
      ? contactSettings.socialLinks
          .filter((item) => item.visible)
          .map(({ label, url }) => ({ label, url }))
      : [],
  };
}

export function fromDbContactSettings(
  profile: Record<string, unknown>,
): MatchVisibleContactSettings {
  const visibility =
    typeof profile.contact_visibility === "object" &&
    profile.contact_visibility !== null
      ? (profile.contact_visibility as MatchVisibleContactSettings["visibility"])
      : emptyContactSettings.visibility;
  const socialLinks = Array.isArray(profile.social_links)
    ? profile.social_links
    : [];

  return {
    publicEmail:
      typeof profile.public_contact_email === "string"
        ? profile.public_contact_email
        : null,
    publicPhone:
      typeof profile.public_phone === "string" ? profile.public_phone : null,
    websiteUrl:
      typeof profile.website_url === "string" ? profile.website_url : null,
    socialLinks: socialLinks as MatchVisibleContactSettings["socialLinks"],
    visibility: {
      publicEmail: visibility.publicEmail === true,
      publicPhone: visibility.publicPhone === true,
      websiteUrl: visibility.websiteUrl === true,
      socialLinks: visibility.socialLinks === true,
    },
  };
}
