# Frontend Architecture

## Summary

The frontend is a Vite + React single page application using React Router, TanStack Query, Tailwind CSS, route-independent i18n, and shadcn/ui patterns. It should feel like a platform-shaped SaaS product: calm, dense, readable, and built to support multiple user-facing functions without splitting the experience into disconnected mini-sites.

## App Structure

```txt
apps/web/src/
  App.tsx
  main.tsx
  modules/
    api/
    config/
    i18n/
    admin/
    onboarding/
  routes/             # add as route count grows
  components/         # add shared components when needed
  lib/
    api-client.ts     # legacy placeholder; current web API client lives in modules/api/client.ts
    auth.ts           # add with Supabase Auth wiring
    sentry.ts         # add with observability slice
```

Keep the current app small. Add feature folders and shared UI only when a vertical slice needs them.

## Route Map

Public routes:

- `/`
- `/features`
- `/pricing`
- `/publishers`
- `/authors`
- `/editorial`
- `/works`
- `/login`
- `/signup`
- `/auth/callback`
- `/forgot-password`
- `/terms`
- `/privacy`
- `/kvkk`
- `/cookies`

Prerendering:

- Prerender only public static or mostly-static pages: home, pricing, terms, privacy, KVKK, and cookies.
- Keep auth and authenticated app routes client-rendered.
- Do not prerender user-specific, payment-specific, or signed-URL content.

Authenticated routes:

- `/onboarding` (compatibility redirect to `/app/profile`)
- `/app/dashboard`
- `/app/manuscripts`
- `/app/manuscripts/:id`
- `/app/matches`
- `/app/matches/:matchRunId/candidates/:candidateId`
- `/app/discover/authors`
- `/app/discover/publishers`
- `/app/requests`
- `/app/profile`
- `/app/billing`
- `/app/settings`

Admin routes:

- `/admin`
- `/admin/reviews`
- `/admin/trust-safety`
- `/admin/jobs`
- `/admin/payments`
- `/admin/audit-logs`
- `/admin/settings`

## Navigation

The product should use a shared top-level site header across public pages and pre-onboarding authenticated flows.

Primary public navigation:

- Authors
- Publishers
- Main Features
- Pricing

Logged-out header behavior:

- Keep brand on the left.
- Keep the main product sections visible in the center.
- Keep `Giriş Yap` and `Kaydol` visible on the right.

Onboarding behavior:

- Keep the same header family as the rest of the site.
- Let onboarding content become the focus through page layout, not by removing platform identity.

Authenticated app navigation should include:

- Dashboard
- Projects (manuscripts in the current slice)
- Matches
- Requests
- Billing
- Settings

Admin users get a dedicated admin navigation set:

- Admin Dashboard
- Reviews
- Trust & Safety
- Jobs
- Payments
- Audit Logs
- Settings

Responsive behavior:

- On smaller widths, collapse the header into a hamburger trigger.
- The drawer/sidebar must expose the same links and account actions as desktop.

## Page Responsibilities

### Dashboard

Show profile eligibility state, manuscript eligibility/processing state, active subscription, intro request usage, upload storage usage, pending intro requests, and recent matches.

### Onboarding

The first authenticated completion surface now starts in signup. Signup uses one 3-step wizard for account, profile basics, and signup intent. Users cannot create an auth account or marketplace profile from signup before those three steps are valid. Profile photo URL is optional. `/signup/complete` is not an active page; it should only redirect back to `/signup` for compatibility. The standalone onboarding routes should behave as compatibility redirects to `/app/profile`.

### Auth Callback URLs

The frontend owns the app callback route:

- local: `http://localhost:5173/auth/callback`
- staging: `https://staging.spb-ai.dev/auth/callback`
- production: `https://spb-ai.dev/auth/callback`

Supabase Auth URL Configuration must always use the app domain for:

- `Site URL`
- allowed redirect URLs

Do not leave `localhost:5173` values in production auth configuration. Production builds must switch those values to the public domain before release testing.

Canonical production URL:

- Use `https://spb-ai.dev`.
- Redirect `https://www.spb-ai.dev` to `https://spb-ai.dev`.

For Google social auth, keep the distinction clear:

- Google `Authorized JavaScript origin` should match the app origin
- Google `Authorized redirect URI` should match the Supabase project callback URL, for example `https://ipqmdjsxedffetotemil.supabase.co/auth/v1/callback`

### Manuscripts

Authors create and manage manuscripts, upload sample files, and view eligibility/processing status.

### Matches

Show ranked publisher recommendations for a selected manuscript. Cards must include score band, fit reasons, risk reasons, shared genres, source snippets, intro request CTA, and match detail CTA.

### Match Detail

Show stored candidate explanation data: full fit reasons, mismatch/risk reasons, shared genres, source snippets, publisher preference context, manuscript metadata comparison, and intro request state. Do not generate a separate report.

### Requests

Show sent and received intro requests. Accepted requests reveal contact details and sample-file access.

### Admin

Support exception review, quarantine, reports, system failures, jobs, payment events, and audit logs.

## UI Rules

- Use shadcn/ui components as the base.
- Add concrete shadcn/ui components intentionally as screens need them; do not import the full catalog upfront.
- Treat headers, navigation, and auth entry screens as part of one product shell rather than isolated one-off layouts.
- Use tables for admin and operational lists.
- Use tabs for dense detail pages.
- Use dialogs for approval, rejection, quarantine, restore, and confirmation flows.
- Avoid decorative layouts that reduce scannability.
- Do not expose raw contact details until an intro request is accepted.
- Do not put Resend API keys or server email logic in the frontend.
- Configure Sentry with environment and release tags, and scrub sensitive user/document fields from captured events.
- Keep loading, empty, error, and permission-denied states explicit.
- Keep admin surface gating behind the shared admin access Module so header links, dashboard entry points, and `/admin` route access cannot drift.

## i18n

- Turkish and English are supported from the start.
- Turkish UI copy must use real Turkish characters.
- Use route-independent translation keys.
- Store copy outside components.
- Do not mix user-generated content with translated interface copy.

## Open Questions

- What should the product be called in Turkish and English?
- Should Turkish be the default UI language?
- Should public marketing pages prioritize SEO at launch, or can they remain SPA-rendered?
- Do authors and publishers need different dashboard layouts in v1?
- Which top-level sections should be visible in the header at launch versus reserved for later?
