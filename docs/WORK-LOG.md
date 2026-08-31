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

### 2026-08-31 · Claude · DONE · Walk-ins were accommodated and never registered
**Found by rehearsing, not by reading. Two paths accommodate a guest; I had wired one.**
Files: `apps/pms/lib/actions-frontdesk.ts`
Notes: `walkIn` creates the assignment with `checkedInAt`, opens the folio — and seeded no register
entry. For a villa the walk-in is most of the arrivals, and it is the case where the guest is
already standing there with the document out. Swept every site that sets `checkedInAt`: only
`checkIn` and `walkIn` accommodate anybody (the `data.ts` hit is a synthetic object for a state
calculation), and both seed now. The walk-in passes the name already split, since it is typed off
the document rather than parsed out of a channel's single string.

⚠️ Lesson: the feature was fully tested and fully deployed with a hole in it that no test could see,
because every test exercised the path I had thought of. **Rehearse the flows, not the functions.**

### 2026-08-31 · Claude · DONE · Guest register — slice 2, the официален образец + export
**The заповед's prose is NOT the whole specification. The образец asks for more, and slice 1 was
wrong because I had only read the prose.**
Files: `packages/core/src/registry/tourist-register.ts` (50 tests),
`packages/db/prisma/migrations/20260831180000_register_obrazec/`, `apps/pms/lib/register.ts`,
`apps/pms/app/(protected)/register/`, `apps/pms/app/api/register/export/`
Notes: The Ministry publishes **Образец на регистър за настанените туристи** beside the заповед. It
has **23 columns**, and five things the prose never spells out:

1. **The name is THREE columns** — Име / Бащино име / Фамилно име — with a script rule stated in the
   template itself: *"за български граждани - на кирилица, за чужденци - на латиница, съгласно
   националния документ"*. Slice 1 had a single `fullName`. Corrected by migration; production held
   0 rows, so only dev data was split.
2. **Тип на документ за самоличност** as its own column.
3. **Час** of registration, arrival and departure — not just the dates. Taken from the ASSIGNMENT
   (what happened), not the booking, and rendered in the property's timezone: a guest accommodated
   at 00:30 Sofia is 21:30 UTC the day before, which would file the arrival on the wrong DATE too.
4. **Средна цена на нощувка**, optional — computed per PERSON, not per room.
5. **Анулирана регистрация** — the answer to what to do with an entry made in error. It is cancelled
   in place, keeping its пореден номер. A register with holes in its numbering cannot be shown to
   have had none: the gap looks identical to a removed guest.

⚠️ **There is no public XSD or API.** I looked. The Ministry publishes user guides and this Excel
образец, and the direct API route needs certification and an electronic signature. So the export is
the образец's columns in the образец's order, as CSV — **semicolon-separated with a UTF-8 BOM**,
because Excel on a Bulgarian machine splits on the locale list separator and reads a BOM-less file
as ANSI, turning every Cyrillic name to mojibake.

The export is gated on `frontDesk` and `no-store`: it is every identity document the property holds
for the month, in one download. The screen shows documents by their last four characters only.

### 2026-08-31 · Claude · DONE · Guest register (ЕСТИ) — slice 1, capture
**The largest genuine gap for a real Bulgarian property. `Guest` had no identity fields at all.**
Files: `packages/core/src/registry/{tourist-register,countries}.ts` (new, 29 tests),
`packages/db/prisma/migrations/20260831160000_tourist_register/`, `packages/db/src/register-number.ts`,
`apps/pms/lib/{register,actions-register}.ts`, `apps/pms/components/register/GuestRegisterCard.tsx`
Notes: Field list read from **Заповед № Т-РД-14-10 / 11.06.2019** (чл. 116 ал. 1 ЗТ) — the scanned
order itself, not a summary. Compulsory since 1 Oct 2019; class A names **вили** explicitly.

- **т. 1.1 vs т. 1.2 is a real branch, not decoration.** A non-EEA/CH citizen's entry needs the
  document SERIES as well as its number. The UK is not EEA, and that field turns on it.
- **ЕГН is demanded of a Bulgarian citizen and nobody else.** Both halves of the order list a
  personal number, but only a Bulgarian certainly has one — demanding it of a French tourist makes
  the register impossible to complete rather than more correct.
- **Rows open BLANK at check-in and never block it.** A hotel that had to type four passports before
  it could hand over a key would keep the register somewhere else, and we would have built nothing.
  Incompleteness is visible and chased instead.
- **Retention (т. 3, min 2 years) outlives erasure.** GDPR Art. 17(3)(b) — the guest PROFILE is
  anonymised, the register entry stands. `guestId` is ON DELETE SET NULL for exactly this, and
  `removeStayGuest` refuses any entry with data in it.
- The room is a **snapshot**; the dates are **derived**. A move next season must not rewrite where
  somebody slept, but a departure that shifts must not leave the register disagreeing with the folio.
- Register numbers claimed under `pg_advisory_xact_lock`, reusing the `inventory-claim` primitive —
  `MAX+1` outside a lock hands two simultaneous check-ins the same номер.
- `registerNights` delegates to the existing `nightsBetween`; two implementations of "how many
  nights" is how the register and the folio stop agreeing.
