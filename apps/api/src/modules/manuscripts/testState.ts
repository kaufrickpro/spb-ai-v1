import { randomUUID } from "node:crypto";
import {
  type Manuscript,
  type Document,
  type CreateManuscriptRequest,
  type UpdateManuscriptRequest,
  type ManuscriptAccessRequest,
  ManuscriptSchema,
  DocumentSchema,
  ManuscriptAccessRequestSchema,
} from "@marketplace/contracts";
import {
  TEST_OTHER_AUTHOR_USER_ID,
  TEST_PUBLISHER_USER_ID,
  TEST_USER_ID,
} from "../auth/requestAuth.js";

// ─── In-memory test fixtures for manuscript/document routes ──────────────────

export const TEST_AUTHOR_MANUSCRIPT_ID = "10000000-0000-4000-8000-000000000001";
export const TEST_AUTHOR_MANUSCRIPT_DOCUMENT_ID =
  "10000000-0000-4000-8000-000000000002";
export const TEST_OTHER_AUTHOR_MANUSCRIPT_ID =
  "10000000-0000-4000-8000-000000000003";

export type ManuscriptTestState = {
  manuscripts: Manuscript[];
  documents: Document[];
  accessRequests: ManuscriptAccessRequest[];
};

export function createManuscriptTestState(): ManuscriptTestState {
  const now = new Date("2026-05-01T09:00:00.000Z").toISOString();

  return {
    manuscripts: [
      ManuscriptSchema.parse({
        id: TEST_AUTHOR_MANUSCRIPT_ID,
        authorId: TEST_USER_ID,
        title: "Gece Yarısı Şehri",
        genre: "Distopya",
        language: "tr",
        wordCount: 80000,
        synopsis: "İstanbul'un yakın geleceğinde geçen bir distopya romanı.",
        targetAgeMin: 18,
        targetAgeMax: null,
        logline: "A near-future city story about memory and power.",
        subgenres: ["Spekülatif"],
        audienceCategories: ["adult"],
        manuscriptForm: "novel",
        compTitles: ["1984"],
        declaredThemes: ["memory", "power"],
        declaredContentWarnings: ["state violence"],
        arcSummary: "A journalist follows the trail of erased city records.",
        chapterSummaries: [],
        shortTeaser: null,
        requestable: false,
        status: "draft",
        adminReviewStatus: "not_submitted",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
        sampleDocumentId: null,
        createdAt: now,
        updatedAt: now,
      }),
      ManuscriptSchema.parse({
        id: TEST_OTHER_AUTHOR_MANUSCRIPT_ID,
        authorId: TEST_OTHER_AUTHOR_USER_ID,
        title: "Başka Bir Hikâye",
        genre: "Roman",
        language: "tr",
        wordCount: 55000,
        synopsis: "Başka yazara ait örnek manuskript.",
        targetAgeMin: 16,
        targetAgeMax: null,
        logline: "A family secret reshapes a young writer's life.",
        subgenres: ["Aile"],
        audienceCategories: ["adult"],
        manuscriptForm: "novel",
        compTitles: [],
        declaredThemes: ["family"],
        declaredContentWarnings: [],
        arcSummary: "A quiet inheritance reveals an old literary betrayal.",
        chapterSummaries: [],
        shortTeaser: "A family literary secret, revealed carefully.",
        requestable: true,
        status: "draft",
        adminReviewStatus: "not_submitted",
        eligibilityStatus: "eligible",
        reviewOutcome: "auto_approved",
        sampleDocumentId: null,
        createdAt: now,
        updatedAt: now,
      }),
    ],
    documents: [],
    accessRequests: [],
  };
}

export function isTestAuthorUser(userId: string): boolean {
  return userId === TEST_USER_ID || userId === TEST_OTHER_AUTHOR_USER_ID;
}

export function isTestPublisherUser(userId: string): boolean {
  return userId === TEST_PUBLISHER_USER_ID;
}

// ─── Test-mode service functions ──────────────────────────────────────────────

export function listTestManuscripts(
  state: ManuscriptTestState,
  authorId: string,
): Manuscript[] {
  return state.manuscripts.filter((m) => m.authorId === authorId);
}

