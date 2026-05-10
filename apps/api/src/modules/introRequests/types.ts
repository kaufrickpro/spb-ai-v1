import type { ApiConfig } from "../config/config.js";
import type { BillingTestState } from "../billing/testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { MatchingTestState } from "../matching/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { IntroRequestTestState } from "./testState.js";

export type ProfileRecord = {
  id: string;
  user_id: string;
  role: "author" | "publisher";
  display_name: string;
  eligibility_status: string;
  public_contact_email?: string | null;
  public_phone?: string | null;
  website_url?: string | null;
  social_links?: unknown[];
  contact_visibility?: Record<string, unknown> | null;
};

export type ManuscriptRecord = {
  id: string;
  author_id: string;
  title: string;
  eligibility_status: string;
  sample_document_id: string | null;
};

export type DocumentRecord = {
  id: string;
  manuscript_id: string;
  author_id: string;
  original_file_name: string;
  mime_type: string;
  upload_id: string;
  storage_status: string;
  processing_status: string;
  eligibility_status: string;
};

export type PairContext = {
  authorProfile: ProfileRecord;
  manuscript: ManuscriptRecord;
  publisherProfile: ProfileRecord;
  requesterProfile: ProfileRecord;
  recipientProfile: ProfileRecord;
  sampleDocument: DocumentRecord | null;
};

export const profileSelectColumns =
  "id,user_id,role,display_name,eligibility_status,public_contact_email,public_phone,website_url,social_links,contact_visibility";

export type IntroRequestDeps = {
  billingTestState?: BillingTestState;
  config: ApiConfig;
  introTestState: IntroRequestTestState;
  manuscriptTestState: ManuscriptTestState;
  matchingTestState: MatchingTestState;
  profileTestState: ProfileTestState;
};
