import { app } from "./tr/app";
import { nav } from "./tr/nav";
import { appNav } from "./tr/appNav";
import { billing } from "./tr/billing";
import { pricing } from "./tr/pricing";
import { notifications } from "./tr/notifications";
import { adminNav } from "./tr/adminNav";
import { auth } from "./tr/auth";
import { common } from "./tr/common";
import { publicPublishers } from "./tr/publicPublishers";
import { matchProfiles } from "./tr/matchProfiles";
import { requests } from "./tr/requests";
import { introActions } from "./tr/introActions";
import { marketing } from "./tr/marketing";
import { legal } from "./tr/legal";
import { dashboard } from "./tr/dashboard";
import { appPages } from "./tr/appPages";
import { matches } from "./tr/matches";
import { profileHistory } from "./tr/profileHistory";
import { profile } from "./tr/profile";
import { manuscripts } from "./tr/manuscripts";
import { admin } from "./tr/admin";
import { adminPages } from "./tr/adminPages";
import { adminAccess } from "./tr/adminAccess";
import { onboarding } from "./tr/onboarding";
import { status } from "./tr/status";

export const tr = {
  app,
  nav,
  appNav,
  billing,
  pricing,
  notifications,
  adminNav,
  auth,
  common,
  publicPublishers,
  matchProfiles,
  requests,
  introActions,
  marketing,
  legal,
  dashboard,
  appPages,
  matches,
  profileHistory,
  profile,
  manuscripts,
  admin,
  adminPages,
  adminAccess,
  onboarding,
  status,
} as const;
