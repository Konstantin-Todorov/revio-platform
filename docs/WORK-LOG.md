# Work log — who is doing what

**The only channel between agents.** Codex and Claude cannot see each other's sessions; this file is
how each finds out what the other is doing. See `AGENTS.md` §5.

**Claim before you start. Mark done when you finish. Read it before you begin anything.**

Newest at the top. Keep entries short — the commit message carries the detail.

Format:
```
### YYYY-MM-DD · <agent> · <status> · <area>
**<one line: what>**
Files: <the ones you are actually in>
Notes: <anything the other agent needs — a decision, a gotcha, a dependency>
```
Status: `CLAIMED` · `DONE` · `BLOCKED` · `ABANDONED` (say why).

---

### 2026-08-26 · Codex · DONE · Operator platform history
**Adding a curated milestone ledger and a prioritised Now / Next / Later launch roadmap.**
Files: `apps/operator/app/(protected)/platform-history/page.tsx`,
`apps/operator/lib/platform-history{,.test}.ts`, `apps/operator/components/shell/Sidebar.tsx`,
`apps/operator/CLAUDE.md`, `docs/WORK-LOG.md`
Notes: isolated worktree and branch `codex/operator-platform-history`; no database, core, guest,
connectivity or deployment changes. The history is versioned metadata, not a runtime Git reader.
Full workspace typecheck, tests, builds, root lint and copy-lint passed on `c490784`.

### 2026-08-31 · Claude · DONE · OBP H5 — per-occupancy calendar display
**The Inventory Calendar shows the primary rate with an expand, not N permanent rows.**
Files: `apps/reservation/lib/data.ts` (`getInventoryBoard`), `apps/reservation/components/inventory/**`
Notes: §6.5 is explicit — **do NOT explode the grid** to one rate row per occupancy per plan per
room type; that destroys the at-a-glance scan the calendar exists for. Primary by default with a
badge, expand on demand. A per-room plan renders exactly as it does today: `occupancyRates` is absent, and absent means
"unchanged". ⚠️ `roomType.maxGuests` is the occupancy ceiling; `totalRooms` counts rooms. I used the
wrong one as a fallback and the typechecker caught it — a hotel with six doubles would have had a
"primary occupancy" of six.

### 2026-08-31 · Claude · DONE · OBP H2 (screens) — turning it on
**The settings a hotel uses to switch to per-person pricing, and the transactional apply.**
Files: `apps/reservation/lib/actions-obp.ts` (new), `apps/reservation/components/settings/**`,
`apps/reservation/app/(protected)/(property)/settings/page.tsx`, Rooms & Rates (room type
`defaultOccupancy`, rate plan `pricingModel` / `primaryOccupancy`)
Notes: on `main` — the engine is merged and inert at the per-room default, so each screen is an
ordinary gated increment. The apply MUST be one `withTenantTransaction`: a property toggle touches
every plan on every room type, and half of it leaves some plans per-person and some per-room with
nothing recording which. The preview is computed by `planPricingModelSwitch`, the same function that
performs it. **Done — the property toggle exists.** `previewPricingModel` and `applyPricingModel` both call
`planPricingModelSwitch`, so the confirmation a hotelier approves IS what runs. The apply recomputes
rather than trusting a posted plan: a preview is a rendering, not an instruction, and a form can be
replayed after somebody else edited a plan. Rooms & Rates fields (room `defaultOccupancy`, per-plan
override) are wired as actions but not yet surfaced — that lands with H4/H5.

### 2026-08-30 · Claude · DONE · OBP H1 · H2 · H3 · H6 — merged to main
**Occupancy-based pricing, unparked by the founder. Branch `obp/h1-data-model`, NOT main.**
Files: `packages/db/prisma/schema.prisma` + migration, `packages/core/src/rates/occupancy*.ts`,
`packages/db/prisma/seed.ts`
Notes: on a branch because it rewires the rate-resolution path the villa will sell through, and the
villa onboards shortly. Nothing reaches `main` until the piece is coherent and green.
**Build order is fixed by the spec (§6.11 / L10) and must not be reordered** — H1 data model first.
⚠️ Found a **vestigial** foundation: `OccupancyAdjustment` + `occupancyPrice()` exist, are tested,
and are read by **nothing** — only the seed writes one. It is an older "delta from the base price"
shape, not the spec's "occupancy option is a first-class row". Being evolved into the options store
rather than left beside a parallel table.
**Merged.** H1 data model · H2 model switching · H3 Channex mapper + sync wiring · H6 the shared
resolver. **90 tests.** Three invariants that must not be undone:
1. **Per-room is the one-row special case at the CEILING.** Options and stored prices both live
   there. An earlier version had `occupancyKeysFor` writing at `defaultOccupancy` and the two
   disagreed — a stored calendar override read as missing. Caught by a test, not production.