export function getTestManuscript(
  state: ManuscriptTestState,
  id: string,
  authorId: string,
): Manuscript | null {
  return (
    state.manuscripts.find((m) => m.id === id && m.authorId === authorId) ??
    null
  );
}

export function createTestManuscript(
  state: ManuscriptTestState,
  authorId: string,
  input: CreateManuscriptRequest,
): Manuscript {
  const now = new Date().toISOString();
  const manuscript = ManuscriptSchema.parse({
    id: randomUUID(),
    authorId,
    title: input.title,
    genre: input.genre,
    language: input.language,
    wordCount: input.wordCount ?? null,
    synopsis: input.synopsis ?? null,
    targetAgeMin: input.targetAgeMin ?? null,
    targetAgeMax: input.targetAgeMax ?? null,
    logline: input.logline ?? null,
    subgenres: input.subgenres ?? [],
    audienceCategories: input.audienceCategories ?? [],
    manuscriptForm: input.manuscriptForm ?? null,
    compTitles: input.compTitles ?? [],
    declaredThemes: input.declaredThemes ?? [],
    declaredContentWarnings: input.declaredContentWarnings ?? [],
    arcSummary: input.arcSummary ?? null,
    chapterSummaries: input.chapterSummaries ?? [],
    shortTeaser: input.shortTeaser ?? null,
    requestable: input.requestable ?? false,
    status: "draft",
    adminReviewStatus: "not_submitted",
    eligibilityStatus: "eligible",
    reviewOutcome: "auto_approved",
    sampleDocumentId: null,
    createdAt: now,
    updatedAt: now,
  });
  state.manuscripts.push(manuscript);
  return manuscript;
}

export function updateTestManuscript(
  state: ManuscriptTestState,
  id: string,
  authorId: string,
  input: UpdateManuscriptRequest,
): Manuscript | null {
  const index = state.manuscripts.findIndex(
    (m) => m.id === id && m.authorId === authorId,
  );
  if (index < 0) return null;

  const existing = state.manuscripts[index];
  const updated = ManuscriptSchema.parse({
    ...existing,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.genre !== undefined && { genre: input.genre }),
    ...(input.language !== undefined && { language: input.language }),
    ...(input.wordCount !== undefined && { wordCount: input.wordCount }),
    ...(input.synopsis !== undefined && { synopsis: input.synopsis }),
    ...(input.targetAgeMin !== undefined && {
      targetAgeMin: input.targetAgeMin,
    }),
    ...(input.targetAgeMax !== undefined && {
      targetAgeMax: input.targetAgeMax,
    }),
    ...(input.logline !== undefined && { logline: input.logline }),
    ...(input.subgenres !== undefined && { subgenres: input.subgenres }),
    ...(input.audienceCategories !== undefined && {
      audienceCategories: input.audienceCategories,
    }),
    ...(input.manuscriptForm !== undefined && {
      manuscriptForm: input.manuscriptForm,
    }),
    ...(input.compTitles !== undefined && {
      compTitles: input.compTitles,
    }),
    ...(input.declaredThemes !== undefined && {
      declaredThemes: input.declaredThemes,
    }),
    ...(input.declaredContentWarnings !== undefined && {
      declaredContentWarnings: input.declaredContentWarnings,
    }),
    ...(input.arcSummary !== undefined && { arcSummary: input.arcSummary }),
    ...(input.chapterSummaries !== undefined && {
      chapterSummaries: input.chapterSummaries,
    }),
    ...(input.shortTeaser !== undefined && { shortTeaser: input.shortTeaser }),
    ...(input.requestable !== undefined && { requestable: input.requestable }),
    updatedAt: new Date().toISOString(),
  });

  state.manuscripts[index] = updated;
  return updated;
}

