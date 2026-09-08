# Revio — consolidated external review and product handoff

Prepared by Codex on 2026-09-08 at the founder's request. Written in English for Claude Code.

## Purpose and authority

The founder wants the technical review, product opportunities, competitor research and Operator
organisation assessed together, without losing the existing architecture or duplicating work.
This document consolidates the conversation; it is **not a second source of current project status**
and is **not an instruction to build everything listed**. `docs/STATUS.md` remains authoritative.

The immediate request to Claude is: verify the claims against current code, reconcile overlapping
proposals, prioritise them and return a concrete implementation plan. The earlier five technical
findings are preserved separately from feature proposals. The founder may handle those separately;
do not assume they are still unfixed or silently mix them into a UI refactor.

Read first: `CLAUDE.md`, `AGENTS.md`, `docs/STATUS.md`, `docs/GAP-REGISTER.md`,
`docs/UI-STANDARD.md`, `docs/WORK-LOG.md`, `docs/SPEC-08-DECISIONS.md` and
`docs/SPEC-08-TRACKER.md`. Read module guides before implementation.

Also reconcile `docs/COMPETITIVE-GAPS-2026-09.md`, which appeared during parallel work. It was
untracked when this handoff was prepared and has been deliberately left untouched. Treat both
documents as review inputs, not two independent backlogs. Section 7 lists disagreements to resolve.

## 1. Evidence, freshness and limits

- Technical review baseline: `0f87df3`. Documentation preparation baseline: `b92e4cb`, whose change
  restores the Support queue to compact rows. Preserve that work; do not rebuild the previous queue.
- At `0f87df3`, `pnpm install`, Prisma generation and `pnpm verify` passed: 1,797 tests,
  no lint errors, 24 warnings within the existing budget, and all ratchet checks passed.
- Five findings below were reproduced using real source functions with in-memory database/dependency
  substitutes. The TOTP boundary reproduction used the actual core TOTP implementation.
  These were ephemeral command-line harnesses, not committed regression tests.
- No PostgreSQL integration reproduction, browser exploit, production write, migration, payment,
  commit or push was performed. Do not describe these as production incidents.
- Product review inspected code/schema/routes and the live Operator Overview and Health screens,
  plus the public homepage and Compare page. It was not an exhaustive usability test of every screen.
- Competitor evidence is official product/help documentation accessed 2026-09-08, not hands-on
  competitor testing. It establishes advertised/documented capability, not relative quality.
- Live values can change and are not commercial verification. For example, Overview displayed
  approximately EUR 142 monthly recurring while STATUS described EUR 0. Reconcile definitions,
  billing eligibility and freshness before treating a displayed plan value as earned revenue.

References below use repository-relative paths and baseline line numbers; locate the named function
again if lines move. No item is assumed open merely because it appears here.

## 2. Reliability findings — independently reproduce before fixing

### R1 — P1: one hold can produce two reservations

**Location:** `packages/booking/src/public-engine.ts:445` and `:659`, `publicCreateReservation`.
Caller: `apps/booking/lib/actions-book.ts`, `confirmBooking`.

Both concurrent requests can observe the same active hold, skip `claimHold`, create separate
reservations and then attempt conversion. Creation and conversion are separate transactions;
the conversion's affected-row count is ignored.

**Sequence:** one remaining room, one active hold, identical dates/room/rate; send two simultaneous
confirmations sharing that hold. The harness returned two successful reservation IDs, zero new
atomic claims and conversion row counts `[1, 0]`. The losing conversion does not undo its reservation.
This applies to inventory-consuming requests as well as confirmed bookings.

**Comment contradicted:** inventory is "handed straight to the booking with no window in between."
The existing `engine-race` script races hold creation, not reservation confirmation.

**Confidence:** high at service level; actual database concurrency reproduction remains required.
**Acceptance:** one hold can convert once; a duplicate returns the same result or a clear refusal;
reservation, extras and conversion cannot partially commit. Validate hold room/dates/quantity and
expiry at conversion, not just existence. Test simultaneous submit, retry and expiry boundaries.

### R2 — P1: enrolment can turn off existing 2FA without a password

**Location:** `packages/db/src/two-factor.ts:78`, `beginEnrolment`; all four staff apps'
`actions-2fa.ts:startTwoFactor`. Operator and hotel wrappers delegate to the shared implementation.

