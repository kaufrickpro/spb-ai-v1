import type { MatchVisibleContactSettings } from "@marketplace/contracts";

export function buildMatchVisibleContactSettings(input: {
  publicEmail: string;
  showEmail: boolean;
  showWebsite: boolean;
  websiteUrl: string;
}): MatchVisibleContactSettings {
  const publicEmail = input.publicEmail.trim();
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl);

  return {
    publicEmail: publicEmail.length > 0 ? publicEmail : null,
    publicPhone: null,
    websiteUrl,
    socialLinks: [],
    visibility: {
      publicEmail: input.showEmail,
      publicPhone: false,
      websiteUrl: input.showWebsite,
      socialLinks: false,
    },
  };
}

function normalizeWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}
