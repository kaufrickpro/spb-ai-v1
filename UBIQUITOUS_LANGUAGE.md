# Ubiquitous Language

## People and identity

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Auth Identity** | A login identity managed by Supabase Auth. | User, account, login |
| **Marketplace Participant** | A non-staff person using the marketplace as exactly one role: author or publisher. | User, customer, account |
| **Marketplace Profile** | The product profile for one **Marketplace Participant**. | Account, user profile, onboarding profile |
| **Author** | A **Marketplace Participant** who manages manuscripts and requests publisher matches. | Writer, creator, seller |
| **Publisher** | A **Marketplace Participant** who defines acquisition preferences and discovers eligible manuscripts. | Buyer, press, organization, imprint |
| **Staff Identity** | An **Auth Identity** used by an internal operator. | Admin account, user account |
| **Admin User** | A trusted staff membership record that grants access to internal operations. | Admin profile, staff profile, marketplace admin |

## Profiles and manuscript assets

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Author Profile** | The author-facing details used for marketplace eligibility and match context. | Author account, writer page |
| **Publisher Profile** | The publisher-facing details and acquisition preferences used for discovery and matching. | Publisher account, organization profile, imprint |
| **Manuscript** | A work submitted by an **Author** for discovery, matching, and intro workflows. | Book, project, title |
| **Manuscript Metadata** | Structured facts about a **Manuscript**, such as genre, audience, form, word count, logline, and themes. | Book data, manuscript details |
| **Sample Document** | The private uploaded sample file attached to a **Manuscript**. | Manuscript file, full manuscript, upload |
| **Active Sample** | The current **Sample Document** used for document checks, matching evidence, and eventual accepted-intro access. | Current upload, file |
| **Requestable Manuscript** | A **Manuscript** whose author allows qualified publishers to request profile access after discovery. | Open manuscript, public manuscript |
| **Manuscript Access Request** | A publisher's request to view a specific **Requestable Manuscript** profile before an accepted intro. | Access ask, sample request, profile request |

## Eligibility and review

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Automated Check** | A deterministic product, safety, validity, entitlement, or document-readiness assessment. | Manual review, approval |
| **Eligibility Status** | The product-behavior state of a profile, manuscript, or document: eligible, limited, blocked, or quarantined. | Approval status, review status |
| **Review Outcome** | The explanation for how an item reached its eligibility state: auto approved, needs review, admin approved, admin rejected, or quarantined. | Eligibility, approval status |
| **Eligible** | A state where required checks have passed and the item may participate in its allowed marketplace flows. | Approved, live |
| **Limited** | A state where safe workspace access may continue but marketplace exposure or intro actions are restricted. | Pending, soft blocked |
| **Blocked** | A state where the item cannot participate in marketplace flows. | Rejected, disabled |
| **Quarantined** | A state where severe safety or security signals block user preview, matching, discovery, and download access except for staff review. | Blocked, malware state |
| **Needs Review** | A review outcome for items that automated checks could not safely approve or reject. | Pending approval, admin queue |
| **Admin Exception** | A staff work item for uncertain, risky, failed, reported, quarantined, or staff-overridden cases. | Review task, ticket |
| **Staff Override** | An audited admin decision that changes a previously automated or live product state. | Manual edit, admin fix |
| **Report** | A user or staff complaint about abuse, suspicious content, bad matches, payment concerns, or platform misuse. | Complaint, flag |

## Document checking

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Sample Check** | The automated process that determines whether an uploaded **Sample Document** is safe and readable enough for later product use. | Ingestion, parsing, processing |
| **Scanner Result** | The malware or safety scan outcome for a **Sample Document**. | Antivirus response, scan payload |
| **Document Chunk** | A bounded extracted text segment retained as matching evidence after a successful **Sample Check**. | Manuscript text, raw text, excerpt |
| **Embedding Reference** | A stored pointer to vector data or embedding metadata, never the numeric vector itself. | Embedding, vector, array |
| **Safe Snippet** | A bounded, non-sensitive excerpt shown as evidence in match details. | Manuscript text, chunk, quote |

