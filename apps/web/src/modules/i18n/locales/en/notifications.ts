export const notifications = {
  kicker: "Notification center",
  title: "Notifications",
  preview: "Latest notifications",
  viewAll: "View all",
  loading: "Loading notifications",
  error: "Notifications could not load",
  empty: "No notifications yet",
  markRead: "Mark read",
  markAllRead: "Mark all read",
  nextPage: "Next page",
  systemActor: "Smart Publishing Bridge",
  genericTarget: "your workspace",
  filters: {
    all: "All",
    unread: "Unread",
  },
  types: {
    intro_request_created: {
      title: "New intro request",
      body: "{{actor}} sent an intro request for {{target}}.",
    },
    intro_request_accepted: {
      title: "Intro request accepted",
      body: "{{actor}} accepted the intro request for {{target}}.",
    },
    intro_request_rejected: {
      title: "Intro request updated",
      body: "The intro request for {{target}} was updated.",
    },
    intro_request_cancelled: {
      title: "Intro request cancelled",
      body: "The intro request for {{target}} was cancelled.",
    },
    profile_approved: {
      title: "Profile approved",
      body: "Your profile decision was updated.",
    },
    profile_rejected: {
      title: "Profile needs attention",
      body: "Your profile decision was updated.",
    },
    profile_quarantined: {
      title: "Profile under review",
      body: "Your profile decision was updated.",
    },
    manuscript_approved: {
      title: "Manuscript approved",
      body: "{{target}} is ready.",
    },
    manuscript_rejected: {
      title: "Manuscript needs attention",
      body: "{{target}} needs attention.",
    },
    manuscript_quarantined: {
      title: "Manuscript under review",
      body: "{{target}} is under review.",
    },
  },
};
