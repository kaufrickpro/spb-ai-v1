import i18next from "i18next";
import { initReactI18next } from "react-i18next";

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  fallbackLng: "tr",
  interpolation: {
    escapeValue: false,
  },
  lng: "tr",
  resources: {
    en: {
      translation: {
        app: {
          kicker: "SPB-AI",
          title: "Publisher and Author Marketplace",
          titleShort: "Smart Publishing Bridge",
        },
        nav: {
          home: "Home",
          publishers: "Publishers",
          authors: "Authors",
          features: "Main Features",
          editorial: "Editorial",
          works: "Works",
          pricing: "Pricing",
          login: "Login",
          signup: "Sign up",
          dashboard: "Dashboard",
          admin: "Admin",
          search: "Search",
          openMenu: "Open menu",
          closeMenu: "Close menu",
          menu: "Menu",
          platformLabel: "Platform navigation",
        },
        appNav: {
          dashboard: "Dashboard",
          manuscripts: "Projects",
          matches: "Matches",
          requests: "Requests",
          billing: "Billing",
          profile: "Profile",
          settings: "Settings",
          notifications: "Notifications",
          accountFallback: "Account",
        },
        adminNav: {
          dashboard: "Admin Dashboard",
          reviews: "Reviews",
          trustSafety: "Trust & Safety",
          jobs: "Jobs",
          payments: "Payments",
          auditLogs: "Audit Logs",
          settings: "Settings",
        },
        auth: {
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
              accountRequired:
                "Enter your email address and password to continue.",
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
                description:
                  "Build a profile for editorial focus and discovery.",
              },
            },
            profileStep: {
              title: "Tell us about yourself",
              description:
                "Choose your marketplace role and add the identity details people will see first.",
              displayName: "Display name",
              displayNamePlaceholder: "Name shown during discovery",
              photoAlt: "Profile preview",
              photoHint:
                "Paste a public profile photo URL, or skip it for now.",
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
            emailRequired:
              "Enter your email address to resend the confirmation email.",
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
            emailNotConfirmed:
              "Please confirm your email address before signing in.",
            emailRateLimited:
              "We couldn't send another confirmation email yet. Please wait a few minutes and try again.",
            emailDeliveryFailed:
              "We couldn't send the email. Check auth email delivery settings and sender domain verification.",
            generic: "Something went wrong. Please try again.",
          },
        },
        common: {
          continue: "Continue",
          loading: "Loading…",
          retry: "Retry",
        },
        marketing: {
          home: {
            eyebrow: "Discovery platform for publishing",
            title:
              "A simple starting point for authors and publishers to meet.",
            description:
              "Create your account, complete your profile, and prepare for structured discovery between authors and publishers.",
            primaryCta: "Get started",
            secondaryCta: "Log in",
          },
          section: {
            eyebrow: "Platform section",
            title: "{{section}}",
            description:
              "{{section}} will expand as the platform adds deeper workflows and discovery tools.",
          },
        },
        dashboard: {
          title: "Dashboard",
          welcome: "Signed in as",
          adminReady:
            "Your account has admin access. Use the admin panel to review operations and moderation work.",
          openAdmin: "Open admin panel",
          pendingApproval:
            "Approval is only required before your profile appears in discovery. Your basic profile is already saved.",
          openManuscripts: "Open projects",
          backToDashboard: "Back to dashboard",
          cards: {
            manuscripts: {
              title: "Manage manuscripts",
              description:
                "Create, review, and update your manuscript records.",
            },
            matches: {
              title: "Check matches",
              description:
                "Review current and upcoming publisher match results.",
            },
            requests: {
              title: "Handle requests",
              description: "Track intro requests you sent and received.",
            },
            billing: {
              title: "Billing and plan",
              description:
                "Manage your active subscription and payment events.",
            },
          },
        },
        appPages: {
          matches: {
            description:
              "Match runs and candidate insights will appear here once matching workflows are enabled for your account.",
          },
          requests: {
            description:
              "This page will list sent and received introduction requests with their latest statuses.",
          },
          billing: {
            description:
              "Billing overview, plan details, and payment events will be managed from this page.",
          },
          profile: {
            description:
              "Profile details and account preferences will live here as we expand onboarding fields.",
          },
          settings: {
            description:
              "Workspace and account-level settings will be configured from this section.",
          },
        },
        profile: {
          pageTitle: "Your profile",
          pageDescription:
            "This is the basic profile home for your account. Richer editing comes in the next slice.",
          roles: {
            author: "Author",
            publisher: "Publisher",
          },
          eligibilityStatus: {
            eligible: "Eligible",
            limited: "Limited",
            blocked: "Blocked",
            quarantined: "Quarantined",
          },
          signupIntent: {
            find_publisher: "Find a publisher for my work",
            compare_publishers: "Compare publishers and editorial fit",
            prepare_submission: "Prepare submissions more clearly",
            discover_manuscripts: "Discover manuscripts worth reviewing",
            source_authors: "Source authors for our list",
            manage_submissions: "Manage our incoming submission pipeline",
          },
          summary: {
            role: "Role",
            intent: "Current intent",
            status: "Approval status",
          },
          fields: {
            displayName: "Display name",
            role: "Role",
            photo: "Profile photo",
            photoFallback: "No photo yet",
            intent: "Why you joined",
          },
          placeholder: {
            title: "Profile editing is the next slice",
            description:
              "Your account has been created and the first profile details are saved. We’ll turn this page into the full profile editor next.",
            nextStep:
              "Next we’ll add richer author and publisher profile sections, editing controls, and better completion guidance.",
          },
        },
        manuscripts: {
          nav: "Manuscripts",
          pageTitle: "My Manuscripts",
          pageSubtitle:
            "Manage your manuscript metadata and sample file uploads.",
          forbidden: {
            title: "Author access required",
            description:
              "This workspace is only available to author accounts in Step 8.",
          },
          createCta: "New manuscript",
          openCta: "Open",
          empty: "You have no manuscripts yet. Create your first one.",
          sections: {
            overview: "Overview",
            list: "Manuscript list",
          },
          summary: {
            total: "Total manuscripts",
            withSample: "Samples added",
            eligible: "Eligible",
          },
          sampleStatus: {
            added: "Sample added",
            missing: "No sample",
          },
          table: {
            title: "Title",
            genre: "Genre",
            language: "Language",
            status: "Status",
            sample: "Sample",
            eligibility: "Eligibility",
            words: "Words",
            actions: "Actions",
          },
          status: {
            draft: "Draft",
            submitted: "Submitted",
            under_review: "Under review",
            approved: "Approved",
            rejected: "Rejected",
            archived: "Archived",
          },
          eligibilityStatus: {
            eligible: "Eligible",
            limited: "Limited",
            blocked: "Blocked",
            quarantined: "Quarantined",
          },
          form: {
            title: "Title",
            titlePlaceholder: "Manuscript title",
            genre: "Genre",
            genrePlaceholder: "e.g. Literary fiction, Fantasy, Mystery",
            language: "Language",
            wordCount: "Word count",
            synopsis: "Synopsis",
            synopsisPlaceholder: "Short description (max 2000 characters)",
            targetAgeMin: "Min target age",
            targetAgeMax: "Max target age",
            save: "Save",
            saving: "Saving…",
            cancel: "Cancel",
            createTitle: "New manuscript",
            editTitle: "Edit manuscript",
          },
          detail: {
            backToList: "← Manuscripts",
            eligibility: "Eligibility",
            sampleDocument: "Sample document",
            noDocument: "No sample uploaded yet.",
            uploadCta: "Upload sample",
            replaceCta: "Replace sample",
            downloadCta: "Download sample",
            downloadingCta: "Preparing download…",
            downloadError: "Download failed. Please try again.",
            storageStatus: {
              pending_upload: "Awaiting upload",
              uploaded: "Uploaded",
              attached: "Attached",
              pending_delete: "Pending deletion",
              deleted: "Deleted",
            },
            processingStatus: {
              not_started: "Waiting for sample",
              queued: "Checking your sample",
              processing: "Checking your sample",
              succeeded: "Sample ready",
              failed: "We couldn't read this file",
            },
            processingFailure: {
              generic: "We couldn't read this file. Upload a different sample.",
              empty_extracted_text:
                "This file looks empty. Upload a different sample.",
              unsupported_file_type:
                "This file type is not supported yet. Upload a plain text sample.",
              file_type_mismatch:
                "This file does not match its selected type. Upload a different sample.",
              extracted_text_too_large:
                "This file is too large to check. Upload a shorter sample.",
              chunk_limit_exceeded:
                "This file is too long to check. Upload a shorter sample.",
              download_failed:
                "We couldn't open this file. Upload it again or choose a different sample.",
              parser_failed:
                "We couldn't read this file. Upload a different sample.",
              embedding_failed:
                "We couldn't finish checking this sample. Try again later or upload a different sample.",
              scanner_suspicious:
                "This file needs an extra safety check before it can be used.",
              unexpected_processing_error:
                "We couldn't finish checking this sample. Try again later.",
            },
          },
          upload: {
            dropzone:
              "Drop a PDF, DOCX, EPUB, or plain text file here, or click to browse.",
            maxSize: "Maximum file size: 25 MB",
            uploading: "Uploading…",
            success: "Upload complete. We're checking your sample now.",
            errorSize: "File exceeds the 25 MB limit.",
            errorType:
              "Unsupported file type. Accepted: PDF, DOCX, EPUB, plain text.",
            errorGeneric: "Upload failed. Please try again.",
          },
        },
        admin: {
          title: "Admin Operations Console",
          subtitle:
            "Watch exceptions, automation health, and audited override work without slowing the happy path.",
          quickNav: "Admin navigation",
          backToOverview: "Back to admin overview",
          accessStatuses: {
            no_access: "No admin access",
            mfa_required: "MFA required",
            allowed: "Admin access active",
            revoked: "Admin access revoked",
          },
          entityTypes: {
            profile: "Profile",
            manuscript: "Manuscript",
            document: "Document",
            publisher_change_request: "Publisher change request",
          },
          reviewStatuses: {
            pending: "Pending",
            approved: "Approved",
            rejected: "Rejected",
          },
          reviewFilters: {
            statusAll: "All statuses",
            queueAll: "All queues",
          },
          exceptionQueues: {
            needs_review: "Needs review",
            quarantine: "Quarantine",
            reports: "Reports",
            system_failures: "System failures",
          },
          eligibilityStatuses: {
            eligible: "Eligible",
            limited: "Limited",
            blocked: "Blocked",
            quarantined: "Quarantined",
          },
          reviewOutcomes: {
            auto_approved: "Auto-approved",
            needs_review: "Needs review",
            admin_approved: "Admin approved",
            admin_rejected: "Admin rejected",
            quarantined: "Quarantined",
          },
          riskLevels: {
            low: "Low",
            medium: "Medium",
            high: "High",
          },
          pendingProfiles: {
            title: "Pending profile approvals",
            subtitle:
              "Review newly onboarded author and publisher accounts before they can appear in discovery.",
            tableTitle: "Profiles waiting for review",
            count: "{{count}} pending",
            empty: "No profiles are waiting for approval.",
            approve: "Approve",
            approving: "Approving…",
            reject: "Reject",
            rejecting: "Rejecting…",
            columns: {
              name: "Name",
              role: "Role",
              locale: "Locale",
              submitted: "Submitted",
              actions: "Actions",
            },
            roles: {
              author: "Author",
              publisher: "Publisher",
            },
          },
          tabs: {
            all: "All reviews",
            profile: "Profiles",
            manuscript: "Manuscripts",
            document: "Documents",
            publisherChange: "Publisher change requests",
          },
          reviews: {
            title: "Exception workspace",
            subtitle:
              "Work through needs-review, quarantine, report, and system-failure exceptions.",
            count: "{{count}} exceptions",
          },
          forbidden: {
            title: "Admin access required",
            description:
              "Your account does not have admin privileges for this section.",
          },
          cards: {
            reviewQueue: "Needs review",
            highRisk: "{{count}} high-risk exceptions",
            quarantine: "Quarantine",
            reports: "Reports",
            systemFailures: "System failures",
            autoApprovalRate: "Auto-approval rate",
            jobs: "Jobs running",
            jobsQueued: "{{count}} queued",
            payments: "Payment failures",
            failures: "Recent failures",
            pendingProfiles: "Needs review",
            rejectedProfiles: "{{count}} blocked",
          },
          queue: {
            title: "Exception queue",
            entity: "Entity",
            status: "Status",
            queue: "Queue",
            eligibility: "Eligibility",
            outcome: "Outcome",
            risk: "Risk",
            submitted: "Submitted",
            action: "Action",
            open: "Open",
            empty: "No exceptions waiting for action.",
          },
          detail: {
            title: "Review detail",
            summary: "Summary",
            submittedFields: "Submitted fields",
            riskWarnings: "Risk warnings",
            relatedEvents: "Related events",
            auditHistory: "Audit history",
            rejectionNote: "Internal note",
            approve: "Approve",
            reject: "Reject",
            quarantine: "Quarantine",
            restore: "Restore",
            suspend: "Suspend",
            close: "Close",
            none: "No warnings.",
            empty: "Select a review to inspect details.",
          },
          jobs: {
            title: "Job health",
            type: "Job type",
            status: "Status",
            updated: "Updated",
            pageTitle: "Jobs health",
            pageDescription:
              "Read-only operational visibility into asynchronous job flow and recent failures.",
            summaryQueued: "Queued jobs",
            summaryRunning: "Running jobs",
            summaryFailed: "Failed jobs",
          },
          payments: {
            title: "Payment health",
            event: "Event",
            status: "Status",
            time: "Occurred",
            pageTitle: "Payment health",
            pageDescription:
              "Read-only visibility into recent payment events and operational failures.",
            summaryFailures: "Recent failures",
            summaryLastEvent: "Last payment event",
          },
          trust: {
            title: "Trust & safety signals",
            signal: "Signal",
            severity: "Severity",
            status: "Status",
            created: "Created",
            empty: "No open trust/safety signals.",
            pageTitle: "Trust & safety",
            pageDescription:
              "Review flagged profiles and open trust signals before they become product incidents.",
            pendingProfiles: "Pending profiles",
            flaggedProfiles: "Flagged profiles",
            rejectedProfiles: "Rejected profiles",
          },
          audit: {
            title: "Recent audit logs",
            action: "Action",
            target: "Target",
            when: "When",
            empty: "No audit entries yet.",
            actor: "Actor",
            pageTitle: "Audit logs",
            pageDescription:
              "Inspect admin decision history and operational activity with lightweight filtering.",
            filterAction: "Filter by action",
            filterTarget: "Filter by target type or id",
          },
          trustSignalTypes: {
            fraud_report: "Fraud report",
            policy_violation: "Policy violation",
            identity_mismatch: "Identity mismatch",
            spam: "Spam",
          },
          trustStatuses: {
            open: "Open",
            resolved: "Resolved",
          },
          jobTypes: {
            document_ingestion: "Document ingestion",
            matching: "Matching",
            billing_sync: "Billing sync",
            email_delivery: "Email delivery",
          },
          jobStatuses: {
            queued: "Queued",
            running: "Running",
            succeeded: "Succeeded",
            failed: "Failed",
          },
          paymentStatuses: {
            processed: "Processed",
            failed: "Failed",
            pending: "Pending",
          },
        },
        adminPages: {
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
        },
        adminAccess: {
          mfaRequired: {
            title: "Finish MFA to use the admin console",
            description:
              "This staff account has admin membership, but the current session has not satisfied the required multi-factor authentication step.",
          },
          revoked: {
            title: "Admin access has been revoked",
            description:
              "This staff account is no longer allowed to use the admin console. Contact another administrator if this is unexpected.",
          },
        },
        onboarding: {
          complete: "Complete profile",
          pageTitle: "Complete your profile",
          admin: {
            title: "Admin account",
            description:
              "Admin accounts do not create marketplace profiles. Use the admin console for review and operations work.",
          },
          blocked: {
            title: "We could not prepare onboarding",
            description:
              "We could not verify your account access. Refresh the page and try again.",
          },
          displayName: {
            label: "Display name",
            placeholder: "Name shown during discovery",
          },
          authorDetails: {
            title: "Author details",
            description:
              "Add just enough context for your first discovery-ready profile.",
            biography: {
              label: "Short bio",
              placeholder:
                "Describe the kinds of manuscripts, themes, or readers you focus on.",
            },
            primaryGenre: {
              label: "Primary genre",
            },
            writingLanguages: {
              label: "Writing languages",
            },
          },
          publisherDetails: {
            title: "Publisher preferences",
            description:
              "Capture the acquisition preferences publishers can share from day one.",
            focusGenres: {
              label: "Focus genres",
            },
            preferredLanguages: {
              label: "Preferred submission languages",
            },
            acceptsUnsolicited: {
              label: "Accept unsolicited submissions",
              description:
                "Show whether your team is open to receiving direct introduction requests.",
            },
          },
          role: {
            author: {
              description: "Create a profile for manuscripts and rights.",
              title: "Author",
            },
            description:
              "Start with the account role. Approval and richer profile fields come next.",
            publisher: {
              description: "Create a profile for lists, genres, and interests.",
              title: "Publisher",
            },
            title: "Choose your marketplace role",
          },
        },
        status: {
          apiBaseUrl: "API Base URL",
          apiError: "Health check failed",
          apiHealth: "API Health",
          apiLoading: "Checking health...",
          apiUnknown: "Unknown",
          auth: "Auth",
          authPending: "Supabase wiring comes in the first vertical slice.",
          title: "Scaffold status",
        },
      },
    },
    tr: {
      translation: {
        app: {
          kicker: "SPB-AI",
          title: "Yayıncı ve Yazar Pazaryeri",
          titleShort: "Smart Publishing Bridge",
        },
        nav: {
          home: "Ana sayfa",
          publishers: "Yayınevleri",
          authors: "Yazarlar",
          features: "Öne çıkanlar",
          editorial: "Editöryal",
          works: "Eserler",
          pricing: "Fiyatlandırma",
          login: "Giriş yap",
          signup: "Kayıt ol",
          dashboard: "Panel",
          admin: "Yönetim",
          search: "Ara",
          openMenu: "Menüyü aç",
          closeMenu: "Menüyü kapat",
          menu: "Menü",
          platformLabel: "Platform gezintisi",
        },
        appNav: {
          dashboard: "Panel",
          manuscripts: "Projeler",
          matches: "Eşleşmeler",
          requests: "Talepler",
          billing: "Faturalandırma",
          profile: "Profil",
          settings: "Ayarlar",
          notifications: "Bildirimler",
          accountFallback: "Hesap",
        },
        adminNav: {
          dashboard: "Yönetim Paneli",
          reviews: "İncelemeler",
          trustSafety: "Güvenlik",
          jobs: "İşler",
          payments: "Ödemeler",
          auditLogs: "Denetim Kayıtları",
          settings: "Ayarlar",
        },
        auth: {
          login: {
            title: "Hesabınıza giriş yapın",
            subtitle:
              "E-posta ve şifreyle giriş yapın veya geçen sefer kullandığınız sağlayıcıyı seçin.",
            email: "E-posta adresi",
            password: "Şifre",
            submit: "Giriş yap",
            noAccount: "Hesabınız yok mu?",
            signupLink: "Kayıt ol",
            lastUsedPassword: "Son kullanılan: e-posta ve şifre",
            forgotPassword: "Şifrenizi mi unuttunuz?",
          },
          adminLogin: {
            title: "Yönetici konsolu girişi",
            subtitle:
              "Yönetici konsolu için tanımlanan personel e-postası ve şifresini kullanın.",
            submit: "Yönetici girişi yap",
            staffRedirect:
              "Bu bir personel hesabı. Lütfen yönetici konsolu girişini kullanın.",
            noAccess: "Bu hesabın yönetici konsoluna erişim izni yok.",
            revoked: "Bu personel hesabı artık yönetici konsolunu kullanamaz.",
            signOut: "Çıkış yap",
            returnHome: "Ana sayfaya dön",
            backToAdminLogin: "Yönetici girişine dön",
          },
          adminMfa: {
            title: "Yönetici güvenlik adımını tamamlayın",
            enrollDescription:
              "Kodu bir doğrulama uygulamasıyla tarayın, ardından yönetici erişimini etkinleştirmek için altı haneli kodu girin.",
            verifyDescription:
              "Yönetici konsoluna devam etmek için doğrulama uygulamanızdaki altı haneli kodu girin.",
            qrAlt: "Doğrulama uygulaması QR kodu",
            code: "Doğrulama kodu",
            submit: "Doğrula ve devam et",
          },
          forgotPassword: {
            title: "Şifrenizi sıfırlayın",
            description:
              "E-posta adresinizi girin; hesap uygunsa şifre sıfırlama bağlantısı göndereceğiz.",
            submit: "Sıfırlama bağlantısı gönder",
            sent: "Bu adres uygunsa şifre sıfırlama bağlantısı gönderildi.",
          },
          resetPassword: {
            title: "Yeni şifre belirleyin",
            description:
              "Bu hesap için yeni şifreyi girin, ardından uygulamaya devam edin.",
            newPassword: "Yeni şifre",
            confirmPassword: "Yeni şifreyi doğrula",
            submit: "Şifreyi güncelle",
            missingSession:
              "Bu sıfırlama bağlantısı eksik veya süresi dolmuş. Yeni bir şifre sıfırlama bağlantısı isteyip tekrar deneyin.",
          },
          signup: {
            title: "Hesabınızı oluşturun",
            subtitle:
              "Önce hesabınızı oluşturun, sonra pazaryerinde nasıl görüneceğinizi belirleyin.",
            email: "E-posta adresi",
            password: "Şifre",
            confirmPassword: "Şifreyi doğrula",
            back: "Geri",
            finish: "Kurulumu tamamla",
            hasAccount: "Zaten hesabınız var mı?",
            loginLink: "Giriş yap",
            stepCounter: "Adım {{current}} / {{total}}",
            errors: {
              accountRequired:
                "Devam etmek için e-posta adresinizi ve şifrenizi girin.",
              passwordTooShort: "Şifre en az 6 karakter olmalıdır.",
              passwordMismatch: "Şifreler eşleşmiyor.",
            },
            accountStep: {
              signedInTitle: "Hesap zaten doğrulandı",
              signedInDescription:
                "{{email}} olarak giriş yaptınız. Pazaryeri profilinizi oluşturmak için kalan kurulum adımlarını tamamlayın.",
            },
            roles: {
              author: {
                title: "Yazar",
                description:
                  "Manuskriptler, türler ve başvurular için profil oluşturun.",
              },
              publisher: {
                title: "Yayıncı",
                description: "Editöryal odak ve keşif için profil oluşturun.",
              },
            },
            profileStep: {
              title: "Bize kendinizden bahsedin",
              description:
                "Pazaryeri rolünüzü seçin ve insanların ilk göreceği kimlik bilgilerini ekleyin.",
              displayName: "Görünen ad",
              displayNamePlaceholder: "Keşifte görünecek ad",
              photoAlt: "Profil önizlemesi",
              photoHint:
                "Herkese açık bir profil fotoğrafı bağlantısı yapıştırın ya da şimdilik boş bırakın.",
              photoInput: "Profil fotoğrafı URL",
              photoLabel: "Profil fotoğrafı",
              photoPlaceholder: "https://example.com/foto.png",
            },
            intentStep: {
              title: "Bu uygulamayı neden kullanmayı planlıyorsunuz?",
              description: {
                author:
                  "İlk kullanım amacınızı en iyi anlatan seçeneği işaretleyin.",
                publisher:
                  "Ekibinizin ilk kullanım amacını en iyi anlatan seçeneği işaretleyin.",
              },
              question: {
                author: "Bu uygulamayı neden kullanmayı planlıyorsunuz?",
                publisher: "Ekibiniz bu uygulamayı neden kullanmayı planlıyor?",
              },
              help: {
                author:
                  "Bunu sonraki profil alanlarını ve ürün yönlendirmelerini şekillendirmek için kullanacağız.",
                publisher:
                  "Bunu sonraki profil alanlarını ve ürün yönlendirmelerini şekillendirmek için kullanacağız.",
              },
            },
            intentOptions: {
              find_publisher: "Eserim için yayınevi bulmak istiyorum",
              compare_publishers:
                "Yayınevlerini ve editöryal uyumu karşılaştırmak istiyorum",
              prepare_submission:
                "Başvurularımı daha düzenli hazırlamak istiyorum",
              discover_manuscripts:
                "İncelenmeye değer manuskriptleri keşfetmek istiyoruz",
              source_authors: "Listemiz için yazar keşfetmek istiyoruz",
              manage_submissions:
                "Gelen başvuru akışımızı daha iyi yönetmek istiyoruz",
            },
            aside: {
              kicker: "Profil odaklı kayıt",
              title:
                "İleride büyüyecek profilinizin temel hesabını şimdi kurun.",
              description:
                "İlk dikey dilimi dar tutuyoruz: şimdi hesap oluşturma, sonraki adımda daha zengin profil düzenleme.",
              cardTitle: "Hemen elde edeceğiniz şeyler",
              cardBody:
                "Kaydedilmiş pazaryeri kimliği, net bir rol ve kayıt sonrası döneceğiniz bir profil ana sayfası.",
              footer: {
                one: "Kimlik",
                two: "Profil",
                three: "Keşif",
              },
            },
          },
          social: {
            google: "Google ile devam et",
            facebook: "Facebook ile devam et",
            lastUsed: "Son kullanılan",
            orEmail: "Veya e-posta ile devam et",
            unavailable: "{{provider}} şu anda kullanılamıyor.",
          },
          checkEmail: {
            title: "E-postanızı kontrol edin",
            fromSignup:
              "Hesabınız oluşturuldu. E-posta adresinize bir doğrulama bağlantısı gönderdik. Bağlantıyı açıp hesabınızı doğrulayın, sonra geri dönüp giriş yapın.",
            fromLogin:
              "Bu hesap mevcut ancak e-posta adresi henüz doğrulanmamış. Önce e-postanızı doğrulayın, ardından tekrar giriş yapın.",
            emailLabel: "E-posta adresi",
            emailPlaceholder: "ornek@eposta.com",
            resendButton: "Doğrulama e-postasını yeniden gönder",
            resentSuccess:
              "Bu adres uygunsa yeni bir doğrulama e-postası gönderildi.",
            backToLogin: "Girişe dön",
            useDifferentEmail: "Farklı bir e-posta mı kullanacaksınız?",
            createAnotherAccount: "Yeni hesap oluştur",
            emailRequired:
              "Doğrulama e-postasını yeniden göndermek için e-posta adresinizi girin.",
          },
          signOut: "Çıkış yap",
          callback: {
            title: "Giriş tamamlanıyor",
            description:
              "Oturumunuz hazırlanıyor ve sizi yönlendireceğimiz sayfa belirleniyor.",
            genericError:
              "Sosyal giriş akışını tamamlayamadık. Lütfen tekrar deneyin.",
            backToLogin: "Girişe dön",
          },
          errors: {
            invalidCredentials: "Geçersiz e-posta veya şifre",
            emailNotConfirmed:
              "Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.",
            emailRateLimited:
              "Henüz yeni bir doğrulama e-postası gönderemiyoruz. Lütfen birkaç dakika bekleyip tekrar deneyin.",
            emailDeliveryFailed:
              "E-postayı gönderemedik. Kimlik e-postası gönderim ayarlarını ve gönderen alan adı doğrulamasını kontrol edin.",
            generic: "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
          },
        },
        common: {
          continue: "Devam et",
          loading: "Yükleniyor…",
          retry: "Tekrar dene",
        },
        marketing: {
          home: {
            eyebrow: "Yayıncılık için keşif platformu",
            title: "Yazarlar ve yayıncılar için sade bir başlangıç noktası.",
            description:
              "Hesabınızı oluşturun, profilinizi tamamlayın ve yazarlarla yayıncılar arasında yapılandırılmış keşfe hazırlanın.",
            primaryCta: "Hemen başla",
            secondaryCta: "Giriş yap",
          },
          section: {
            eyebrow: "Platform bölümü",
            title: "{{section}}",
            description:
              "{{section}} alanı, platforma yeni iş akışları ve keşif araçları eklendikçe genişleyecek.",
          },
        },
        dashboard: {
          title: "Panel",
          welcome: "Giriş yapıldı:",
          adminReady:
            "Hesabınız yönetici erişimine sahip. Operasyonları ve moderasyon işlerini yönetim panelinden takip edebilirsiniz.",
          openAdmin: "Yönetim panelini aç",
          pendingApproval:
            "Profiliniz keşifte görünmeden önce yönetici onayı alacak. Temel profiliniz ise zaten kaydedildi.",
          openManuscripts: "Projelerimi aç",
          backToDashboard: "Panele dön",
          cards: {
            manuscripts: {
              title: "Manuskriptleri yönet",
              description:
                "Manuskript kayıtlarınızı oluşturun, inceleyin ve güncelleyin.",
            },
            matches: {
              title: "Eşleşmeleri incele",
              description:
                "Mevcut ve yaklaşan yayınevi eşleşmelerini görüntüleyin.",
            },
            requests: {
              title: "Talepleri takip et",
              description:
                "Gönderdiğiniz ve aldığınız tanışma taleplerini izleyin.",
            },
            billing: {
              title: "Plan ve ödeme",
              description:
                "Aboneliğinizi ve ödeme olaylarını bu alandan yönetin.",
            },
          },
        },
        appPages: {
          matches: {
            description:
              "Eşleştirme iş akışları hesabınızda açıldığında koşular ve aday içgörüleri burada listelenecek.",
          },
          requests: {
            description:
              "Gönderilen ve alınan tanışma talepleri, güncel durumlarıyla bu sayfada gösterilecek.",
          },
          billing: {
            description:
              "Faturalandırma özeti, plan detayları ve ödeme olayları bu sayfadan yönetilecek.",
          },
          profile: {
            description:
              "Onboarding alanları genişledikçe profil detaylarınız ve hesap tercihleri burada yer alacak.",
          },
          settings: {
            description:
              "Çalışma alanı ve hesap düzeyindeki ayarlar bu bölümden yapılandırılacak.",
          },
        },
        profile: {
          pageTitle: "Profiliniz",
          pageDescription:
            "Bu sayfa hesabınızın temel profil alanlarını gösterir. Daha zengin düzenleme araçları sonraki dilimde gelecek.",
          roles: {
            author: "Yazar",
            publisher: "Yayıncı",
          },
          eligibilityStatus: {
            eligible: "Uygun",
            limited: "Sınırlı",
            blocked: "Engelli",
            quarantined: "Karantinada",
          },
          signupIntent: {
            find_publisher: "Eserim için yayınevi bulmak istiyorum",
            compare_publishers:
              "Yayınevlerini ve editöryal uyumu karşılaştırmak istiyorum",
            prepare_submission:
              "Başvurularımı daha düzenli hazırlamak istiyorum",
            discover_manuscripts:
              "İncelenmeye değer manuskriptleri keşfetmek istiyoruz",
            source_authors: "Listemiz için yazar keşfetmek istiyoruz",
            manage_submissions:
              "Gelen başvuru akışımızı daha iyi yönetmek istiyoruz",
          },
          summary: {
            role: "Rol",
            intent: "Mevcut amaç",
            status: "Onay durumu",
          },
          fields: {
            displayName: "Görünen ad",
            role: "Rol",
            photo: "Profil fotoğrafı",
            photoFallback: "Henüz fotoğraf yok",
            intent: "Katılım amacı",
          },
          placeholder: {
            title: "Profil düzenleme bir sonraki dilim",
            description:
              "Hesabınız oluşturuldu ve ilk profil alanlarınız kaydedildi. Sonraki adımda bu sayfayı tam profil düzenleyicisine dönüştüreceğiz.",
            nextStep:
              "Sonraki dilimde daha zengin yazar ve yayıncı bölümleri, düzenleme kontrolleri ve daha iyi tamamlama yönlendirmeleri eklenecek.",
          },
        },
        manuscripts: {
          nav: "Manuskriptler",
          pageTitle: "Manuskriptlerim",
          pageSubtitle:
            "Manuskript meta verilerini ve örnek dosya yüklemelerini yönetin.",
          forbidden: {
            title: "Yazar erişimi gerekli",
            description:
              "Bu çalışma alanı Step 8 içinde yalnızca yazar hesaplarına açıktır.",
          },
          createCta: "Yeni manuskript",
          openCta: "Aç",
          empty: "Henüz manuskriptiniz yok. İlkini oluşturun.",
          sections: {
            overview: "Özet",
            list: "Manuskript listesi",
          },
          summary: {
            total: "Toplam manuskript",
            withSample: "Örnek eklenen",
            eligible: "Uygun",
          },
          sampleStatus: {
            added: "Örnek eklendi",
            missing: "Örnek yok",
          },
          table: {
            title: "Başlık",
            genre: "Tür",
            language: "Dil",
            status: "Durum",
            sample: "Örnek",
            eligibility: "Uygunluk",
            words: "Kelimeler",
            actions: "İşlemler",
          },
          status: {
            draft: "Taslak",
            submitted: "Gönderildi",
            under_review: "İnceleniyor",
            approved: "Onaylandı",
            rejected: "Reddedildi",
            archived: "Arşivlendi",
          },
          eligibilityStatus: {
            eligible: "Uygun",
            limited: "Sınırlı",
            blocked: "Engelli",
            quarantined: "Karantinada",
          },
          form: {
            title: "Başlık",
            titlePlaceholder: "Manuskript başlığı",
            genre: "Tür",
            genrePlaceholder: "Örn. Edebi roman, Fantastik, Polisiye",
            language: "Dil",
            wordCount: "Kelime sayısı",
            synopsis: "Özet",
            synopsisPlaceholder: "Kısa açıklama (en fazla 2000 karakter)",
            targetAgeMin: "Min hedef yaş",
            targetAgeMax: "Maks hedef yaş",
            save: "Kaydet",
            saving: "Kaydediliyor…",
            cancel: "İptal",
            createTitle: "Yeni manuskript",
            editTitle: "Manuskripti düzenle",
          },
          detail: {
            backToList: "← Manuskriptler",
            eligibility: "Uygunluk",
            sampleDocument: "Örnek belge",
            noDocument: "Henüz örnek yüklenmedi.",
            uploadCta: "Örnek yükle",
            replaceCta: "Örneği değiştir",
            downloadCta: "Örneği indir",
            downloadingCta: "İndirme hazırlanıyor…",
            downloadError: "İndirme başarısız. Lütfen tekrar deneyin.",
            storageStatus: {
              pending_upload: "Yükleme bekleniyor",
              uploaded: "Yüklendi",
              attached: "Eklendi",
              pending_delete: "Silinme bekliyor",
              deleted: "Silindi",
            },
            processingStatus: {
              not_started: "Örnek bekleniyor",
              queued: "Örneğiniz kontrol ediliyor",
              processing: "Örneğiniz kontrol ediliyor",
              succeeded: "Örnek hazır",
              failed: "Bu dosyayı okuyamadık",
            },
            processingFailure: {
              generic: "Bu dosyayı okuyamadık. Farklı bir örnek yükleyin.",
              empty_extracted_text:
                "Bu dosya boş görünüyor. Farklı bir örnek yükleyin.",
              unsupported_file_type:
                "Bu dosya türü henüz desteklenmiyor. Düz metin örneği yükleyin.",
              file_type_mismatch:
                "Bu dosya seçilen türle eşleşmiyor. Farklı bir örnek yükleyin.",
              extracted_text_too_large:
                "Bu dosya kontrol için çok büyük. Daha kısa bir örnek yükleyin.",
              chunk_limit_exceeded:
                "Bu dosya kontrol için çok uzun. Daha kısa bir örnek yükleyin.",
              download_failed:
                "Bu dosyayı açamadık. Tekrar yükleyin veya farklı bir örnek seçin.",
              parser_failed:
                "Bu dosyayı okuyamadık. Farklı bir örnek yükleyin.",
              embedding_failed:
                "Bu örneği kontrol etmeyi tamamlayamadık. Daha sonra tekrar deneyin veya farklı bir örnek yükleyin.",
              scanner_suspicious:
                "Bu dosyanın kullanılmadan önce ek güvenlik kontrolünden geçmesi gerekiyor.",
              unexpected_processing_error:
                "Bu örneği kontrol etmeyi tamamlayamadık. Daha sonra tekrar deneyin.",
            },
          },
          upload: {
            dropzone:
              "PDF, DOCX, EPUB veya düz metin dosyasını buraya bırakın ya da tıklayarak gözatın.",
            maxSize: "Maksimum dosya boyutu: 25 MB",
            uploading: "Yükleniyor…",
            success: "Yükleme tamamlandı. Örneğiniz şimdi kontrol ediliyor.",
            errorSize: "Dosya 25 MB sınırını aşıyor.",
            errorType:
              "Desteklenmeyen dosya türü. Kabul edilenler: PDF, DOCX, EPUB, düz metin.",
            errorGeneric: "Yükleme başarısız. Lütfen tekrar deneyin.",
          },
        },
        admin: {
          title: "Yönetim Operasyon Konsolu",
          subtitle:
            "Mutlu yolu yavaşlatmadan istisnaları, otomasyon sağlığını ve denetimli müdahaleleri izleyin.",
          quickNav: "Yönetim gezintisi",
          backToOverview: "Yönetim özetine dön",
          accessStatuses: {
            no_access: "Yönetici erişimi yok",
            mfa_required: "MFA gerekli",
            allowed: "Yönetici erişimi aktif",
            revoked: "Yönetici erişimi kaldırıldı",
          },
          entityTypes: {
            profile: "Profil",
            manuscript: "Manuskript",
            document: "Belge",
            publisher_change_request: "Yayınevi değişiklik talebi",
          },
          reviewStatuses: {
            pending: "Beklemede",
            approved: "Onaylandı",
            rejected: "Reddedildi",
          },
          reviewFilters: {
            statusAll: "Tüm durumlar",
            queueAll: "Tüm kuyruklar",
          },
          exceptionQueues: {
            needs_review: "İnceleme gerekli",
            quarantine: "Karantina",
            reports: "Bildirimler",
            system_failures: "Sistem hataları",
          },
          eligibilityStatuses: {
            eligible: "Uygun",
            limited: "Sınırlı",
            blocked: "Engelli",
            quarantined: "Karantinada",
          },
          reviewOutcomes: {
            auto_approved: "Otomatik uygun",
            needs_review: "İnceleme gerekli",
            admin_approved: "Yönetici onayladı",
            admin_rejected: "Yönetici reddetti",
            quarantined: "Karantinada",
          },
          riskLevels: {
            low: "Düşük",
            medium: "Orta",
            high: "Yüksek",
          },
          pendingProfiles: {
            title: "Bekleyen profil onayları",
            subtitle:
              "Keşifte görünmeden önce onboarding tamamlayan yazar ve yayınevi hesaplarını inceleyin.",
            tableTitle: "İnceleme bekleyen profiller",
            count: "{{count}} beklemede",
            empty: "Onay bekleyen profil yok.",
            approve: "Onayla",
            approving: "Onaylanıyor…",
            reject: "Reddet",
            rejecting: "Reddediliyor…",
            columns: {
              name: "Ad",
              role: "Rol",
              locale: "Dil",
              submitted: "Gönderim",
              actions: "Aksiyonlar",
            },
            roles: {
              author: "Yazar",
              publisher: "Yayınevi",
            },
          },
          tabs: {
            all: "Tüm incelemeler",
            profile: "Profiller",
            manuscript: "Manuskriptler",
            document: "Belgeler",
            publisherChange: "Yayıncı değişiklik talepleri",
          },
          reviews: {
            title: "İstisna çalışma alanı",
            subtitle:
              "İnceleme gerekli, karantina, bildirim ve sistem hatası istisnalarını yönetin.",
            count: "{{count}} istisna",
          },
          forbidden: {
            title: "Yönetici erişimi gerekli",
            description:
              "Bu alana erişim için hesabınızda yönetici yetkisi bulunmuyor.",
          },
          cards: {
            reviewQueue: "İnceleme gerekli",
            highRisk: "{{count}} yüksek risk istisnası",
            quarantine: "Karantina",
            reports: "Bildirimler",
            systemFailures: "Sistem hataları",
            autoApprovalRate: "Otomatik uygunluk oranı",
            jobs: "Çalışan işler",
            jobsQueued: "{{count}} kuyrukta",
            payments: "Ödeme hataları",
            failures: "Son hatalar",
            pendingProfiles: "İnceleme gerekli",
            rejectedProfiles: "{{count}} engelli",
          },
          queue: {
            title: "İstisna kuyruğu",
            entity: "Varlık",
            status: "Durum",
            queue: "Kuyruk",
            eligibility: "Uygunluk",
            outcome: "Sonuç",
            risk: "Risk",
            submitted: "Gönderim",
            action: "Aksiyon",
            open: "Aç",
            empty: "İşlem bekleyen istisna yok.",
          },
          detail: {
            title: "İnceleme detayı",
            summary: "Özet",
            submittedFields: "Gönderilen alanlar",
            riskWarnings: "Risk uyarıları",
            relatedEvents: "İlgili olaylar",
            auditHistory: "Denetim geçmişi",
            rejectionNote: "İç not",
            approve: "Onayla",
            reject: "Reddet",
            quarantine: "Karantinaya al",
            restore: "Geri al",
            suspend: "Askıya al",
            close: "Kapat",
            none: "Uyarı yok.",
            empty: "Detayları görmek için bir inceleme seçin.",
          },
          jobs: {
            title: "İş sağlığı",
            type: "İş türü",
            status: "Durum",
            updated: "Güncellendi",
            pageTitle: "İş sağlığı",
            pageDescription:
              "Asenkron iş akışı ve son hatalar için salt okunur operasyon görünümü.",
            summaryQueued: "Kuyruktaki işler",
            summaryRunning: "Çalışan işler",
            summaryFailed: "Başarısız işler",
          },
          payments: {
            title: "Ödeme sağlığı",
            event: "Olay",
            status: "Durum",
            time: "Zaman",
            pageTitle: "Ödeme sağlığı",
            pageDescription:
              "Son ödeme olayları ve operasyonel hatalar için salt okunur görünürlük.",
            summaryFailures: "Son hatalar",
            summaryLastEvent: "Son ödeme olayı",
          },
          trust: {
            title: "Güvenlik sinyalleri",
            signal: "Sinyal",
            severity: "Seviye",
            status: "Durum",
            created: "Oluşturma",
            empty: "Açık güvenlik sinyali yok.",
            pageTitle: "Güvenlik",
            pageDescription:
              "Ürün incident’ına dönüşmeden önce işaretlenen profilleri ve açık güvenlik sinyallerini inceleyin.",
            pendingProfiles: "Bekleyen profiller",
            flaggedProfiles: "İşaretlenen profiller",
            rejectedProfiles: "Reddedilen profiller",
          },
          audit: {
            title: "Son denetim kayıtları",
            action: "Aksiyon",
            target: "Hedef",
            when: "Zaman",
            empty: "Henüz denetim kaydı yok.",
            actor: "Aktör",
            pageTitle: "Denetim kayıtları",
            pageDescription:
              "Yönetici karar geçmişini ve operasyon faaliyetlerini hafif filtrelerle inceleyin.",
            filterAction: "Aksiyona göre filtrele",
            filterTarget: "Hedef türü veya kimliğine göre filtrele",
          },
          trustSignalTypes: {
            fraud_report: "Dolandırıcılık bildirimi",
            policy_violation: "Politika ihlali",
            identity_mismatch: "Kimlik uyuşmazlığı",
            spam: "Spam",
          },
          trustStatuses: {
            open: "Açık",
            resolved: "Çözüldü",
          },
          jobTypes: {
            document_ingestion: "Belge içe alma",
            matching: "Eşleştirme",
            billing_sync: "Faturalandırma senkronizasyonu",
            email_delivery: "E-posta teslimi",
          },
          jobStatuses: {
            queued: "Kuyrukta",
            running: "Çalışıyor",
            succeeded: "Başarılı",
            failed: "Başarısız",
          },
          paymentStatuses: {
            processed: "İşlendi",
            failed: "Başarısız",
            pending: "Beklemede",
          },
        },
        adminPages: {
          reviews: {
            description:
              "Tam inceleme kuyruğu görünümü; filtre, atama ve gelişmiş moderasyon kontrolleriyle bu alanda genişletilecek.",
          },
          users: {
            description:
              "Kullanıcı yönetimi, onay süreçleri ve yetki geçmişi bu bölümden yürütülecek.",
          },
          manuscripts: {
            description:
              "Manuskript moderasyonu ve uyumluluk kontrolleri operasyon ekipleri için bu sayfada toplanacak.",
          },
          publishers: {
            description:
              "Yayınevi profili denetimi ve değişiklik talebi iş akışları bu sayfada yönetilecek.",
          },
          jobs: {
            description:
              "Arka plan iş durumu, yeniden deneme ve hata takibi bu bölümden izlenecek.",
          },
          payments: {
            description:
              "Ödeme callback olayları, hata incelemeleri ve mutabakat araçları bu sayfada yer alacak.",
          },
          auditLogs: {
            description:
              "Güvenlik ve operasyon denetim kayıtları bu alanda aranabilir ve filtrelenebilir olacak.",
          },
          settings: {
            description:
              "Personel erişim duruşunu, MFA hazırlığını ve yönetim çalışma alanı kurallarını gözden geçirin.",
            identity: {
              title: "Yönetici kimliği",
              email: "Giriş yapan e-posta",
              access: "Erişim durumu",
              mfa: "Çok faktörlü doğrulama",
              mfaVerified: "Bu oturum için MFA doğrulandı",
              mfaRequired: "Hassas yönetim işlemleri öncesi MFA gerekli",
            },
            policy: {
              title: "Çalışma kuralları",
              separateAccounts:
                "Yönetici erişimi, pazaryeri kullanıcı profilleri yerine ayrı personel hesaplarına ayrılmıştır.",
              mfa: "Korunan rotalar kullanılmadan önce her yönetici oturumu MFA gerekliliğini karşılamalıdır.",
              audit:
                "Tüm moderasyon ve operasyon değişiklikleri denetim geçmişi üretmelidir.",
              notes:
                "Hassas işlemler için açık not zorunludur; böylece incelemeler ve incident’lar açıklanabilir kalır.",
            },
            session: {
              title: "Oturum",
              description:
                "Bu cihazdaki yönetim çalışma alanı oturumunu kapatmak için bu kontrolü kullanın.",
            },
          },
        },
        adminAccess: {
          mfaRequired: {
            title: "Yönetim konsolu için MFA adımını tamamlayın",
            description:
              "Bu personel hesabının yönetici üyeliği var, ancak mevcut oturum gerekli çok faktörlü doğrulama adımını tamamlamadı.",
          },
          revoked: {
            title: "Yönetici erişimi kaldırıldı",
            description:
              "Bu personel hesabı artık yönetim konsolunu kullanamaz. Bu beklenmiyorsa başka bir yöneticiyle iletişime geçin.",
          },
        },
        onboarding: {
          complete: "Profili tamamla",
          pageTitle: "Profilinizi tamamlayın",
          admin: {
            title: "Yönetici hesabı",
            description:
              "Yönetici hesapları pazaryeri profili oluşturmaz. İnceleme ve operasyon işleri için yönetim konsolunu kullanın.",
          },
          blocked: {
            title: "Onboarding hazırlanamadı",
            description:
              "Hesap erişiminiz doğrulanamadı. Sayfayı yenileyip tekrar deneyin.",
          },
          displayName: {
            label: "Görünen ad",
            placeholder: "Keşifte görünecek ad",
          },
          authorDetails: {
            title: "Yazar detayları",
            description:
              "İlk keşif profili için gerekli en temel bağlamı ekleyin.",
            biography: {
              label: "Kısa biyografi",
              placeholder:
                "Üzerinde çalıştığınız manuskript türlerini, temaları veya hedef okur kitlesini anlatın.",
            },
            primaryGenre: {
              label: "Ana tür",
            },
            writingLanguages: {
              label: "Yazı dilleri",
            },
          },
          publisherDetails: {
            title: "Yayınevi tercihleri",
            description:
              "İlk günden paylaşılabilecek editoryal tercihleri kaydedin.",
            focusGenres: {
              label: "Odak türler",
            },
            preferredLanguages: {
              label: "Tercih edilen gönderim dilleri",
            },
            acceptsUnsolicited: {
              label: "Doğrudan başvuruları kabul et",
              description:
                "Ekibinizin doğrudan tanışma taleplerine açık olup olmadığını gösterin.",
            },
          },
          role: {
            author: {
              description: "Manuskriptler ve haklar için profil oluşturun.",
              title: "Yazar",
            },
            description:
              "Hesap rolüyle başlayın. Onay ve detaylı profil alanları sonraki adımda gelir.",
            publisher: {
              description: "Liste, tür ve ilgi alanları için profil oluşturun.",
              title: "Yayıncı",
            },
            title: "Pazaryeri rolünüzü seçin",
          },
        },
        status: {
          apiBaseUrl: "API temel URL",
          apiError: "Sağlık kontrolü başarısız",
          apiHealth: "API sağlığı",
          apiLoading: "Sağlık kontrol ediliyor...",
          apiUnknown: "Bilinmiyor",
          auth: "Kimlik",
          authPending: "Supabase bağlantısı ilk dikey dilimde eklenecek.",
          title: "Scaffold durumu",
        },
      },
    },
  },
});