## Discovery, matching, and profile access

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Public Publisher Directory** | A logged-out listing of admin-approved eligible publishers showing only logo, name, and valid HTTPS website. | Public profile, publisher search |
| **Discovery** | Controlled browsing or retrieval of eligible marketplace entities before an intro. | Search, public marketplace |
| **Match Run** | A stored matching attempt in one direction for one requester and one manuscript or publisher context. | Match request, search run |
| **Rematch** | A new **Match Run** created after match-relevant information changes or the user asks again. | Refresh, rerun |
| **Stale Match Run** | A prior **Match Run** whose input fingerprint no longer matches current profile or manuscript data. | Old result, invalid result |
| **Match Candidate** | A stored publisher or manuscript result produced by a **Match Run**. | Result, recommendation |
| **Score Band** | A user-safe label that summarizes match strength without exposing raw relevance scores. | Score, percentage, ranking value |
| **Fit Reason** | A stored explanation of why a **Match Candidate** appears suitable. | Positive reason, rationale |
| **Watch-Out** | A stored mismatch, risk, or constraint concern that should be considered before an intro. | Risk reason, penalty, warning |
| **Manuscript Signal** | A matching representation of a **Manuscript** along premise, voice, or arc. | Manuscript embedding, vector |
| **Publisher Signal** | A matching representation of a **Publisher Profile** from guidelines, wishlist, or catalog context. | Publisher embedding, preference vector |
| **Profile Access** | Permission to view an access-checked author, publisher, or manuscript profile surface. | Public access, full access |
| **Match-Revealed Profile** | An authenticated app profile unlocked through a stored match candidate or approved manuscript access. | Public profile, full profile |
| **Match-Visible Contact** | Owner-approved contact information that may appear after match retrieval or approved manuscript access. | Contact details, public contact |

## Introductions and subscriptions

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Intro Request** | A request from either side to connect around one manuscript-publisher pair. | Message, chat, deal request |
| **Accepted Intro** | An intro request accepted by the counterparty. | Match accepted, agreement, contract |
| **Contact Unlock** | The access granted after an **Accepted Intro** to counterparty contact details and the relevant manuscript sample. | Public contact, sample access |
| **Subscription Plan** | A paid SaaS tier that controls entitlements such as intro request limits, storage, directory visibility, or support level. | Membership, boost, package |
| **Entitlement** | A product capability granted by role, eligibility, subscription, or access state. | Permission, quota |
| **Intro Request Quota** | The count of intro requests a participant may send within a plan or time window. | Match quota, message limit |
| **Subscription Payment** | A PayTR-powered SaaS payment for platform access. | Marketplace payout, escrow, royalty |

## Staff operations and audit

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Admin Console** | The staff-only operations surface for exceptions, reports, jobs, payments, audit logs, and settings. | Back office, admin profile |
| **Needs Review Queue** | The admin queue for items that require a human decision before broader marketplace participation. | Approval queue, pending queue |
| **Quarantine Queue** | The admin queue for blocked items that require staff or security handling. | Blocked queue, malware queue |
| **System Failure** | A failed ingestion, matching, payment, email, quota, or idempotency process that needs retry or investigation. | Error, bug, incident |
| **Audit Log** | The durable record of automated outcomes, admin decisions, access grants, billing mutations, and sensitive product events. | Event log, Sentry issue |

## Relationships