**Sequence:** an account already has 2FA enabled. With a valid session, invoke `startTwoFactor`
again and stop before confirming enrolment. It writes `totpEnabledAt: null`. The harness showed
enabled becoming false. A hidden setup button does not protect the server action.

**Comment contradicted:** re-enrolling "clears any previous enablement"; the dedicated disable action
requires a password specifically because an unattended laptop must not suffice to disable 2FA.

**Confidence:** high. This is a session-based bypass of reauthentication, not anonymous account access.
**Acceptance:** starting setup must not remove an existing factor. Replacing a factor needs the
appropriate reauthentication and audit trail; the current factor survives abandoned replacement.

### R3 — P1: stale Close Day submissions close the following day

**Location:** `apps/pms/lib/close-day-run.ts:88`, `runCloseDay`;
`apps/pms/lib/actions-closeday.ts:closeDay`; `apps/pms/lib/auto-close.ts`.

**Sequence:** two staff members view September 7. The first closes it; the second submits their
unchanged screen after that commit. The function reads September 8 and closes it instead. The
harness produced `07 -> 08`, then `08 -> 09`. That can prematurely mark September 8 arrivals no-show.
The scheduled caller can likewise calculate eligibility from an older date and invoke the function
after another actor has advanced it; inspect that interleaving too.

**Comment contradicted:** "The condition on the roll refuses both" concurrent and sequential runs.
The optimistic update protects only a date change after this invocation's own read. The gap
register repeats the stronger, incorrect claim.

**Confidence:** high. **Acceptance:** close the date explicitly intended by the caller, refuse a stale
intent and recheck scheduled eligibility. A catch-up close of an intentionally selected overdue day
must remain possible. Test sequential stale submissions and overlapping manual/scheduled closes.

### R4 — P1: accrual failure advances the day and loses the failed night's work

**Location:** `apps/pms/lib/close-day-run.ts:151`, after the date-roll transaction.

**Sequence:** close September 7; inject failure in `accrueStayExtras` after the date roll commits;
retry. The next call reads September 8. The harness accrued September 8 only; September 7 was
not retried. Audit creation and channel notification also follow accrual and may be skipped.

**Comment contradicted:** accrual is outside the transaction because it "is idempotent". Idempotency
does not ensure recovery when the next invocation uses another date. The function header also
describes accrual/date roll as atomic when they are not.

**Confidence:** high under injected dependency failure.
**Acceptance:** a failure cannot silently strand a partially closed date. Use an appropriate atomic
boundary or durable, retryable close workflow; do not prescribe a long-running transaction blindly.
Prove recovery after each write boundary without missing or duplicating charges or the close record.

### R5 — P2: TOTP replay prevention accepts the same code twice

**Location:** `packages/db/src/two-factor.ts:152`, `verifySecond`, and `two-factor-stores.ts`.

**Sequence A:** submit one code at step T + 29 seconds, then at T + 31 seconds. Both return success
because the stored value is the server's current step, not the step of the code matched within the
accepted drift window. **Sequence B:** two concurrent submissions in the same step both read the
old value and perform unconditional writes; both succeeded in the harness.

**Comment contradicted:** the previous step's code cannot be reused. The accepted drift window
allows precisely that when the server step advances.

**Confidence:** high with real TOTP logic and a substituted store. A password-authenticated pending
login is a prerequisite. **Acceptance:** atomically consume the matched step with replay-safe drift
handling. Review recovery-code consumption for the same read-then-write shape; that extension was
not independently reproduced. Add boundary and concurrent regression cases for both account types.

## 3. Product position and existing capabilities to preserve

Working target: independent hotels and small groups, consistent with the current website. A family
resort, hostel, conference hotel and self-service apartment operator have different mandatory needs.
Choose priorities from actual target workflows, not total feature count.

Revio has a substantial operational foundation. It is not yet demonstrated to satisfy every hotel's
needs, and feature presence is not evidence that the full customer journey works reliably.

| Product | Existing foundation observed | Next workflows to evaluate |
| --- | --- | --- |
| PMS | Check-in/out, assignments/moves, rooms, housekeeping, maintenance, folios, extras, invoices, Close Day, tourist register | Shift handover, pre-arrival preparation, accountant handoff |
| CRS | Reservations/holds/modifications, rates/restrictions, guest profiles, analytics, waitlist | Migration import, offer-to-book link, groups/corporate business when required |
| Link | Shared availability, Channex, mapping, pricing/restrictions, sync/error/audit surfaces | Complete post-provisioning structure changes; explain why a room/rate is not selling |
| Direct | Search/all-in quote, room photos, hold, request/confirmation, extras, alternatives/waitlist | Languages, family pricing, multiple rooms, protected guest self-service, funnel measurement |