export function createTestManuscriptAccessRequest(
  state: ManuscriptTestState,
  input: Omit<ManuscriptAccessRequest, "id" | "createdAt" | "updatedAt">,
): ManuscriptAccessRequest {
  const now = new Date().toISOString();
  const request = ManuscriptAccessRequestSchema.parse({
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
  state.accessRequests.push(request);
  return request;
}

export function updateTestManuscriptAccessRequestStatus(
  state: ManuscriptTestState,
  requestId: string,
  status: "approved" | "rejected",
): ManuscriptAccessRequest | null {
  const index = state.accessRequests.findIndex((item) => item.id === requestId);
  if (index < 0) return null;

  const updated = ManuscriptAccessRequestSchema.parse({
    ...state.accessRequests[index],
    status,
    updatedAt: new Date().toISOString(),
  });
  state.accessRequests[index] = updated;
  return updated;
}

export function createTestDocument(
  state: ManuscriptTestState,
  documentId: string,
  uploadId: string,
  manuscriptId: string,
  authorId: string,
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
): Document {
  const now = new Date().toISOString();

  const doc = DocumentSchema.parse({
    id: documentId,
    manuscriptId,
    authorId,
    originalFileName: fileName,
    mimeType,
    fileSizeBytes,
    storageStatus: "pending_upload",
    processingStatus: "not_started",
    adminReviewStatus: "not_submitted",
    eligibilityStatus: "limited",
    reviewOutcome: "needs_review",
    uploadId,
    retentionExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  });

  state.documents.push(doc);
  return doc;
}

export function completeTestDocumentUpload(
  state: ManuscriptTestState,
  documentId: string,
  authorId: string,
): Document | null {
  const index = state.documents.findIndex(
    (d) => d.id === documentId && d.authorId === authorId,
  );
  if (index < 0) return null;

  const updated = DocumentSchema.parse({
    ...state.documents[index],
    storageStatus: "uploaded",
    processingStatus: "queued",
    processingFailureCode: null,
    eligibilityStatus: "limited",
    reviewOutcome: "needs_review",
    updatedAt: new Date().toISOString(),
  });

  state.documents = state.documents.map((document) =>
    document.manuscriptId === updated.manuscriptId &&
    document.id !== updated.id &&
    document.storageStatus === "uploaded"
      ? DocumentSchema.parse({
          ...document,
          storageStatus: "pending_delete",
          updatedAt: new Date().toISOString(),
        })
      : document,
  );
  state.documents[index] = updated;

  // Link to manuscript as sample document
  const mIndex = state.manuscripts.findIndex(
    (m) => m.id === updated.manuscriptId,
  );
  if (mIndex >= 0) {
    state.manuscripts[mIndex] = ManuscriptSchema.parse({
      ...state.manuscripts[mIndex],
      sampleDocumentId: documentId,
      updatedAt: new Date().toISOString(),
    });
  }

  return updated;
}

export function getTestDocument(
  state: ManuscriptTestState,
  documentId: string,
  authorId: string,
): Document | null {
  return (
    state.documents.find(
      (d) => d.id === documentId && d.authorId === authorId,
    ) ?? null
  );
}

export function getAnyTestDocument(
  state: ManuscriptTestState,
  documentId: string,
): Document | null {
  return state.documents.find((document) => document.id === documentId) ?? null;
}

export function setTestManuscriptReviewStatus(
  state: ManuscriptTestState,
  manuscriptId: string,
  decision: "approved" | "rejected",
  now: string,
): void {
  const index = state.manuscripts.findIndex(
    (manuscript) => manuscript.id === manuscriptId,
  );
  if (index < 0) {
    return;
  }

  const current = state.manuscripts[index];
  state.manuscripts[index] = ManuscriptSchema.parse({
    ...current,
    adminReviewStatus: decision,
    eligibilityStatus: decision === "approved" ? "eligible" : "blocked",
    reviewOutcome:
      decision === "approved" ? "admin_approved" : "admin_rejected",
    status: decision === "approved" ? "approved" : "rejected",
    updatedAt: now,
  });
}

export function setTestDocumentReviewStatus(
  state: ManuscriptTestState,
  documentId: string,
  decision: "approved" | "rejected",
  now: string,
): void {
  const index = state.documents.findIndex(
    (document) => document.id === documentId,
  );
  if (index < 0) {
    return;
  }

  const current = state.documents[index];
  state.documents[index] = DocumentSchema.parse({
    ...current,
    adminReviewStatus: decision,
    eligibilityStatus: decision === "approved" ? "eligible" : "blocked",
    reviewOutcome:
      decision === "approved" ? "admin_approved" : "admin_rejected",
    updatedAt: now,
  });
}
