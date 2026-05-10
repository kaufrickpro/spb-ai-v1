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
- `/app/profile/history`
- `/app/profiles/publishers/:publisherProfileId`
- `/app/profiles/authors/:authorProfileId`
- `/app/profiles/manuscripts/:manuscriptId`
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

Show profile eligibility state, manuscript eligibility/processing state, active subscription/trial state, compact intro request usage, compact upload storage usage for authors, pending intro requests, and recent matches. Link detailed entitlement and usage management to `/app/billing`.

Limited author profiles should show a clear prompt to complete author details on `/app/profile`. The profile page should be view-first: show saved details by default, then reveal editable controls only after an explicit edit action. The author detail edit flow submits biography, primary genre, and writing languages through the shared `profiles.completeDetails` contract so the API-owned eligibility evaluator can promote the profile when required details are complete.

### Onboarding

The first authenticated completion surface now starts in signup. Signup uses one 3-step wizard for account, profile basics, and signup intent. Users cannot create an auth account or marketplace profile from signup before those three steps are valid. Profile photo URL is optional. `/signup/complete` is not an active page; it should only redirect back to `/signup` for compatibility. The standalone onboarding routes should behave as compatibility redirects to `/app/profile`.

### Auth Callback URLs

The frontend owns the app callback route:

- local: `http://localhost:5173/auth/callback`
- staging: `https://spb-ai.dev/auth/callback`
- production: `https://spb-ai.com/auth/callback`

Supabase Auth URL Configuration must always use the app domain for:

- `Site URL`
- allowed redirect URLs

Do not leave `localhost:5173` values in production auth configuration. Production builds must switch those values to the public domain before release testing.

Canonical production URL:

- Use `https://spb-ai.com`.
- Redirect `https://www.spb-ai.com` to `https://spb-ai.com`.

For Google social auth, keep the distinction clear:

- Google `Authorized JavaScript origin` should match the app origin
- Google `Authorized redirect URI` should match the Supabase project callback URL, for example `https://ipqmdjsxedffetotemil.supabase.co/auth/v1/callback`

### Manuscripts

Authors create and manage manuscripts, upload sample files, and view eligibility/processing status.

The manuscript workspace is role-gated in the frontend, not eligibility-gated. Limited, blocked, or quarantined authors may still reach safe workspace pages; API eligibility checks remain responsible for blocking marketplace exposure, matching, intro actions, sample downloads, and other sensitive operations.

### Public Publisher Directory

`/publishers` is a logged-out-safe publisher directory. It shows only admin-approved publisher logo, publisher name, and valid `https` website. It must not link to full publisher profiles or expose genres, guidelines, wishlists, acquisitions, matching data, contact details, or marketplace-only profile fields.

### Matches

Show the active matching workspace for both roles. Authors can run publisher matches for a selected manuscript. Publishers can run manuscript matches from their general publisher profile. Cards should stay compact and include score band, premise/voice/arc bands, the generated explanation when available, a short fit/watch-out preview, intro request CTA state, profile links, and match detail CTA.

Top-10 candidates show a stored one-paragraph explanation generated during the match run. Ranks 11-25 remain inspectable through structured details without requiring an LLM paragraph. The UI must render stored structured details only; it must not generate explanations from the browser.

Intro request buttons must be driven by API-provided `introState`, not frontend inference. Supported states are `can_request`, `pending_sent`, `pending_received`, `accepted`, `rejected_cooldown`, `cancelled_cooldown`, `not_eligible`, and `quota_exhausted`.

### Match Detail

Show stored candidate explanation data as the full comparison/evidence surface for one manuscript-publisher pair. Candidate detail is requester-owned, historical, and deterministic: render the stored `detail_snapshot` when present, fall back honestly for older rows, and compute only `introState` live.

Use major tabs for Overview, Comparison, Evidence, and Watch-outs/limitations. The first view should show score band, stale-run warning when relevant, intro request state/action, explanation paragraph when present, and the highest-signal fit/watch-out summary. Evidence-heavy areas may use compact accordions.

Render premise/voice/arc bands with axis-specific evidence, bounded publisher context, manuscript metadata comparison, safe snippets with source labels, and limitations. Do not generate a separate report from the frontend or on detail open. Do not show accepted-intro contact or sample download controls here; link to profile/request/manuscript surfaces for those unlocks.

