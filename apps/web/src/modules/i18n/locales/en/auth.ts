export const auth = {
  login: {
    title: "Sign in to your account",
    subtitle:
      "Return with email and password or pick the provider you used last time.",
    email: "Email address",
    password: "Password",
    submit: "Sign in",
    noAccount: "Don't have an account?",
    signupLink: "Sign up",
    lastUsedPassword: "Last used: email and password",
    forgotPassword: "Forgot password?",
  },
  adminLogin: {
    title: "Admin console sign-in",
    subtitle:
      "Use the staff email and password provisioned for the admin console.",
    submit: "Sign in to admin",
    staffRedirect:
      "This is a staff account. Please use the admin console sign-in.",
    noAccess: "This account is not authorized for the admin console.",
    revoked:
      "This staff account is no longer allowed to use the admin console.",
    signOut: "Sign out",
    returnHome: "Return home",
    backToAdminLogin: "Back to admin sign-in",
  },
  adminMfa: {
    title: "Finish admin security check",
    enrollDescription:
      "Scan the code with an authenticator app, then enter the six-digit code to enable admin access.",
    verifyDescription:
      "Enter the six-digit code from your authenticator app to continue to the admin console.",
    qrAlt: "Authenticator app QR code",
    code: "Authenticator code",
    submit: "Verify and continue",
  },
  forgotPassword: {
    title: "Reset your password",
    description:
      "Enter your email address and we will send a password reset link if the account is eligible.",
    submit: "Send reset link",
    sent: "If this address is eligible, a password reset link has been sent.",
  },
  resetPassword: {
    title: "Choose a new password",
    description:
      "Enter a new password for this account, then continue back into the app.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    submit: "Update password",
    missingSession:
      "This reset link is missing or expired. Request a new password reset link and try again.",
  },
  signup: {
    title: "Create your account",
    subtitle:
      "Start with your account, then tell us how you want to appear in the marketplace.",
    email: "Email address",
    password: "Password",
    confirmPassword: "Confirm password",
    back: "Back",
    finish: "Finish setup",
    hasAccount: "Already have an account?",
    loginLink: "Sign in",
    stepCounter: "Step {{current}} of {{total}}",
    errors: {
      accountRequired: "Enter your email address and password to continue.",
      passwordTooShort: "Password must be at least 6 characters.",
      passwordMismatch: "Passwords do not match.",
    },
    accountStep: {
      signedInTitle: "Account already confirmed",
      signedInDescription:
        "You are signed in as {{email}}. Continue through the remaining setup steps to create your marketplace profile.",
    },
    roles: {
      author: {
        title: "Author",
        description:
          "Build a profile for manuscripts, genres, and submissions.",
      },
      publisher: {
        title: "Publisher",
        description: "Build a profile for editorial focus and discovery.",
      },
    },
    profileStep: {
      title: "Tell us about yourself",
      description:
        "Choose your marketplace role and add the identity details people will see first.",
      displayName: "Display name",
      displayNamePlaceholder: "Name shown during discovery",
      photoAlt: "Profile preview",
      photoHint: "Paste a public profile photo URL, or skip it for now.",
      photoInput: "Profile photo URL",
      photoLabel: "Profile photo",
      photoPlaceholder: "https://example.com/photo.png",
    },
    intentStep: {
      title: "Why are you planning to use this app?",
      description: {
        author:
          "Pick the reason that best matches how you want to use the platform first.",
        publisher:
          "Pick the reason that best matches how your team wants to use the platform first.",
      },
      question: {
        author: "Why are you planning to use this app?",
        publisher: "Why is your team planning to use this app?",
      },
      help: {
        author:
          "We’ll use this to shape the next profile fields and future product guidance.",
        publisher:
          "We’ll use this to shape the next profile fields and future product guidance.",
      },
    },
    intentOptions: {
      find_publisher: "Find a publisher for my work",
      compare_publishers: "Compare publishers and editorial fit",
      prepare_submission: "Prepare submissions more clearly",
      discover_manuscripts: "Discover manuscripts worth reviewing",
      source_authors: "Source authors for our list",
      manage_submissions: "Manage our incoming submission pipeline",
    },
    aside: {
      kicker: "Profile-first signup",
      title: "Set up the account your future profile will grow from.",
      description:
        "We’re keeping the first slice focused: account creation now, richer profile editing next.",
      cardTitle: "What you’ll get right away",
      cardBody:
        "A saved marketplace identity, a clear role, and a profile home you can return to after signup.",
      footer: {
        one: "Auth",
        two: "Profile",
        three: "Discovery",
      },
    },
  },
  social: {
    google: "Continue with Google",
    facebook: "Continue with Facebook",
    lastUsed: "Last used",
    orEmail: "Or continue with email",
    unavailable: "{{provider}} is not available right now.",
  },
  checkEmail: {
    title: "Check your email",
    fromSignup:
      "Your account was created. We sent a confirmation link to your email address. Open it, confirm your account, then come back and sign in.",
    fromLogin:
      "This account exists, but the email address has not been confirmed yet. Confirm your email first, then sign in again.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    resendButton: "Resend confirmation email",
    resentSuccess:
      "A new confirmation email has been sent if this address is eligible.",
    backToLogin: "Back to sign in",
    useDifferentEmail: "Need to use a different email?",
    createAnotherAccount: "Create another account",
    emailRequired: "Enter your email address to resend the confirmation email.",
  },
  signOut: "Sign out",
  callback: {
    title: "Finishing sign-in",
    description:
      "We’re preparing your session and deciding where to send you next.",
    genericError:
      "We couldn't finish the social sign-in flow. Please try again.",
    backToLogin: "Back to sign in",
  },
  errors: {
    invalidCredentials: "Invalid email or password",
    emailNotConfirmed: "Please confirm your email address before signing in.",
    emailRateLimited:
      "We couldn't send another confirmation email yet. Please wait a few minutes and try again.",
    emailDeliveryFailed:
      "We couldn't send the email. Check auth email delivery settings and sender domain verification.",
    generic: "Something went wrong. Please try again.",
  },
};