2. **`resolveRate` is the only rate resolver.** RevioDirect and the Channex push both call it, and
   `obp-parity.test.ts` proves quote == push by computing both. Do not add a local `priceFor`; there
   were two identical copies before this and adding an occupancy axis would have made four.
3. **Cascade takes the parent's price AT THIS OCCUPANCY**, not the parent's primary re-offset. That
   applies two discounts and is a different number — asserted as 8000 and specifically not 7600.
**Still open and a hotel cannot switch OBP on yet:** H2 settings UI, H4 bulk matrix, H5 calendar,
H7 PMS folio, H8 inbound, H9–H13. Inert at the per-room default until those land.

### 2026-08-30 · Claude · DONE · Hotel-account MFA (TOTP)
**The account that controls rates and guest data has no second factor. Operator does.**
Files: `packages/db/src/two-factor.ts` (new, generic), `packages/db/src/operator-2fa.ts` (moves onto
it), `packages/db/prisma/schema.prisma` (`User.totp*`, `UserRecoveryCode`), migration,
`apps/{reservation,channel-manager,pms}/lib/{auth,actions-auth,actions-account}.ts`,
`apps/*/app/login/2fa/`, `apps/*/components/auth/`
Notes: extracting the operator implementation rather than copying it — second caller. **One shared
identity across CRS/CM/PMS**, so enrolling in one product protects all three; that is the same
property `sessionsValidFrom` already has and it must not be broken into three per-app secrets.
Scope is larger than the M I first estimated: shared layer + three login challenges + enrolment.
**Done.** Three invariants: the challenge is checked **before** `recordAuthEvent(signIn)` — recording
first writes a successful sign-in for somebody who never passed the code; `verifyTwoFactor` **re-reads
`active` and tenant status**, because five minutes is long enough for an account to be deactivated and
the pending token proves a password, not a still-valid account; and the secret is one per **identity**,
never per app.

### 2026-08-29 · Claude · DONE · Website leads are stored, not just emailed
**A demo request exists only as an email. Lose the email, lose the lead.**
Files: `packages/db/prisma/schema.prisma` (`Lead`, operator_only), migration,
`apps/operator/app/api/leads/route.ts` (new), `apps/operator/app/(protected)/leads/**`,
`apps/operator/components/shell/Sidebar.tsx`, `revio-websites/src/pages/api/contact.ts`
Notes: founder reported not finding submissions. **Resend says every notification was delivered** to
`CONTACT_INBOX` (their Gmail) — so this is not a delivery bug, it is that there is nowhere in the
product to *look*. Email is a notification channel, not a record.
The website is a separate repo with no database, so it POSTs to an operator endpoint behind a shared
secret. That call is **best-effort and must never fail the visitor's submission** — a lead we could
not file is still a lead we must answer. **Done.** `Lead` is `operator_only` and deliberately **not** a Tenant or ClientAccount — these people
are not customers and most never will be, so a tenant row would put strangers into every portfolio
count on Overview. `LEADS_INGEST_SECRET` is set on both services and matches; the operator endpoint
**fails closed** when it is unset.

### 2026-08-29 · Claude · DONE · Security headers, security.txt, stale docs
**Five apps now send security headers; four had none. Three documents corrected.**
Files: `config/security-headers.mjs` (new), `apps/*/next.config.mjs`,
`apps/*/public/.well-known/security.txt`, `docs/ACTION-REQUIRED.md`, `CLAUDE.md`,
`packages/core/CLAUDE.md`
Notes: **no CSP on purpose** — a wrong one breaks the page rather than degrading, and Next needs
specific allowances; it belongs in its own change with a report-only phase. **No HSTS `preload`** —
that is a browser-vendor list and slow to reverse. Booking keeps `SAMEORIGIN` rather than `DENY`
because whether a hotel may embed its own booking page is a product decision, not a default this
file should quietly make. Verified against a running server, not just the config.
Docs corrected: ACTION-REQUIRED item 1 (the Channex key **is** stored — verified 200) and item 4
(fiscalization was **wrong** and is no longer a blocker), and `CLAUDE.md` claimed GDPR shipped in
phase J when it had not.

