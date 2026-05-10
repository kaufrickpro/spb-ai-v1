import {
  AcceptedIntroContactSchema,
  type AcceptedIntroContact,
  type IntroRequest,
} from "@marketplace/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findTestProfileById } from "../profiles/testState.js";
import {
  buildVisibleContact,
  fromDbContactSettings,
} from "../profiles/matchContactSettings.js";
import {
  getDbDocumentById,
  getDbManuscriptById,
  getDbProfileById,
} from "./repository.js";
import type { IntroRequestDeps } from "./types.js";

export function buildTestAcceptedContact(
  input: IntroRequestDeps,
  targetProfileId: string,
): AcceptedIntroContact | null {
  const target = findTestProfileById(input.profileTestState, targetProfileId);
  if (!target || target.profile.eligibilityStatus !== "eligible") return null;
  const contact =
    input.profileTestState.matchVisibleContactsByProfileId.get(targetProfileId);
  return AcceptedIntroContactSchema.parse({
    profileId: target.profile.id,
    displayName: target.profile.displayName,
    role: target.profile.role,
    email: contact?.visibility.publicEmail
      ? (contact.publicEmail ?? null)
      : null,
    phone: contact?.visibility.publicPhone
      ? (contact.publicPhone ?? null)
      : null,
    websiteUrl: contact?.visibility.websiteUrl
      ? (contact.websiteUrl ?? null)
      : null,
    socialLinks: contact?.visibility.socialLinks
      ? (contact.socialLinks ?? [])
          .filter((item) => item.visible)
          .map((item) => ({ label: item.label, url: item.url }))
      : [],
  });
}

export async function getDbAcceptedContact(
  db: SupabaseClient,
  targetProfileId: string,
): Promise<AcceptedIntroContact | null> {
  const profile = await getDbProfileById(db, targetProfileId);
  if (!profile || profile.eligibility_status !== "eligible") return null;
  const contact = buildVisibleContact(
    fromDbContactSettings(profile as Record<string, unknown>),
  );
  return AcceptedIntroContactSchema.parse({
    profileId: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    email: contact.email,
    phone: contact.phone,
    websiteUrl: contact.websiteUrl,
    socialLinks: contact.socialLinks,
  });
}

export function isTestPairCurrentlyEligible(
  input: IntroRequestDeps,
  request: IntroRequest,
) {
  const author = findTestProfileById(
    input.profileTestState,
    request.authorProfileId,
  );
  const publisher = findTestProfileById(
    input.profileTestState,
    request.publisherProfileId,
  );
  const manuscript = input.manuscriptTestState.manuscripts.find(
    (item) => item.id === request.manuscriptId,
  );
  const sample = input.manuscriptTestState.documents.find(
    (item) => item.id === manuscript?.sampleDocumentId,
  );
  return Boolean(
    author?.profile.eligibilityStatus === "eligible" &&
    publisher?.profile.eligibilityStatus === "eligible" &&
    manuscript?.eligibilityStatus === "eligible" &&
    sample?.storageStatus === "uploaded" &&
    sample.processingStatus === "succeeded" &&
    sample.eligibilityStatus === "eligible",
  );
}

export async function isDbPairCurrentlyEligible(
  db: SupabaseClient,
  request: Record<string, unknown>,
) {
  const [author, publisher, manuscript] = await Promise.all([
    getDbProfileById(db, String(request.author_profile_id)),
    getDbProfileById(db, String(request.publisher_profile_id)),
    getDbManuscriptById(db, String(request.manuscript_id)),
  ]);
  const sample = manuscript?.sample_document_id
    ? await getDbDocumentById(db, manuscript.sample_document_id)
    : null;
  return Boolean(
    author?.eligibility_status === "eligible" &&
    publisher?.eligibility_status === "eligible" &&
    manuscript?.eligibility_status === "eligible" &&
    sample?.storage_status === "uploaded" &&
    sample.processing_status === "succeeded" &&
    sample.eligibility_status === "eligible",
  );
}