- **Not fiscalization.** A guest register reports no sale to НАП and does not make us СУПТО.

⚠️ Still open — **slice 2**: the property-level register screen and the XML export. Today the
register is per-stay only, so the owner cannot yet see or file the whole thing.

### 2026-08-31 · Claude · DONE · Four OBP actions had no UI — mixed per-room/per-person now settable
**A tested, gated, working server action that no screen calls is not a shipped feature.**
Files: `apps/reservation/components/rates/RatePlanPricingBoard.tsx` (new), `rooms-rates/page.tsx`,
`RoomTypeDialog.tsx`, `apps/reservation/lib/{data,actions-rates,actions-obp}.ts`,
`apps/pms/lib/folio.ts`, `apps/pms/app/(protected)/reservation/[reservationId]/page.tsx`
Notes: The read/write sweep of RatePrice came back clean, so I swept the other axis — actions with
no caller — and found four. Two were surfaced, one folded into an existing form, one deleted.

- `saveRatePlanOccupancy` → **Rooms & Rates → "How each plan prices"**. This is the one that
  mattered: Channex carries `sell_mode` on the RATE PLAN, not the property, so per-room and
  per-person side by side is normal (half board per guest, room-only per room) and the mixture
  pushes correctly. The capability was built and unreachable — a hotel could only choose
  property-wide. "Follow the property" is kept distinct from an explicit choice of the same value:
  the first tracks a later change to the default, the second does not.
- `saveRoomDefaultOccupancy` → folded into `saveRoomType` as a field on the room form. A second
  action against the same row is how a room gets edited with its occupancy silently left behind.
- `changeStayOccupancy` → **PMS → the stay → Operational**. It already redirected to that page on
  error; the page had no control and no banner for `?error=occupancy`, so the refusal was invisible.
  Without it a party arriving larger than booked could not be corrected at the desk at all.
- `saveObpDisplay` → **deleted**. Nothing read what it wrote: the age bands are H14 (deferred), and
  `occupancyDisplay: "all"` would expand the grid to one rate row per occupancy per plan — what
  §6.5 forbids. A toggle that changes nothing is worse than no toggle. Columns stay for H14.

⚠️ `pnpm -s typecheck` **swallowed a real type error** and exited 0. `pnpm verify` caught it. Do not
trust `-s` on the recursive scripts.

### 2026-08-31 · Claude · DONE · OBP write-path sweep — onboarding was writing NULL occupancy
**Every RatePrice write audited. Four more were missing the occupancy.**
Files: `apps/reservation/lib/actions-welcome.ts`, `apps/channel-manager/lib/actions-welcome.ts`,
`packages/db/prisma/seed.ts`, `packages/db/scripts/cert-property.ts`
Notes: ⚠️ **Both onboarding flows wrote rate rows with no occupancy at all** — so a hotel onboarding
after the OBP migration set a price and saw "—" on every calendar cell, because `resolveRate` asks
for a specific occupancy and a NULL row matches none. `skipDuplicates` would not have deduped a
retry either: NULL is not equal to itself in a unique index. **This was on the villa's path.**
Onboarding now also creates the plan's `RatePlanOccupancy` row, so a date beyond the 180-night
window falls back to the plan's own price instead of resolving null.

### 2026-08-31 · Claude · DONE · OBP bug sweep — five bugs I introduced
**Adding a dimension to a key broke every reader that assumed one row.**
Files: `apps/pms/lib/actions-frontdesk.ts`, `apps/pms/lib/move-reconciliation.ts`,
`apps/reservation/lib/data.ts`, `apps/channel-manager/lib/data.ts`, `apps/pms/lib/reprice*.ts`
Notes: ⚠️ **The lesson worth keeping.** `RatePrice` went from one row per (room, plan, date) to one
per occupancy. The TYPE did not change, only the cardinality — so the compiler caught nothing and
four readers silently broke: three kept an arbitrary row via `new Map()`, and the walk-in **summed
every occupancy**, charging roughly 4× on a 4-guest room. When you add a dimension to a key, grep
every reader; the types will not help you.
Fifth: `repriceStay` was **dead code** — built, tested, K4 marked done, and called by nothing. Now
wired into the cross-type move, plus `changeStayOccupancy`, which did not exist at all: nothing
could record that a guest added a second person.

### 2026-08-31 · Claude · DONE · OBP H4 — bulk occupancy matrix
**The Price control becomes a matrix; two entry modes; mixed caps handled.**
Files: `packages/core/src/rates/bulk-occupancy.ts` (new + tests),
`apps/reservation/components/rates/CrsBulkPanel.tsx`, `apps/reservation/lib/actions-rates.ts`
Notes: ⚠️ **The mixed-cap rule is the OPPOSITE of the plan-level one, on purpose.** §6.4: render rows
to the HIGHEST cap across the selected room types and SKIP occupancies exceeding a given room's max
when applying — never send occupancy 4 to a 2-cap room. `planCeiling` takes the smallest because it
DEFINES a plan; this edits a matrix across rooms. Both are right; they answer different questions.
**Done.** Default entry mode is primary-plus-offsets, because typing four prices to express one
rule is how a hotelier decides the feature is not worth it.

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