### 2026-08-29 · Claude · DONE · Guest data rights — export + erasure
**GDPR Art. 15/17/20. The DPA already promises this and it does not exist.**
Files: `packages/core/src/guests/erasure.ts` (new), `packages/db/prisma/schema.prisma`
(`Guest.erasedAt`), `apps/reservation/lib/{data,actions-reservations}.ts`,
`apps/reservation/app/(protected)/guests/[id]/**`, `apps/reservation/app/api/guests/[id]/export/`
Notes: `dpa.astro` tells hotels they can "find, export, correct and erase a guest record yourself".
Find and correct exist; **export and erase do not**. That is a contract, not marketing — a hotel's
DPO relies on it to answer a data-subject request.
Guest PII lives in FOUR places and one must survive: `Guest`, `Reservation.guestName` (a
denormalised copy, the one that gets missed), `Reservation.notes`, `GuestNote.body` — and
`TaxInvoice.buyer*`, which is **legally retained and must never be erased** (Art. 17(3)(b)).
Erasure anonymises in place and never deletes: a deleted guest row would break occupancy history and
orphan an invoice from its stay. **Done.** Two invariants worth keeping: erasure **anonymises in place and never deletes** (a deleted
guest row orphans reservations, and occupancy/ADR are computed from stays — one erasure would rewrite
the hotel's history), and it must also clear **`Reservation.guestName`**, the denormalised copy that
makes an erasure look complete on the screen you did it from and nowhere else. Tax invoices are
deliberately retained under Art. 17(3)(b) and the UI says so before you press the button.

### 2026-08-29 · Claude · DONE · E5 + F5 — verifications, no code
**Holds always carry a TTL (verified); no charts on a guest profile (recorded).**
Files: `docs/SPEC-08-TRACKER.md` only
Notes: E5's real safety property is that **availability reads filter `expiresAt > now()`** in all ten
places — the sweeper is cleanup, not correctness, so a failed sweep cannot cost a booking. Do not
"optimise" those filters away on the grounds that a job exists. F5 is a do-nothing item kept on the
record so nobody adds a chart to a profile showing four bookings.

### 2026-08-29 · Claude · DONE · CRS E2 — range picker + global date-field fix
**One two-month range picker on availability search; `showPicker()` on every other date input.**
Files: `packages/ui/src/{stay-range-field,date-field}.tsx` (new),
`packages/core/src/stays/calendar.ts` (moved from `apps/booking/lib/dates`, 13 tests),
13 files across all four staff apps
Notes: `apps/booking/lib/dates` now **re-exports** the calendar helpers from core rather than owning
them — do not re-add local copies, a second calendar is how two products start disagreeing about
which day a stay begins. `DateField` swallows a `showPicker()` throw on purpose: unsupported
browsers fall back to typing and the glyph, which is where we started.

### 2026-08-27 · Claude · DONE · PMS J1 — folio outcomes reported separately
**Verified the write-off/paid split, found it reported nowhere, built the summary.**
Files: `apps/pms/lib/folio-outcomes.ts` (new, 10 tests), `apps/pms/lib/folio.ts`,
`apps/pms/components/folios/OutcomeSummary.tsx`, `apps/pms/app/(protected)/folios/page.tsx`
Notes: the good news is structural — a write-off posts **no folio line**, so no revenue query can
count it. Do not "simplify" that by posting a zero-value payment line; it is what makes the
separation impossible to get wrong. Collected / owed / lost must stay three numbers on the screen —
there is deliberately no combined total, because €513 written off and €513 paid off-system are the
same figure and opposite events.

### 2026-08-26 · Claude · DONE · CRS F2 — guest merge
**Extracting guest merge + duplicate detection to `@revio/core`, then adding the CRS half.**
Files: `packages/core/src/guests/merge.ts` (new), `apps/pms/lib/{actions-guests,guest-identity}.ts`,
`apps/reservation/**/guests/**`
Notes: merge already exists in the PMS only. Extracting because a second caller has appeared — and it
fixes four things on the way: the merge is **not transactional** (four sequential writes, so a failure
half-merges), duplicate detection **loads every guest in the property** and is then called twice per
profile, the contact back-fill duplicates `hydrateGuestContact`, and it can copy an OTA alias onto the
winner without carrying `emailIsOtaAlias`. **Done — guests are free.** Two things before touching them: the merge rules live in
`@revio/core/guests/merge.ts` and BOTH products call them, so change them there and never in an app;
and an OTA relay address must never match on email — two guests can hold `x@guest.booking.com` and be
different people.

### 2026-08-26 · Claude · DONE · CRS F4 — guest contact hydration
**Enrich-empty / never-overwrite / tag-OTA. `packages/core/src/guests/contact-hydration.ts`, 16 tests.**
Files: `packages/core/src/guests/contact-hydration.ts`, `packages/booking/src/public-engine.ts`,
`apps/reservation/app/(protected)/guests/[id]/page.tsx`, `Guest.emailIsOtaAlias` (migration `20260826140000`)
Notes: the spec said hydrate "from the most recent linked reservation" — **`Reservation` has no
contact fields**, so the source is the booking being made. The bug it fixes: matching a returning
guest by email short-circuited and threw away the phone they had just typed. Never-overwrite is what
makes it safe to run unattended; do not relax it. OTA relay domains are a fixed list, not a
heuristic — a false positive tells a hotel a real address is fake.

### 2026-08-26 · Claude · DONE · coordination
**`AGENTS.md` + this log, so two agents can share the repo.**
Files: `AGENTS.md`, `docs/WORK-LOG.md`
Notes: `AGENTS.md` is the file Codex loads by convention; it points at `CLAUDE.md` rather than
duplicating it. §1 and §2 are the eight code traps and the two Channex traps that have each already
cost real time here — worth reading once even if the rest is skimmed.

### 2026-08-26 · Claude · DONE · website (spec section I)
**All nine website items — I1 through I9.** Repo: `revio-websites`, deployed.
Files: `revio-websites/src/pages/{about,security,compare,how-it-works,index}.astro`,
`src/config/{approaches,offer,site,journey}.ts`, `astro.config.mjs`
Notes: the named `/vs/[brand]` pages are retired; `/compare` compares approaches and the old URLs
301 to it. Two copy claims were **wrong in our own disfavour** and are fixed: the security page said
2FA was not live (TOTP has shipped on the operator console), and a proof line claimed "a real
Bulgarian fiscalization path" we deliberately do not have.

### 2026-08-26 · Claude · DONE · Channex onboarding
**A hotel can put itself on Channex from the product; the mock-channel trap is closed.**
Files: `packages/connectivity/src/channex-{provision,channel-api,channels}.ts`,
`apps/channel-manager/lib/actions-connect.ts`,
`apps/channel-manager/components/channels/{ProvisionChannex,ConnectChannelDialog}.tsx`,
`apps/channel-manager/app/(protected)/channels/page.tsx`
Notes: the Channels screen now has **three** states — on Channex / demo tenant / neither. The
two-state version silently offered the MOCK dialog to a real hotel, which fabricates external ids
and produces a channel that says connected and sells nothing. Do not collapse it back to two.
`Channel.externalChannelId` is new (migration `20260826120000`).

### 2026-08-26 · Claude · DONE · auth + PMS
**Four bugs found by using the product.**
Files: `packages/ui/src/{set-password-fields,login-fields}.tsx`, `apps/*/lib/actions-account.ts`,
`apps/*/components/auth/*`, `apps/pms/lib/{actions-auth,shifts,workforce}.ts`
Notes: setting a password did not clear an existing session, so a manager setting up a new staff
account landed back in their own. PMS sign-in sent every role to `/dashboard`, which a scoped role
may not open — the layout redirected again and the chained redirect produced a white screen. Shift
history is now readable (`summariseShifts`); it was recorded and displayed nowhere.

### 2026-08-26 · Claude · DONE · fiscalization
**Read Наредба Н-18 properly; the July research was wrong.**
Files: `packages/core/src/fiscal/receipt-requirement.ts`, `apps/pms/lib/fiscal.ts`,
`docs/specs/BG-FISCALIZATION-RESEARCH.md`
Notes: **bank transfer is exempt** (чл. 3 ал. 1), so most hotel money needs no fiscal receipt at
all. СУПТО is voluntary and we are declining it. `fiscalizeInvoice` used to stamp a fabricated
`NRA-…` seal on real tax invoices — now demo tenants only.

---

## Open — not claimed by anyone

Pull one of these rather than inventing work, and claim it above first.

| Item | Where | Note |
| --- | --- | --- |
| **H1–H14, K1–K8** occupancy-based pricing | all | **parked by agreement, sequenced last** — do not start without saying so |

## Standing facts worth not rediscovering

- Production Channex account: **0 properties** as of 2026-08-26, verified with a real key and a 200.
  An unauthenticated request returns 401 with no `data` key — do not read that as "zero".
- The full production path is proven: property → room type → rate plan → availability push → rates
  push, all clean, then deleted. **What has never run is connecting a real OTA** (Booking.com
  authorisation), which is the first live test.
- Live services: `cm` · `operator` · `crs` · `pms` · `booking` `.reviosoft.app`, all `/api/health`.
