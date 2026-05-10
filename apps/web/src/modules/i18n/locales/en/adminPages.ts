export const adminPages = {
  reviews: {
    description:
      "The full review queue view will be expanded here with filtering, assignment, and advanced moderation controls.",
  },
  users: {
    description:
      "User administration, approvals, and permission history will be managed from this section.",
  },
  manuscripts: {
    description:
      "Manuscript moderation and compliance checks will be grouped here for operations teams.",
  },
  publishers: {
    description:
      "Publisher profile oversight and change-request workflows will be handled from this page.",
  },
  jobs: {
    description:
      "Background job status, retries, and failures will be monitored from this section.",
  },
  payments: {
    description:
      "Payment callbacks, failure investigation, and reconciliation tools will live on this page.",
  },
  auditLogs: {
    description:
      "Security and operations audit entries will be searchable and filterable here.",
  },
  settings: {
    description:
      "Review staff access posture, MFA readiness, and the operating rules for the admin workspace.",
    identity: {
      title: "Admin identity",
      email: "Signed-in email",
      access: "Access status",
      mfa: "Multi-factor authentication",
      mfaVerified: "MFA verified for this session",
      mfaRequired: "MFA is required before sensitive admin work",
    },
    policy: {
      title: "Operating rules",
      separateAccounts:
        "Admin access is reserved for separate staff accounts, not marketplace user profiles.",
      mfa: "Every admin session must satisfy MFA before protected routes are usable.",
      audit:
        "All moderation and operational mutations must create audit history.",
      notes:
        "Sensitive actions require explicit notes so reviews and incidents stay explainable.",
    },
    session: {
      title: "Session",
      description:
        "Use this control to sign out of the admin workspace on this device.",
    },
  },
};
