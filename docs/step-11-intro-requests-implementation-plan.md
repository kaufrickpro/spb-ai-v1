# Step 11 Intro Requests And Contact Unlock Implementation Plan

## Summary

Build intro requests as a controlled escalation from stored match/access evidence into a pair-scoped relationship for one manuscript and one publisher profile. Either side can initiate. Only the recipient can accept or reject. Only the requester can cancel while pending. Acceptance unlocks mutual relationship contact through API read models and publisher-only signed sample download access for the current active eligible sample.

Step 11 is not blocked by final AI-service scoring persistence because it relies on stored `match_candidates`, `profile_access_grants`, and approved `manuscript_access_requests`, not on provider internals. The current project recommendation still prioritizes finishing the repository-backed Step 10 AI-service matching worker first unless product priority changes.

## Decisions

- Intro requests are scoped to `(manuscript_id, publisher_profile_id)`.
- Creation requires durable pair evidence: a stored match candidate for the pair or an approved manuscript access request for that publisher/manuscript.
- Public publisher directory rows, guessed IDs, broad profile access, or unrelated manuscript access must not permit intro creation.
- Both participant profiles, the manuscript, and the active sample must remain eligible for send, accept, contact unlock, and sample unlock.
- Duplicate pending requests are blocked per pair. Accepted is terminal. Rejected or cancelled pairs may retry after 14 days.
- Quota is consumed when the request is sent. Start with 10 intro requests per user/day until Step 13 wires subscription-plan limits.
- Messages are optional plain text, max 1,000 characters. Rejection notes are optional plain text, max 500 characters.
- Contact unlock is mutual and shown through a separate `acceptedIntroContact` block. Sample unlock is publisher-only and manuscript-specific through signed download URLs.
- Accepted intro access is computed live from `intro_requests.status = accepted` plus current eligibility. Do not create a separate accepted-intro grant table.
- In-app notification records and `product_audit_events` are written in the same transaction as lifecycle mutations. Product email is deferred to Step 14.
- Admin gets read-only investigation screens in Step 11, not user-action override buttons.

## Tracer-Bullet Issues

1. **Send Intro Request From Match Context**
   - Type: AFK
   - Blocked by: none
   - Build the first end-to-end create path: schema, contract, API, durable pair-evidence eligibility, notification/product-audit write, and real send action replacing the disabled match-card placeholder.

2. **Manage Pending Intro Requests In `/app/requests`**
   - Type: AFK
   - Blocked by: issue 1
   - Add sent/received intro request lists, recipient accept/reject, requester cancel, accept confirmation, optional rejection note, and state refresh in the existing requests workspace.

3. **Enforce Duplicate, Terminal, Cooldown, And Quota Rules**
   - Type: AFK
   - Blocked by: issue 1
   - Add pending/accepted pair guards, 14-day retry cooldown after reject/cancel, simple 10/day send quota, and explicit `introState` values for quota and cooldown states.

4. **Expose Accepted-Intro Contact Unlock**
   - Type: AFK
   - Blocked by: issue 2
   - Add `public.has_accepted_intro`, shared API unlock policy, `acceptedIntroContact` in authorized read models, and UI sections on request/profile surfaces.

5. **Unlock Publisher Sample Download After Acceptance**
   - Type: AFK
   - Blocked by: issue 2
   - Extend document download authorization for accepted-intro publisher counterparties and resolve the current active eligible sample at download time.

6. **Add Admin Intro Request Investigation Surface**
   - Type: AFK
   - Blocked by: issues 1 and 2
   - Add admin list/detail API and UI with filters, safe metadata, timeline from `product_audit_events`, current unlock status, and no admin accept/reject/cancel actions.

7. **Propagate Intro State Across Match And Profile Surfaces**
   - Type: AFK
   - Blocked by: issues 1, 2, and 3
   - Add `introState` to match candidate/detail and match-revealed profile/manuscript responses, then update buttons across those surfaces without per-card status calls.

8. **Step 11 Documentation And Harness Updates**
   - Type: AFK
   - Blocked by: issues 1-7
   - Update source-of-truth docs after implementation and add mechanical checks only for repeated safety rules that proved worth enforcing.

## API And Contract Shape

Add shared contract schemas for:

- `IntroRequestStatus`: `pending`, `accepted`, `rejected`, `cancelled`
- `IntroStateStatus`: `can_request`, `pending_sent`, `pending_received`, `accepted`, `rejected_cooldown`, `cancelled_cooldown`, `not_eligible`, `quota_exhausted`
- `CreateIntroRequestRequest`: `{ manuscriptId, publisherProfileId, message? }`
- `RejectIntroRequestRequest`: `{ note? }`
- `IntroRequest`: safe list/detail shape with request id, pair ids, display snapshots, status, current viewer relation, timestamps, optional message/note only for participants, and unlock flags.

Routes:

- `POST /api/v1/intro-requests`
- `GET /api/v1/intro-requests?box=sent|received|all&status=pending|accepted|rejected|cancelled|all&limit=...`
- `POST /api/v1/intro-requests/:id/accept`
- `POST /api/v1/intro-requests/:id/reject`
- `POST /api/v1/intro-requests/:id/cancel`
- `GET /api/v1/admin/intro-requests`
- `GET /api/v1/admin/intro-requests/:id`

Do not accept `authorId`, `requestedBy`, `recipientId`, status, contact fields, or signed URL fields from browser create payloads.

## Data Flow

1. User clicks an intro action from a match card, match detail, or match-revealed profile/manuscript surface.
2. API verifies requester profile, pair evidence, eligibility, terminal/pending/cooldown state, and quota.
3. A trusted RPC or transaction creates `intro_requests`, consumes usage/quota, writes `notifications`, and writes `product_audit_events`.
4. Recipient sees the request under `/app/requests` and can accept or reject while pending.
5. Acceptance writes the status transition, notification, and product event. It does not copy contact values or document grants.
6. Later profile/request reads compute `acceptedIntroContact` from accepted intro plus current eligibility.
7. Publisher sample download requests resolve the current active eligible sample and return a short-lived signed URL only after accepted-intro authorization.

## Testing And Validation

- Contract tests reject forged browser fields and extra sensitive fields.
- API tests cover author-send, publisher-send, arbitrary pair denial, duplicate pending denial, accepted terminal behavior, 14-day cooldown, quota exhaustion, recipient-only accept/reject, requester-only cancel, and admin identity denial on marketplace endpoints.
- Unlock tests prove accepted counterparties can see `acceptedIntroContact`, pre-acceptance users cannot, nonparticipants cannot, and blocked/quarantined/ineligible state stops unlocks.
- Download tests prove publisher accepted-intro sample access works only for the current active eligible processed sample.
- Persistence tests prove lifecycle mutations write notification and product audit rows and omit message text, rejection notes, contact details, signed URLs, manuscript text, chunks, and provider payloads from those payloads.
- Frontend tests cover all intro button states, accept confirmation, rejection note, cancel, accepted contact display, sample download action, loading, error, and empty states.
- Admin tests cover filtered list/detail reads, safe timeline, redaction, and absence of admin action buttons.

Run the narrowest relevant checks first:

- `npm run test --workspace packages/contracts`
- `npm run test --workspace apps/api -- intro`
- `npm run test --workspace apps/web -- intro`
- Broader workspace typecheck/build/test only after the focused checks pass.