Do not rebuild hotel MFA, guest export/anonymisation, extras, waitlist, staff product analytics,
support threading, jobs health, onboarding or shared Settings navigation as supposedly absent.
Presence still requires verification of completeness, permissions and runtime behaviour.

Operator Support is **hotel -> Revio**. Guest messaging is **guest -> hotel**: reuse appropriate
presentation patterns, not the support database perimeter or authorisation assumptions.

## 4. Operator organisation proposal

The current sidebar has 13 links and places analytics, pricing, invoices, connectivity, health,
errors, history, auth log and settings together under Platform. The live Health page already embeds
job health and application errors. Add clear ownership and navigation rather than another dashboard
that duplicates them.

| Proposed area | Existing material and proposed responsibility |
| --- | --- |
| Today | Evolve Overview into an actionable daily view: affected customers, overdue support, onboarding, renewals; retain useful commercial context |
| Customers | Clients and Demo requests; onboarding progress; a coherent customer detail workspace |
| Support | Queue and threads; links to customer and related incidents; preserve the new compact queue |
| Revenue | Billing and Plans & pricing as distinct views in one area |
| Operations | Health, Jobs, Errors and Connectivity with common customer/property/time filters |
| Product | Usage analytics, roadmap, releases and historical decisions |
| Settings & Security | Company, operator staff, personal security and Auth log; urgent security information must remain discoverable |

Start with navigation groups and existing routes. Do not break bookmarks, actions or revalidation
paths to achieve a cleaner menu. Test active states, mobile navigation, keyboard access and deep links.
The current Auth log placement is explicitly justified by emergency discoverability; address that
reason before moving it under another area. Plans-before-Billing also has deliberate reasoning.

Customer detail proposal: Overview, Products & onboarding, Billing, Support, Activity tabs with
customer identity, responsible operator, next action and due date kept visible. Reuse existing CRM
ownership/contact/renewal fields and distinguish derived milestones from human commitments.

An incident may affect many hotels and relate to many support tickets. Link these concepts rather
than merging support messages, sync failures, app errors and audit entries into one ambiguous log.
An incident workspace can show impact, owner, next update, mitigation and resolution evidence.
Treat any new incident data model as a separate scoped feature, not a prerequisite for regrouping menus.

### History, roadmap and release truth

`apps/operator/lib/platform-history.ts` has dated milestones and a separate static roadmap. Its
hotel-admin MFA item still says Now/Must although MFA exists; guest-rights work also needs reconciliation.
The staging item must be reconciled with the repository's deliberate demo-in-production policy, not
treated as authority to create infrastructure.

Keep historical decisions, present work and actual releases distinguishable:

- Suggested lifecycle: Planned -> In progress -> Implemented -> Verified -> Released.
- Blocked/Deferred/Rejected are explicit outcomes with reasons, not forgotten checklist entries.
- Each accepted initiative: stable ID, user problem, product, owner, priority, effort, dependencies,
  acceptance criteria, last verified date, and supporting commit/test/deployment evidence.
- A merged commit is not proof of deployment. Release status follows the actual promoted commit.
- Preserve `docs/STATUS.md` as the current authority until an explicit replacement design is agreed.
  Propose a generated projection or single maintained registry rather than manually duplicating
  status in Markdown and TypeScript. No runtime `.git` dependency and no database merely for a list.
- Backfill meaningful milestones from Git/spec evidence; do not invent dates or turn every commit
  into a customer-facing release. Public release notes and internal decision history need different detail.

## 5. Candidate backlog and initial priorities

These are proposals. Effort is relative, not a delivery promise: S = bounded change; M = several
surfaces/workflows; L/XL = cross-product domain work or external integration. Re-estimate after discovery.