- An **Auth Identity** may have either one **Marketplace Profile** or one **Admin User** membership, but V1 must not allow both for the same identity.
- A **Marketplace Participant** has exactly one role: **Author** or **Publisher**.
- An **Author** owns zero or more **Manuscripts**.
- A **Manuscript** belongs to exactly one **Author** and has at most one **Active Sample**.
- A **Sample Document** belongs to exactly one **Manuscript**.
- A successful **Sample Check** can produce many **Document Chunks** and many **Embedding References**.
- An **Eligibility Status** controls product behavior, while a **Review Outcome** explains the decision path.
- A **Publisher Profile** provides one required guidelines **Publisher Signal** and may provide optional wishlist and catalog signals.
- A **Manuscript** provides premise, voice, and arc **Manuscript Signals** when enough trusted source material exists.
- A **Match Run** produces zero to twenty-five visible **Match Candidates**.
- A **Match Candidate** can unlock **Profile Access**, but it does not unlock private contact details or the **Active Sample**.
- A **Manuscript Access Request** belongs to exactly one **Publisher** and one **Manuscript**.
- An **Intro Request** is tied to exactly one **Manuscript** and one **Publisher**.
- An **Accepted Intro** unlocks counterparty contact details and the relevant **Active Sample**.
- A **Subscription Plan** may grant **Entitlements** or **Intro Request Quota**, but it must not secretly improve matching relevance.
- An **Admin Exception** may reference a profile, manuscript, document, report, payment, or system process.
- An **Audit Log** records both automated outcomes and staff decisions, while Sentry records runtime diagnostics.

## Example dialogue

> **Dev:** "When an **Author** uploads a **Sample Document**, should it immediately appear in **Discovery**?"
> **Domain expert:** "No. The **Sample Check** must pass first, and the **Manuscript** needs an **Eligibility Status** of **Eligible** before discovery or matching flows can use it."
> **Dev:** "If a **Publisher** sees a **Match Candidate**, do they get the author's private email and the sample file?"
> **Domain expert:** "No. A **Match Candidate** can grant **Profile Access** and may show **Match-Visible Contact**, but private contact details and the **Active Sample** unlock only after an **Accepted Intro**."
> **Dev:** "Should a paid **Subscription Plan** make a publisher rank higher?"
> **Domain expert:** "No. Plans can grant **Entitlements** and **Intro Request Quota**, but **Match Runs** must keep relevance independent from payment status."
> **Dev:** "Where do suspicious uploads go?"
> **Domain expert:** "They become **Admin Exceptions** with **Needs Review** or **Quarantined** outcomes, and the **Audit Log** records the decision path."

## Flagged ambiguities

- "user" is too broad. Use **Auth Identity** for login identity, **Marketplace Participant** for author/publisher users, and **Admin User** for staff access.
- "account" is ambiguous. Use **Auth Identity** for credentials and **Marketplace Profile** for product participation.
- "profile" is overloaded. Use **Marketplace Profile** for the shared product record, **Author Profile** and **Publisher Profile** for role-specific data, and **Match-Revealed Profile** for access-checked profile pages.
- "publisher" can imply an organization, imprint, or staff team. V1 has no organization accounts, teams, or imprints, so use **Publisher** for the marketplace participant and **Publisher Profile** for acquisition preferences.
- "approval" hides two separate concepts. Use **Eligibility Status** for product behavior and **Review Outcome** for the reason or decision path.
- "public profile" is unsafe language in V1. Use **Public Publisher Directory** for logged-out publisher listings and **Match-Revealed Profile** for authenticated access-checked profile surfaces.
- "access" does not always mean contact or sample access. Use **Profile Access** for profile visibility, **Match-Visible Contact** for owner-approved contact fields, and **Contact Unlock** for accepted-intro private contact and sample access.
- "sample", "file", and "manuscript text" should not be mixed. Use **Sample Document** for the uploaded file, **Active Sample** for the current usable sample, **Document Chunk** for stored bounded text, and **Safe Snippet** for display evidence.
- "match" and "intro" are distinct. A **Match Candidate** is a recommendation; an **Intro Request** is a connection request; an **Accepted Intro** unlocks contact and sample access but is not a contract.
- "report" conflicts with future AI-generated fit reports. In V1 use **Report** only for user or staff complaints, and use **Fit Reason** or **Match Detail** language for match explanations.
- "quota" can refer to many limits. Use **Intro Request Quota** for plan-limited intro sends and use rate limit wording for abuse-prevention limits such as match runs per hour.
- "payment" must not imply marketplace money movement. Use **Subscription Payment** for PayTR SaaS billing only; contracts, escrow, payouts, royalties, and commission accounting are outside V1.
