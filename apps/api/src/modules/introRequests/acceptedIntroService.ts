import type { AcceptedIntroContact } from "@marketplace/contracts";
import type { AuthenticatedUser } from "../auth/verifyJwt.js";
import {
  findTestProfileById,
  findTestProfileByUserId,
} from "../profiles/testState.js";
import {
  buildTestAcceptedContact,
  getDbAcceptedContact,
  isDbPairCurrentlyEligible,
  isTestPairCurrentlyEligible,
} from "./acceptedIntroAccess.js";
import { getDbIntroState } from "./introState.js";
import { requestIncludesViewer } from "./introReadModels.js";
import { createIntroDb, getDbViewerProfile } from "./repository.js";
import type { DocumentRecord, IntroRequestDeps } from "./types.js";

export async function getAcceptedIntroContactForProfile(
  input: IntroRequestDeps & {
    targetProfileId: string;
    user: AuthenticatedUser;
  },
): Promise<AcceptedIntroContact | null> {
  if (input.config.authMode === "test") {
    const viewer = findTestProfileByUserId(
      input.profileTestState,
      input.user.userId,
    );
    const target = findTestProfileById(
      input.profileTestState,
      input.targetProfileId,
    );
    if (!viewer || !target) return null;
    const request = input.introTestState.requests.find(
      (item) =>
        item.status === "accepted" &&
        requestIncludesViewer(item, viewer.profile.id) &&
        requestIncludesViewer(item, target.profile.id),
    );
    if (!request || !isTestPairCurrentlyEligible(input, request)) return null;
    return buildTestAcceptedContact(input, target.profile.id);
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer) return null;
  const { data, error } = await db
    .from("intro_requests")
    .select()
    .eq("status", "accepted")
    .or(
      `and(author_profile_id.eq.${viewer.id},publisher_profile_id.eq.${input.targetProfileId}),and(publisher_profile_id.eq.${viewer.id},author_profile_id.eq.${input.targetProfileId})`,
    )
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (!(await isDbPairCurrentlyEligible(db, row))) return null;
  return getDbAcceptedContact(db, input.targetProfileId);
}

export async function canPublisherDownloadAcceptedIntroSample(
  input: IntroRequestDeps & {
    documentId: string;
    user: AuthenticatedUser;
  },
) {
  if (input.config.authMode === "test") {
    const viewer = findTestProfileByUserId(
      input.profileTestState,
      input.user.userId,
    );
    if (!viewer || viewer.profile.role !== "publisher") return null;
    const document = input.manuscriptTestState.documents.find(
      (item) => item.id === input.documentId,
    );
    if (!document) return null;
    const manuscript = input.manuscriptTestState.manuscripts.find(
      (item) =>
        item.id === document.manuscriptId &&
        item.sampleDocumentId === document.id,
    );
    if (
      !manuscript ||
      manuscript.eligibilityStatus !== "eligible" ||
      document.storageStatus !== "uploaded" ||
      document.processingStatus !== "succeeded" ||
      document.eligibilityStatus !== "eligible"
    ) {
      return null;
    }
    const request = input.introTestState.requests.find(
      (item) =>
        item.status === "accepted" &&
        item.manuscriptId === manuscript.id &&
        item.publisherProfileId === viewer.profile.id,
    );
    return request ? document : null;
  }

  const db = createIntroDb(input.config);
  const viewer = await getDbViewerProfile(db, input.user.userId);
  if (!viewer || viewer.role !== "publisher") return null;
  const { data, error } = await db
    .from("documents")
    .select()
    .eq("id", input.documentId)
    .maybeSingle();
  if (error || !data) return null;
  const document = data as DocumentRecord;
  if (
    document.storage_status !== "uploaded" ||
    document.processing_status !== "succeeded" ||
    document.eligibility_status !== "eligible"
  ) {
    return null;
  }
  const { data: manuscript } = await db
    .from("manuscripts")
    .select("id, sample_document_id, eligibility_status")
    .eq("id", document.manuscript_id)
    .maybeSingle();
  if (
    !manuscript ||
    manuscript.sample_document_id !== document.id ||
    manuscript.eligibility_status !== "eligible"
  ) {
    return null;
  }
  const state = await getDbIntroState(db, {
    manuscriptId: document.manuscript_id,
    publisherProfileId: viewer.id,
    viewerProfileId: viewer.id,
  });
  return state.status === "accepted" ? document : null;
}