| ID | Candidate and hotel benefit | Priority/trigger | Effort | Likely owner/scope and acceptance |
| --- | --- | --- | --- | --- |
| O1 | Reconcile roadmap and regroup Operator | Now | S-M | Operator; current status accurate, existing links/actions intact, no new duplicated totals |
| O2 | Evidence-based onboarding readiness | Before first pilot | M | Operator + existing setup facts; rooms/rates, OTA mapping, test booking/modify/cancel, training and explicit sign-off; never infer readiness from account existence |
| O3 | Customer workspace and incident links | As support volume requires | M-L | Operator; ownership/next action visible, one underlying case per issue, source views remain accessible |
| C1 | Assisted migration/import | Before a hotel switches from another system | M-L | CRS + shared services; preview, mapping, validation, duplicate detection, per-row results and reconciliation; preserve existing reservations and claim inventory safely |
| D1 | Direct guest UI localization | Before serving the target languages | M | Booking UI/shared copy; BG/EN first, complete search-to-confirmation/error/email journey; distinguish UI locale from stored guest language |
| D2 | Children/infant pricing | Before a family property needing differentiated prices | L-XL | Core/DB/CRS/Link/PMS/Direct; H14 and K8 are deliberately deferred; rates, capacity, taxes, OTA representation and folio must agree |
| D3 | Multi-room Direct booking | When families/groups need several rooms | L | Booking/core/DB; party per room, one coherent confirmation, atomic inventory handling, no partially confirmed basket |
| D4 | Direct conversion funnel | Before judging conversion features or advertising ROI | M | Booking + reporting; search -> results -> hold -> submit -> request/confirmed; no-availability/errors/expiry measured; duplicate-safe outcomes, no PII in telemetry |
| D5 | Readable cancellation terms and truthful payment/request states | Before guest-facing sale | S-M | Verify current policy model, booking UI/email and configuration first; show applicable terms and explicit requested vs confirmed, paid vs unpaid |
| P1 | Shift handover tied to real work | First small PMS feature candidate after reliability | M | PMS; task linked to room/reservation, assignee, due time, acknowledgement/completion and history; permissions and property scope; reuse existing tasks where possible; no general chat |
| P2 | Protected pre-arrival registration | After successful pilot; earlier for self-service properties | L | Shared guest/stay domain + guest surface; expiring scoped link, companion details, arrival time, rules; staff review remains authoritative; no automatic check-in from incomplete data |
| P3 | Accountant-ready monthly package | Before first monthly close | M | PMS/export with accountant input; charges, tax categories, payments, deposits, issued documents and corrections reconcile; stable period/currency definitions; no fiscal-device control |
| C2 | Offer-to-book workflow | When reception handles many email/phone quotes | M-L | CRS + booking; priced offer with expiry, explicitly held or unheld inventory, server-side revalidation on acceptance, traceable conversion |
| G1 | Guest inbox and communication workflows | When pilot evidence shows missed messages | L-XL | Tenant-scoped guest conversations linked to reservations; start with a supported channel, add ownership/delivery/retries; do not assume OTA or WhatsApp permissions/integration exist |
| C3 | Groups and corporate business | Before selling to properties that depend on it | XL | CRS/PMS/core; room blocks, release dates, rooming lists, negotiated rates and consolidated billing; labels and split folios alone do not cover this |
| I1 | Specific integrations and stable API/webhooks | Customer's existing tools require it | L-XL | Named accounting/PMS/lock/POS connector first; explicit source ownership, scopes, signatures, retries, idempotency and reconciliation; no speculative marketplace |
| D6 | Promo/private offer links | After pricing and measurement are reliable | M-L | Shared pricing; eligibility, expiry, stacking policy, snapshot and consistent quote/folio; avoid training guests to leave checkout hunting for a code |
| D7 | Abandonment recovery | Only after data capture and permitted contact are proven | M-L | Booking/email; completed-booking exclusion, consent/purpose decision, deduplication, fresh availability/price; never promise the old room remains held |
| D8 | Display currencies | Validated market need | M | Separate display conversion from booking/settlement currency; disclose rate/time and avoid implying settlement support |
| P4 | PWA/push notifications | Proven need for pocket alerts | M-L | Verify current installability first; permissions/preferences, correct recipient/property, duplicate suppression; avoid guest details on lock screens |
| A1 | Explainable revenue hints | Enough real historical data | M-L | Existing metrics first; basis/window/sample size shown, unknown stays unknown; no automatic rate changes |
| D9 | Metasearch | Proven Direct funnel and participating hotels | L-XL | Google/partner eligibility, live price accuracy, landing/booking reconciliation and attribution; validate actual onboarding model before estimating |
| E1 | Enterprise identity and controls | Real group procurement requirement | L-XL | SSO/provisioning and deeper administration scoped to a real buyer; MFA presence alone is not enterprise readiness |
| A2 | In-app assistant | Real usage/support evidence and stable boundaries | XL | Read-only first, existing capabilities, approved mutations and audit; do not put ahead of reliability or daily hotel needs |

