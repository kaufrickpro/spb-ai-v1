import type { AuthDependencies } from "../auth/requestAuth.js";
import type { BillingTestState } from "../billing/testState.js";
import type { EmailTestState } from "../email/testState.js";
import type { IntroRequestTestState } from "../introRequests/testState.js";
import type { ManuscriptTestState } from "../manuscripts/testState.js";
import type { ProfileTestState } from "../profiles/testState.js";
import type { AdminTestState } from "./testState.js";

export type RegisterAdminRoutesOptions = {
  auth: AuthDependencies;
  billingTestState: BillingTestState;
  emailTestState: EmailTestState;
  introTestState: IntroRequestTestState;
  manuscriptTestState: ManuscriptTestState;
  profileTestState: ProfileTestState;
  testState: AdminTestState;
};
