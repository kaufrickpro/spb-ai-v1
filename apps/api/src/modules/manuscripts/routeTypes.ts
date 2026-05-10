import type { AuthDependencies } from "../auth/requestAuth.js";
import type { AdminTestState } from "../admin/testState.js";
import type { BillingTestState } from "../billing/testState.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import type { MatchingTestState } from "../matching/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { ManuscriptTestState } from "./testState.js";

export type RegisterManuscriptRoutesOptions = {
  adminTestState: AdminTestState;
  auth: AuthDependencies;
  billingTestState: BillingTestState;
  introTestState?: IntroRequestTestState;
  matchingTestState?: MatchingTestState;
  profileTestState: ProfileTestState;
  testState: ManuscriptTestState;
};