Payments remain mocked/test-mode until an explicit live-payments decision. Document the limitation
for hotels needing automated deposits, prepayment, refunds and reconciliation. Do not silently enable
a gateway because it appears in a competitor list. Review requests and fiscalization remain subject
to the existing deliberate exclusions. Do not add artificial scarcity or fabricated guest activity.

### Suggested order

1. Independently validate R1-R5; agree ownership and handle confirmed release-blocking defects.
2. O1: status reconciliation and a small, existing-route Operator navigation increment.
3. Run one real hotel's full journey with O2; identify actual migration/language/accounting blockers.
4. Choose one product increment. P1 is the preferred small PMS candidate, unless the pilot needs D1,
   D2 or C1 to operate at all. Do not implement all candidates in parallel.
5. Follow pilot evidence into pre-arrival, messaging, groups, integrations or conversion work.

The best first increment for coordination is documentation/navigation; the best small new daily
hotel workflow proposed here is shift handover. These are separate recommendations.

## 6. Competitive evidence and website positioning

Official sources accessed 2026-09-08:

- [Mews Guest Portal](https://help.mews.com/s/article/what-is-online-guest-services?language=en_US):
  online check-in/out, guest messaging, pre-filled details, registration and upsells.
- [Mews pricing/packages](https://www.mews.com/en/pricing): PMS, guest journey, payment and integration
  capabilities are packaged at different levels; do not assume every feature belongs to every plan.
- [Cloudbeds Guest Experience](https://www.cloudbeds.com/guest-engagement-software/): unified inbox,
  digital registration and pre-arrival/in-stay communication workflows.
- [Cloudbeds rooming lists](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/48273550614171-How-to-Manage-Rooming-Lists):
  group-specific workflow; verify availability/package and use the updated article rather than an
  older pilot page to judge current limitations.
- [SiteMinder channel manager](https://www.siteminder.com/channel-manager/): distribution, rates,
  restrictions and room/rate-plan publishing; compare the complete operating process, not channel count alone.
- [Little Hotelier](https://www.littlehotelier.com/): a closer small-property comparator, combining
  front desk, channels and booking with guest languages, extras and optional services.

No unsourced ranking, competitor defect claim, conversion percentage or ROI estimate is adopted as
fact. Shared data is a useful foundation, not evidence that competitors cannot offer a coherent suite.
Revio's credible positioning is modular purchase, assisted onboarding, transparent economics and
expansion without re-entering the hotel's existing Revio data.

The live [Compare page](https://reviosoft.app/compare) compares categories rather than naming Mews
or Cloudbeds. The [homepage](https://reviosoft.app/) contains absolute claims such as "It can't
oversell", "Nothing to breach", and language suggesting an OTA reads the same record without sync.
Review these against the actual boundary: one core inside Revio, external delivery to OTAs. Not
storing cards does not remove guest/contact/identity data sensitivity. Also check older "three
products"/"certification-ready" copy against current product packaging and certification state.
The marketing site is a separate repository; assessment here is not permission to deploy changes there.

## 7. Reconcile the parallel competitive document before planning

`docs/COMPETITIVE-GAPS-2026-09.md` adds useful candidates (funnel analytics, promo codes, recovery,
display currency, PWA/push, revenue hints and metasearch), included above. Some claims need evidence:

- **Abandoned email capture:** the Direct form collects an email for submit; that does not prove a
  guest who abandons before submit has a persisted, contactable record. Trace persistence before
  calling recovery a small change using data already available.
- **Cancellation terms:** do not adopt "label only" without checking the current policy model,
  settings and guest rendering. Review whether full terms are actually visible at the decision point.
- **Pre-arrival messaging:** templates include `pre_arrival`; trace scheduling and delivery before
  declaring either a complete workflow or total absence. A template is not a sent message.
- **Analytics:** staff usage exists; guest funnel is distinct. Choose first-party events versus
  GA4/GTM deliberately. An arbitrary tag-manager container can execute third-party code; it is not
  merely another text setting. Decide consent, access and data handling before implementation.
- **Tax/currency timing:** verify current official requirements before turning a euro-transition
  remark into a mandatory feature. No legal deadline or currency conversion obligation is established here.
- **Competitor/statistical assertions:** claims about abandonment rates, majority search traffic,
  typical commissions, all-in pricing rarity and guaranteed recovery return need dated sources and
  a relevant population. They are not planning facts merely because they appear in a local document.
- **Payments/integrations:** neither "always mandatory now" nor "only useful at scale" holds for
  every segment. A small self-service property can need locks/deposits more than a staffed large one.
- **Prioritisation:** "nothing before a real hotel" must not delay a fix or a prerequisite that hotel
  needs to start. Equally, competitor parity is not a reason to postpone the pilot indefinitely.

## 8. Architecture, verification and multi-agent coordination

Preserve TypeScript/Next/pnpm/Prisma conventions and existing UI components. Apps depend on packages,
not other apps. One availability and pricing core; integer minor units with currency; scoped tenant
access; transactional multi-write operations; atomic inventory claims. Shared UI must not accidentally
share the Operator's system-perimeter access with hotel or guest features.

Keep Channex rate mappings per channel/plan/room-type pair and handle warnings inside successful HTTP
responses. Class 10's structure repair must retain adopt-before-create, immediate mapping persistence,
sandbox rehearsal and the documented duplicate-property decision before exposing its write UI.

For UI changes, inspect empty/error/long-content states on desktop and phone, keyboard and zoom.
Preserve familiar shapes and shared components. Unit/lint success is not a usability sign-off.
For money/inventory/auth changes, regression tests must fail against the pre-fix behaviour, including
concurrent and failed-write paths where relevant. Follow repository pre-commit checks and CI gate.

Coordination protocol:

1. Read current Git status, latest commits and WORK-LOG; pull safely before starting. Never overwrite
   someone else's dirty/untracked files. A prior report is a snapshot, not a lock on those files.
2. Agree one accepted work item and one writer per overlapping file/domain; append a bounded claim
   with exact paths. A file appearing unchanged is not evidence another agent is idle.
3. Suggested split, only after claims: Claude handles agreed core/auth/inventory work; Codex can own
   an isolated Operator/documentation increment. Do not assign both agents to shared layout/components
   or status files simultaneously. Use an isolated worktree when implementation warrants it.
4. Check the board/commits at task boundaries and before edits/merge/push. Periodic polling alone
   cannot prevent collisions; no background monitoring is configured by this document.
5. Complete small verified increments. Record commit, tests, remaining limits and impacted modules.
   Only the agreed release owner pushes; never force-push or push directly to production.
6. Do not claim live from a local test or a green build. Compare the actual promoted production commit.

## 9. Decisions and materials needed

| Responsible role | Needed material or decision |
| --- | --- |
| Founder | First hotel's segment, languages, family/group needs, payment workflow and actual go-live date |
| Pilot hotel/reception | Walk through booking, arrivals, room issues, checkout and handover; provide anonymised sample migration data |
| Accountant + founder | Required monthly export columns/examples and tax treatment; no agent invents the sign-off |
| Claude Code | Verify/reject findings, reconcile existing work, identify smallest increments and dependencies |
| Codex | Own only an explicitly claimed review/documentation/UI increment; this task makes no runtime changes |
| Release owner | Confirm verification, deployment and rollback responsibility for each accepted increment |

## 10. Requested response from Claude Code

Return an assessment before starting broad feature work:

1. R1-R5 verdicts: reproduced / already fixed / not reproduced, with exact evidence and current commit.
2. One reconciled backlog across this file, the competitive gaps file and current STATUS. For each:
   existing capability, missing workflow, target segment, priority, effort, owner, dependencies,
   acceptance criteria and affected modules. Separate universal launch gates from segment requirements.
3. Operator navigation mapping using current routes, explicitly addressing discoverability and the
   existing Support queue work. Identify what can be grouped without any schema change.
4. One concrete first increment, its file claim, verification plan and division of responsibility.
5. Founder decisions/materials still needed, separate from engineering tasks. State what was not checked.

Do not enable live payments, change fiscalization policy, mutate production, deploy the marketing site
or implement the entire backlog as a side effect of this review. Preserve deliberate decisions and
quote their reasoning when proposing a change.