### Match-Revealed Profiles

Full profile pages are authenticated app pages, not public profiles. Candidate names in match results may link to app-only profile pages when the viewer has access through a stored match candidate, approved manuscript access request, owner access, admin access, or later accepted intro.

Publisher profile pages show publisher name, logo, website, biography/about, editorial section, what they are looking for, accepted matching fields, submission guidelines, recent acquisitions, best-selling books, and owner-approved match-visible contact fields. They must not show private editor contact, hidden admin state, billing state, or internal scores.

Author profile pages show author photo, biography, "My style", influences, owner-approved match-visible contact fields, and manuscripts visible to the viewer. Matched or access-approved manuscripts may show full profile cards. Other author manuscripts may show only requestable teasers when the author opted into requestability for that manuscript.

Manuscript profile pages show manuscript title, logline, synopsis, primary genre, subgenres, audience categories, manuscript form, declared themes, arc/summary display, and a compact author card linking back to the author profile. They must not show full manuscript text, full sample downloads, private notes, private account contact, or exact internal scores from match access alone.

When an accepted intro exists, profile and request surfaces may show a separate accepted-intro contact section. Do not merge it with match-visible contact, and do not auto-fetch signed sample URLs. Sample download remains an explicit click.

### Profile History

`/app/profile/history` stores durable user history. Step 10 ships this with match runs only. Show latest runs first, include direction, source manuscript or publisher profile, created date, status, stale badge, candidate count, view results action, and rematch action. Rematch creates a new run and leaves older stale runs visible. History result links must route to `/app/matches/:matchRunId`, while individual candidate details route to `/app/matches/:matchRunId/candidates/:candidateId`.

### Requests

Show sent and received intro requests plus manuscript access requests. Manuscript access requests let an eligible publisher who discovered an author through matching ask to view another requestable manuscript profile. Author approval unlocks that manuscript profile only for the requesting publisher. Accepted intro requests remain the deeper relationship unlock for private contact details and sample-file access.

The Step 11 requests workspace now shows intro requests beside manuscript access requests, renders API-owned status badges, supports accept/reject for `pending_received`, cancel for `pending_sent`, and shows accepted contact separately. Accept uses a confirmation dialog because it unlocks private contact and sample access. Publisher sample download remains an explicit click on the accepted manuscript profile surface.

### Billing

`/app/billing` is the authenticated billing and usage management surface. Step
13a now shows the current entitlement state, whether the one-month trial is
available/active/expired/already used, the current period, plan limits, intro
usage, author storage usage, publisher directory visibility entitlement, and
clear recovery actions for gated workflows.

Trial start is explicit and calls the API. It requires a completed eligible
role-specific profile. Paid checkout remains disabled until Step 13b wires
PayTR.

Public `/pricing` shows the one-month trial and author/publisher monthly
and annual plan categories. Do not show placeholder internal prices as final
public prices before PayTR production pricing is chosen.

### Admin

Support exception review, quarantine, reports, system failures, jobs, payment events, and audit logs.

Step 11 adds a read-only intro request investigation surface for admins. It shows safe list metadata and current unlock status, with a safe detail/timeline API available for drill-down. It must not provide admin accept/reject/cancel-on-behalf actions and must keep private contact, signed URLs, message bodies, rejection notes, full manuscript text, chunks, and billing state out of list views.

## UI Rules

- Use shadcn/ui components as the base.
- Add concrete shadcn/ui components intentionally as screens need them; do not import the full catalog upfront.
- Treat headers, navigation, and auth entry screens as part of one product shell rather than isolated one-off layouts.
- Use tables for admin and operational lists.
- Use tabs for dense detail pages.
- Use dialogs for approval, rejection, quarantine, restore, and confirmation flows.
- Avoid decorative layouts that reduce scannability.
- Do not expose private account contact details until an intro request is accepted. Match-revealed profiles may show only explicit owner-approved match-visible contact fields.
- Marketplace notifications live in the authenticated header bell and `/app/notifications`. The browser renders notification copy from i18n keys and safe API read models only; it must not receive raw notification metadata.
- Notification CTAs use API-owned `ctaPath` values. The frontend marks a notification read before navigating and uses polling/refetch-on-focus rather than realtime or browser push in Step 14.
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
