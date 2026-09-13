# Work log — who is doing what

**The only channel between agents.** Codex and Claude cannot see each other's sessions; this file is
how each finds out what the other is doing. See `AGENTS.md` §5.

**Claim before you start. Mark done when you finish. Read it before you begin anything.**

Newest at the top. Keep entries short — the commit message carries the detail.

### 2026-09-13 · Claude · DONE · §4.4 — reading the destination instead of the attempt
Files: `packages/connectivity/src/{published-check.ts,published-check.test.ts,channex-channel-adapter.ts}`.

⚠️ **Every other signal in this system reports on the ATTEMPT.** "Pushed 2,000 updates · success"
says a request was accepted — and from our side a mis-mapped push and a correct one are
indistinguishable, because both succeed. That is how €666 sat published against the wrong room for
days with the Sync Center green (BUG-019), and how 411 consecutive "Pulled 0 revisions · success"
events came from a revoked key (BUG-014).

`readPublishedRates` reads what Channex is publishing **right now**. ⚠️ A failed read returns an
ERROR, never an empty list — `data.length ?? 0` reads "zero rows" for a dead key exactly as for an
empty account, the trap named three times in the root `CLAUDE.md`, and an empty answer here would
report "nothing published" and look like a finding rather than a failure to look.

`comparePublished` keeps three findings apart, deliberately: **mismatch** (landed somewhere
unexpected or was overwritten), **missing** (never arrived — a mapping or a push that did not
happen), and **unexpected** (the channel publishing something we did not send). They have different
causes and different fixes, and one count covering them would send somebody to the wrong screen.
`unexpected` is the one that names the €666 fault *from the other end* — the price sitting on the
room it was wrongly written to.

A test reproduces that fault from the destination: 1BR asked for 666 and holds 150, while 2BR holds
666 it was never sent. Two findings that name each other.

`summarisePublished` says **"Nothing to check"** on an empty result rather than "0 problems", which
reads as a clean bill of health and is not one.

`pnpm verify` green, 2,443 tests. **Not yet wired to a screen** — the verify strip on the Mapping
page is the remaining piece.

### 2026-09-13 · Claude · DONE · §4.5 — a real channel stops trusting a property-wide mapping
Files: `packages/connectivity/src/{rate-mapping.ts,sync.ts,room-scoped-mapping.test.ts}`.

§4.5 says existing mappings "must be treated as untrusted". Showing them as `unconfirmed` was half
of that; the other half is that they were **still pushing**. A catch-all cannot say which room a
Channex rate plan belongs to, so publishing through one means knowingly sending a price that may
land on the wrong room. **A wrong price on an OTA is worse than no price** — no price is visible,
a wrong one is invisible until somebody books at it.

`indexRateMappings(rows, { allowCatchAll })` — false for every real channel, true for mock, where a
catch-all is the normal shape and the adapter has no per-room model to disagree with. Defaults to
true, so every existing caller is unchanged.

⚠️ **The counted blast radius on production:** all six of Hotel Sofia's mock channels and Black Sea's
two are untouched. Channex Sandbox (demo) loses 4 pairs. **DesManagement 2015 — the real hotel — has
2 catch-all rows, so BB Flex stops pushing until it is mapped per room.** That is deliberate: today
those pushes land on the 2-Bedroom whatever room they came from.

⚠️ **And I nearly shipped the same defect in new clothes.** The `unmapped` check only looks at ROOM
mappings, which DesManagement has — so the push would have run, skipped every BB Flex pair, and
reported success having sent nothing. Skipped pairs are now counted and named in the sync summary:
*"2 not sent — no mapped rate plan for Apartment, 1 Bedroom · BB Flex. Map them under their room in
Mapping."* A push that sent nothing can no longer read as a clean success.

`pnpm verify` green, 2,433 tests; CM builds.

### 2026-09-13 · Claude · DONE · BUG-019 closed — the Mapping screen is room-scoped
Files: `apps/channel-manager/lib/data.ts`, `apps/channel-manager/app/(protected)/mapping/page.tsx`,
`apps/channel-manager/components/mapping/MappingEditDialog.tsx`, `apps/channel-manager/lib/actions-config.ts`.

The screen now shows **one row per (room type, rate plan)**, grouped under the room, and the edit
dialog carries `mappingRoomTypeId` so the save writes a room-scoped row. That was the only missing
half: `ChannelRatePlanMapping.roomTypeId` and `resolveExternalRateId` have always supported it.

Reading the room name above its plans is also §4.3 rule 6 in practice — the sentence "Apartment, 1
Bedroom · BB Flex → …" is what would have made €666 visible in one glance instead of over days.

A catch-all row renders as **"currently publishing to cb75de7d… — set for this room"**: the hotel can
see where its prices ARE going, and the id is deliberately not offered as the value to save, because
for that room it is another room's plan.

**Collisions are on screen.** Two room types pointing at one Channex plan gets a red banner naming
both rooms and saying whichever pushes last overwrites the other. Shown rather than blocked — a
hotel mid-way through re-mapping must not meet a screen that refuses to render.

⚠️ I left `mappingCollisions` computed and unrendered, and the build caught it as an unused
variable. Worth noting because the lint did the job a reviewer would have: a number computed and
never shown is a decision made and hidden.

`pnpm verify` green, 2,430 tests; CM builds.

**Still open from the 13 Sept log:** §4.4's live read-back from Channex (the only trustworthy
confirmation, given BUG-014), §4.5's migration of existing catch-all rows, and §5's bulk-selector
tree. The migration matters most — every existing rate mapping is a catch-all and reads as
`unconfirmed` now, which is correct but means the first hotel to open Mapping sees work to do.

### 2026-09-13 · Claude · DONE · BUG-016 verified, and a correction to the 13 Sept log
Files: `packages/core/src/inventory/waterfall.test.ts`, `packages/connectivity/src/{mapping-rows.ts,room-scoped-mapping.test.ts}`.

**BUG-016 — cancellation DOES return availability, and now has the test the log asked for.**
Traced rather than assumed: cancelling drops the line out of `ROOM_OCCUPYING_STATUSES`, so
`confirmed` is recounted from live lines and the night returns on its own — there is no separate
"restore" path that could be forgotten. Both products re-push: the CRS through `recordPush(…,
stayScope(lines))`, RevioLink through `recordPush(…)` with no scope, and an unscoped push is a
TOTAL one (`inScope` is true when `exactCells == null`). §6's whole sequence is now a test,
including the ordering case — an out-of-order cancellation cannot drift the count, because
`confirmed` is always a fresh count of live lines and never an incremented total.

⚠️ **Correction to the log, and to what I said earlier today.** The two `Standard Rate` mapping rows
are **not duplicates** — a duplicate would be harmless. They are two DIFFERENT room types pointing
at the SAME Channex id (`0ea321e7…`). One Channex rate plan belongs to exactly one room type, so
that means one room's prices overwrite the other's on every push, later one wins, nothing says so.
Same failure as BUG-019 with a different cause: there the mapping was property-wide, here two
room-scoped rows collide. `collidingExternalIds` now finds it — returned rather than blocked,
because refusing to render a screen whose data is currently inconsistent is how somebody gets stuck
with no way to fix it (§4.3 rule 5 warns at the point of choice instead).

`pnpm verify` green, 2,430 tests.

### 2026-09-13 · Claude · DONE · ⚠️ An allocation could out-sell the rooms that physically work
**Found while answering BUG-018. It is in NEITHER bug log, and it is the real oversell path.**
Files: `packages/core/src/inventory/{waterfall.ts,waterfall.test.ts}`, `apps/channel-manager/lib/data.ts`.

`computeWaterfall` read `available = manualSellLimit ?? base`, so a date-level allocation **replaced**
the physical base instead of capping it — and therefore ignored out-of-order rooms entirely:

    physical 10 · out of order 3 · allocation 8   →   available 8, and 8 went to the channel

Seven rooms worked. **RevioPMS creates those OOO periods automatically** whenever a housekeeper or a
maintenance job takes a unit out of order — the one cross-product write named in the root
`CLAUDE.md` — so a burst pipe on Tuesday left the OTA selling a room nobody could sleep in. Silently,
because the number typed last month still looked reasonable.

Now `min(allocation, physical − ooo − closed)`. Holding inventory back still works, which is what the
override is FOR; promising rooms that do not exist does not. `requested` and `cappedBy` are returned
so a screen can explain the difference rather than quietly showing a smaller number than was typed —
and the calendar's warning now names **the number the channel actually receives**, where it used to
note a discrepancy and send the larger figure anyway.

⚠️ **This is a deliberate behaviour change to the platform's most load-bearing function.** All 12
existing waterfall tests pass untouched: the cap only bites when the allocation exceeds what
physically works, which is exactly the unsafe case. It also answers **BUG-018** — 11 against 10 is
now capped at 10 rather than accepted and pushed. A hotel that genuinely wants to oversell needs the
explicit setting the 13 Sept log asks for; a number anyone can type is not it.

6 new tests, including one pinning that a real overbooking still reports as a negative `remaining`
rather than being absorbed by the cap. `pnpm verify` green, 2,421 tests; all three apps build.

### 2026-09-13 · Claude · DONE · BUG-017 · BUG-020 · BUG-022 — the calendar can be read again
Files: `apps/channel-manager/lib/data.ts`, `apps/channel-manager/components/bulk/BulkUpdatePanel.tsx`,
`apps/reservation/components/rates/CrsBulkPanel.tsx`,
`apps/reservation/app/(protected)/(property)/inventory/page.tsx`,
`packages/connectivity/src/{channex-products.ts,channex-products.test.ts,channex-channel-adapter.ts}`.

**BUG-017 — the Bookable row exists.** ⚠️ Computed with `computeWaterfall`, the SAME function the
push uses, from the same inputs — periods and holds are now loaded for the calendar so it can be. A
second, simpler arithmetic here (allocation − sold) would drift from what the channel is told the
moment an out-of-order room or a live hold existed: a screen and a channel disagreeing about one
night, which is the fault class this grid keeps producing. Zero is emphasised, not muted — "nothing
left" is what a hotelier scans for.

**BUG-017's label half.** "Rooms to sell" → **Allocation**; the CRS's "Remaining" → **Bookable**, so
both products name the same quantity the same way. The old label read as the net while holding the
gross, which is why a tester spent a session concluding we were overbooking.

**BUG-022.** The checkbox rendered `roomLabel · name`, so a plan on every room read "Apartment, 3
Bedrooms, Apartment, 2 …" with the name truncated off the end — both plans identical on the one
screen where you choose between them. Name is now the label; the room scope is a small qualifier,
and says **"all rooms"** rather than listing them when it covers everything.

**BUG-020/021 groundwork — `classifyChannexRatePlan`.** A Channex property's `/rate_plans` holds
three different kinds and the dropdown offered all of them equally: property plans, **channel-scoped
entries** (`BB BAR - BookingCom …` — the Booking.com end of the chain, which RevioLink must never
bind to, and which the inactive Standard Rate WAS bound to), and **derived** plans. The adapter now
reads `room_type_id` and `parent_rate_plan_id`, which it was dropping on the floor — and
`room_type_id` is the whole reason mapping can be correct at all. ⚠️ A plan with no room type is
offered to NOBODY: that is the property-wide assumption BUG-019 is made of.

The channel-suffix match is a heuristic and is treated as one — it keeps entries out of a dropdown
and is never used to delete anything. A test pins that "Early Bird - Summer" is a hotel's own plan
name, not a channel scope.

`pnpm verify` green, 2,415 tests; CM and CRS build.

### 2026-09-13 · Claude · DONE · BUG-019 groundwork + BUG-021 stopped from doing damage
**Ventsislav's 13 Sept log, BUG-015…022.** Investigated against the code AND production before
writing anything, because the log itself asks for that.
Files: `packages/connectivity/src/{mapping-rows.ts,room-scoped-mapping.test.ts}`,
`apps/channel-manager/lib/actions-config.ts`.

⚠️ **BUG-015 IS NOT AN OVERBOOKING — and that was the log's own most urgent question.** Proven three
ways: `Rooms to sell` is `DailyCell.inventory ?? totalRooms`, the GROSS allocation (so interpretation
(a) in the log is the right one); the push sends `computeWaterfall(...).remaining`, which subtracts
confirmed; and run with the real production numbers (physical 10, allocation 1, confirmed 1) it
returns **0**. The pull triggers `syncRealChannels` immediately after import. **The real defect is
BUG-017** — the grid never shows the net — so this drops S1 → S2. NOT yet verified from the Channex
side; §4.4's read-back is what would make it self-evident.

⚠️ **BUG-019 is real and the fix is far smaller than the log assumes.** The engine ALREADY supports
room-scoped mapping: `ChannelRatePlanMapping.roomTypeId` exists and `resolveExternalRateId` prefers
a specific row over a catch-all. The defect is that **the screen never wrote `roomTypeId`**, so every
row was a catch-all. Production confirms: `BB Flex roomTypeId = NULL → cb75de7d` (the 2-Bedroom's BB
BAR). **No data-model change is needed.**

`ratePlanMappingRows` now produces one row per (room type, rate plan). Two design decisions worth
keeping: a catch-all reads as **`unconfirmed`, never complete** — it does still push, so hiding it
would be wrong, but showing it green is what let €666 sit unnoticed; and confirming one room
**creates** a row rather than mutating the catch-all, because mutating it would strip the fallback
from every other room mid-cleanup — a second silent fault introduced by fixing the first. The
inherited id is shown as context and **never prefilled**: for the 1-Bedroom it IS the 2-Bedroom's
plan, so offering it would invite confirming the bug in one click.

⚠️ **BUG-021 is worse than reported, and is now blocked.** `fixMappings` fabricates ids —
`channex-rp-BB48`. The log guessed "an arbitrary Channex id"; it is one guaranteed not to exist, so
every later push for that plan targets nothing while the screen says "fixed". Auto-fix now refuses
on any channel whose `connectivityMode !== "mock"` and says where real ids come from. Mock channels
are untouched, so demo hotels behave exactly as before.

Also found, not in the log: **`Standard Rate` has TWO identical mapping rows**, both to the
BookingCom-scoped id.

16 tests including a regression that reproduces the €666 fault from the real production rows.
`pnpm verify` green, 2,405 tests; CM builds.

**NEXT:** the Mapping screen itself (render the per-room rows), BUG-020's central "active plans
only" rule + dedupe, then BUG-017's Bookable row.

### 2026-09-13 · Claude · DONE · Trial analytics — what they did, and what to sell them
**Founder: "we need to know more about the people that went and used the free trials, what happened,
and what we can sell them."** This is the payoff of giving all three products away.
Files: `packages/core/src/trials/trial-reading.{ts,test.ts}`,
`apps/operator/{lib/trial-reading-data.ts,components/analytics/TrialsPanel.tsx,components/analytics/trials-panel.test.tsx,app/(protected)/analytics/page.tsx}`.

⚠️ **The product we sell them is the one they USED, not the one they ticked at signup.** A hotel
that chose "stop the OTAs double-booking my rooms" and then spent three weeks in the front desk is a
RevioPMS sale, and their own days of use are the argument. That only works because every trial gets
all three — this screen is where that decision earns its keep.

**A trial is not a customer and `engagementOf` is the wrong lens.** Engagement judges a rolling
thirty days and calls a silent fortnight "quiet". A trial has a deadline: five silent days at day 26
is most of the remaining chance gone, and the same silence at day 4 is nothing. `readTrial` weighs
silence against how much clock is left, so **drifting** is caught while it can still be fixed rather
than reported at expiry.

Two refusals worth keeping: a trial with four page views is **never** called an opportunity — it is
a rescue, and the action says "check they got the confirmation email", not "sell them RevioPMS"; and
one person poking about is not a hotel adopting anything (`people >= 2` before asking for the order).

⚠️ **Usage is counted only INSIDE each trial's own window**, or a hotel with a year of RevioLink
would look like a wildly engaged RevioPMS trial on activity that has nothing to do with it.

⚠️ **Found by looking at the rendered screen, with all 15 tests green:** a trial ended early still
has a future `endsAt`, so the row read **"ended · was used"** beside **"11 days left"** on one line.
`TrialReading.finished` now exists and the countdown is gated on it. Also renamed a test fixture
from `use()` — ESLint treats every `use*` function as a React hook, so it failed `next build`
rather than vitest, which is a slow way to find out.

`pnpm verify` green, 2,391 tests; operator builds.

### 2026-09-13 · Claude · DONE · The screen a hotel meets when its trial ends
**Founder: check what a hotel actually sees at trial end — suspend, never delete, they come back.**
The data was already safe; the SCREEN was the problem, and it was the last thing we say to the
person most likely to pay us.
Files: `packages/core/src/trials/product-access.{ts,test.ts}`, `packages/ui/src/product-locked.tsx`,
`packages/db/src/self-trial.ts`, all three `app/(protected)/layout.tsx`, three `KeepItButton.tsx`.

⚠️ **Three situations were sharing one sentence** — *"This hotel hasn't subscribed to the Channel
Manager. Contact Revio to enable it."* — written out by hand in all three apps. For a hotel whose
30-day trial had just ended it is **false** (they did subscribe; it finished), a **dead end** (no
address, no link, no button), and identical to "never had it" and "we switched it off".

Now one shared `ProductLocked`, with `productAccessState` deciding which it is. Trial ended says so,
names the date, and states that **nothing was deleted** — the fear that actually stops somebody
coming back. It always carries the products that DO still open, because a trial ends per product and
a hotel locked out of RevioLink may be in RevioCRS every morning; a wall with no doors is how
somebody decides the whole platform is broken rather than that one licence lapsed.

`requestKeepTrial` now accepts a FINISHED trial. It only looked at running ones, because its only
caller was the in-trial banner — so the hotel most worth hearing from was the one case that could
not press the button at all.

**A flaw in my own screen, found by looking at it rendered:** the "never had it" copy promised "try
it free for 30 days" with nothing to press. An offer with no button is a worse dead end than no
offer. The flow lives inside `(protected)` so it cannot be hosted by the product they are locked out
of — it now launches from one they can open, and is omitted entirely when there is none.

Also corrected a test of my own rather than the code: React escapes `'` as `&#x27;`, so asserting on
raw markup makes a test pass because it was written around the escaping rather than because the
words are right. The helper un-escapes first.

`pnpm verify` green, 2,367 tests; all three apps build.

### 2026-09-12 · Claude · DONE · A client can be deleted — and the cascade did not reach everything
**Founder: "we cannot delete a client. That's strange. I think we have to do that in our operator."**
Correct — there was no delete path anywhere in the codebase. Building one found something worse.
Files: `packages/core/src/billing/client-deletion.{ts,test.ts}`,
`packages/db/src/{client-deletion.ts,client-deletion.db.test.ts,public-signup.integration.test.ts}` +
`migrations/20260912230000_deleted_client/`, `apps/operator/{lib/actions.ts,components/clients/DangerZone.tsx,app/(protected)/clients/[id]/page.tsx}`.

⚠️ **`tenant.delete()` would have left SIX tables behind.** The cascade reaches 55; six carry
`tenantId` as a plain column with no foreign key, because the RLS pattern needs the column rather
than the constraint. Two of them matter a great deal: **`ConnectivityCredential`** — encrypted OTA
credentials, which would have sat in the database forever after the customer left — and
**`Invoice`**. Orphans raise no error and RLS hides them, so nobody would ever have noticed.

**The list is checked against the live schema, not maintained by hand.** `client-deletion.db.test.ts`
asks Postgres to recompute the cascade closure and fails when the set changes, with a message naming
the file to edit. Proved red by removing `ConnectivityCredential` from the list.

**Deleting is refused for a client who traded.** `canDeleteClient` blocks anything with a **sent or
paid invoice** — a tax document that exists in their accounts and their auditor's, where deleting our
copy only means we cannot answer about it — and names suspension instead, which is the founder's
rule: *they can come back at any time.* No override, deliberately.

The UI states what goes (`43 reservations · 2 properties · 5 logins`, counted not estimated) and
requires typing the client's own name — the one confirmation that cannot be produced without having
read which client it is. **Super-admin only**, the console's only role-gated action, because it is
its only irreversible one. A `DeletedClient` row survives, written inside the same transaction.

`pnpm verify` green, 2,347 tests (17 new, 3 of them against a real database); drift-lint clean.

**STILL OPEN from the same message:** trial-end should SUSPEND rather than leave a hotel with zero
entitlements — needs checking against what such a hotel actually sees; and the signup/trial analytics.

### 2026-09-12 · Claude · DONE · Ran the real signup on production, and it found two bugs
**Founder: "did we fix all errors? … everything needs to be fixed."** Verified the whole path rather
than the pieces, which is how both of these surfaced.
Files: `packages/email/src/transport.ts`, `apps/channel-manager/{lib/actions-signup.ts,app/signup/sent/page.tsx}`,
`packages/core/src/onboarding/signup.test.ts`, `docs/partner/SIGNUP-AND-LOGIN-BRIEF.md`.

**Verified on production, not asserted:** all 10 routes in the signup→login journey across the three
products serve 200; `RESEND_API_KEY`/`EMAIL_FROM`/`AUTH_SECRET` are set on all three services;
Railway's service URLs are the CUSTOM domains, so the emailed accept-invite link is right whichever
product they choose. A real signup driven through a real browser produced exactly the designed row:
`pending_signup`, all three entitlements **false**, **zero** trials, one property, one rate plan,
owner with no password, one unused invite token.

⚠️ **BUG 1 — "expires in 48 hours" was invented.** `TOKEN_POLICY.invite` says **7 days**; 48 hours
appears nowhere in the code. A hotel told the wrong one abandons a link that still works. Now read
from the constant, with a test asserting the email states the policy's own label.

⚠️ **BUG 2 — the confirmation email's result was discarded.** `sendEmail` returns `{ok:false,error}`
and never throws (deliberately — a mail outage must not turn a completed booking into an error
page). Signup ignored it, so a refused send still showed "Check your email". **~20 call sites across
the platform do the same** — staff invites, password resets, trial warnings. Fixed centrally: the
transport now logs every failure once, which covers the whole class and cannot be forgotten at a
call site added next month. Signup additionally acts on it, telling the hotel the account exists and
to press again — which reaches the "resent" branch, so the recovery path already existed.

⚠️ **The RLS worry is CLOSED and the news is good.** Production's migration role is `postgres` with
`usesuper = t`, so it bypasses FORCE RLS. Checked on the data: `Folio.outcome` has every closed
folio filled (14 settled · 3 outstanding · 2 paid_offsystem, open ones null), `Hold.source` shows
17 staff / 23 booking_engine, `User.emailKey` 13 of 13. **No past backfill was lost.**

⚠️ **A smoke-test tenant is sitting in production** — `Revio Smoke Test DELETE ME`, inert
(`pending_signup`, no entitlements, no trials). Founder to remove; agent cannot write to production.

`pnpm verify` green, 2,336 tests.

### 2026-09-12 · Claude · DONE · The all-three trial silently changed the onboarding
**Founder: "the onboarding has to be maybe for most of the products, so they don't have a problem
when they go into the different products."** Checking that found a gap the all-three decision had
just created — and it is the kind that loses a booking rather than showing an error.
Files: `packages/core/src/onboarding/welcome.{ts,test.ts}`.

⚠️ **"Where your bookings go" was being skipped for every self-signed-up hotel.** The step was
omitted whenever the hotel owned RevioCRS or RevioPMS, on sound reasoning: a channel booking lands
in the CRS where a human looks. That held while an operator granted products one at a time — owning
one meant somebody chose it.

**Public signup gives every hotel all three the moment it confirms its email.** So a hotel that
signed up saying "stop the OTAs double-booking my rooms" owns a CRS it may never open, and the
screen asking where its bookings should be emailed disappeared. Channel bookings would arrive
somewhere nobody was watching, and nothing anywhere would have said so.

The rule is now the cheap one: **ask unless it is already answered.** The step is skippable, so a
hotel that genuinely watches its CRS dismisses it in a click — a far smaller price than a booking
nobody sees.

The existing test asserted the OLD behaviour, so it went red. Rewritten rather than deleted: it now
pins the reversal and says why, plus the founder's scenario directly (all three owned on day one,
whichever product they land in). `alsoRuns`'s contract comment is corrected too — it said "Empty on
a first onboarding", which public signup made false, and any rule reading it as evidence of USE is
now marked wrong.

I also got a test wrong on the way and corrected the test, not the code: `satisfied` marks a step
done, it does not drop it, and the house rule is that satisfied-but-unshared is asked anyway,
pre-filled, because the value may be a provisioning default nobody has read.

The rest of the flow is sound under all-three: `isInherited` requires the DATA to exist, so a
brand-new hotel inherits nothing and gets the full first-product flow, then a short one in the
second and third. `pnpm verify` green, 2,335 tests.

### 2026-09-12 · Claude · DONE · No second free trial, and the first DB-backed tests
**Founder: "if the email is somewhere in our system, don't give them anything… we can have gaps if
they trialled CRS and PMS, didn't buy, and sign up again months later."** Right, and there were more
gaps than that.
Files: `packages/core/src/onboarding/signup-identity.{ts,test.ts}`,
`packages/db/src/{public-signup.ts,public-signup.integration.test.ts}` +
`migrations/20260912220000_user_email_key/`, `apps/channel-manager/app/signup/*`,
`packages/core/src/email/auth-emails.ts`, `.github/workflows/ci.yml`.

⚠️ **`maria+trial2@gmail.com` was a different person.** Sub-addressing is the commonest way a trial
is taken twice and needs no skill at all; Gmail dots are the same trick. `User.emailKey` now holds
the mailbox an address actually reaches, and signup matches on THAT. For recognition only — nobody
signs in with it and no mail is sent to it. Not unique, deliberately: two staff at one hotel may
share a mailbox, and a unique index would refuse the second at the moment a manager was adding them.

**Three endings, not two.** The old pair hid a real failure: somebody whose first mail went to spam
was told "check your email" again while nothing was sent — or sent to sign in for a password that had
never existed, locked out of a product they had never entered. Now: *created* · *resent* (fresh link,
SAME account, never a second tenant) · *already-a-customer* → `/signup/existing`, which offers sign
in, reset, and all three product doors, and names nothing about the account.

**I was wrong to refuse the "already registered" message outright.** That rule is right for sign-in
and reset, where being vague costs nothing; on registration OWASP itself calls it the one place the
trade runs both ways. Narrowed rather than accepted whole: only after a full submit, never as you
type, under the hourly ceiling.

⚠️ **FIRST DATABASE-BACKED TESTS IN THE REPO** — 11, against real Postgres, covering the founder's
gap directly. `.github/workflows/ci.yml` now passes `revio_ci` to the Test step; it was building a
full database and then not letting the tests see it. Proved red by re-introducing the alias bug.
**The file refuses to run against any database not named `*_test`/`*_ci`** — it deletes every
tenant, and `pnpm test` with a dev URL would otherwise wipe a working database.

⚠️ **The RLS question is settled.** A non-superuser table owner under FORCE RLS, no bypass:
`UPDATE` → **0 rows, no error**; reads filtered too. Superuser → fine. So past backfills worked
only if Railway's migration role is a superuser, and it fails silently either way. **Founder still
needs to check `Folio.outcome`.** Every new migration sets `app.bypass` explicitly.

`pnpm verify` green, 2,333 tests; drift-lint clean against a local shadow.

### 2026-09-12 · Claude · DONE · A hotel can now sign itself up
**Founder decisions: one trial switches on ALL THREE products; login gets a chooser now and a
central login next.** → **CODEX: `docs/partner/SIGNUP-AND-LOGIN-BRIEF.md` is yours** — the header
buttons, the chooser, the copy that must stay true, and two missing docs articles.
Files: `packages/core/src/onboarding/signup.{ts,test.ts}`, `packages/core/src/email/auth-emails.ts`,
`packages/db/src/{public-signup.ts,auth-flows.ts,index.ts}` + `migrations/20260912210000_public_signup/`,
`apps/channel-manager/{app/signup,components/auth/SignupForm.tsx,lib/actions-signup.ts,middleware.ts}`,
`scripts/authz-lint.mjs`.

**There was no public signup path at all.** `selfStartTrial` is per-product and its routes live
INSIDE the protected apps — it is for an existing customer adding a second product. A new hotel
could only be onboarded by the operator, so the website's "Start free trial" button had nowhere to go.

⚠️ **An unverified signup is inert by reusing a rule, not by adding one.** The tenant is created
immediately with `status = "pending_signup"`, every entitlement off and no trial clock. Every app
already refuses a session whose `tenant.status !== "active"`, so it fails closed without one line of
new gating. Activation hangs off `completePasswordSet` — the single path in the codebase that ever
writes a password hash — so there is no second way in that could rot.

⚠️ **Both outcomes are indistinguishable to whoever fills in the form.** "That email is already
registered" would make this page a directory of which hoteliers use Revio, one guess at a time —
the same refusal the booking engine made for guest recognition (K6). A duplicate gets the same
screen and a real password-reset mail, so a forgotten account still resolves — in the inbox that
owns the address, not on a stranger's screen. A test asserts no refusal message contains "already",
"exists", "registered", "taken", "in use" or "account".

`signupEmail` is a new template, NOT `inviteEmail`: "you have been added" is true for a staff invite
and a lie to somebody who typed their own address in thirty seconds ago. Protection is a
platform-wide ceiling of 12 tenants/hour, counted from the data — an in-memory bucket resets on
deploy and is per-instance, and storing an IP would create personal data this guard does not need.

19 tests. `pnpm verify` green, 2,319 tests, CM builds. Rendered and looked at.

⚠️ **NOT verified end to end** — `createPublicSignup` → email → `activatePendingSignup` is
DB-backed and the sandbox has no test database. First thing to check on production with a throwaway
address: that the trial rows appear, all three entitlements flip, and the tenant leaves
`pending_signup`.

### 2026-09-12 · Claude · DONE · The RevioDirect funnel — the data was always there
**Top item on `docs/STATUS.md`'s competitive-gap list: "no analytics on the booking page at all".**
Files: `packages/core/src/metrics/booking-funnel.{ts,test.ts}`, `packages/db/prisma/schema.prisma` +
`migrations/20260912200000_hold_source_and_session/`, `packages/db/src/inventory-claim.ts`,
`packages/booking/src/public-engine.ts`, `apps/booking/middleware.ts`,
`apps/reservation/{lib/data.ts,components/booking-engine/FunnelPanel.tsx}`,
`apps/reservation/app/(protected)/(property)/booking-engine/page.tsx`.

The engine has taken a hold on form-open since K4, and the hold already records its own ending
(`converted` / `released` / `expired`). A funnel has been sitting in the database all along, read by
nobody. Nothing new is captured.

⚠️ **Counted by hold the number would have been about HALF the truth, and shipping that would have
argued against the product on the product's own screen.** A guest who opens the Deluxe, goes back
and books the Standard leaves the first hold to expire — one person, one booking, recorded as one
conversion AND one abandonment. `Hold.sessionId` (new, from a first-party httpOnly cookie set in the
booking engine's middleware) groups them; `funnelSessions` takes the best outcome per session.
`Hold.source` replaces the inference "createdById IS NULL means a guest", which is true today and
silently wrong the first time anything else makes a hold without a user.

Three more rules, each a wrong number avoided: sessions still in progress are **excluded from the
rate rather than counted as failures** (otherwise it sags whenever somebody is mid-booking); each
room is measured against **its own** visitors (otherwise the room nobody opens always looks worst,
when what it has is a visibility problem); and `null` rather than `0%` when nobody has decided yet.
"Left the form" and "ran out of time" stay apart everywhere — one is a price signal, the other is
the recovery-email opportunity.

⚠️ **The backfill sets `app.bypass` explicitly.** `Hold` is under FORCE ROW LEVEL SECURITY, which
binds the table owner too — only a superuser is exempt. No previous migration has ever set it, so
**past data-backfill migrations may have silently matched zero rows**; worth checking `Folio.outcome`
(2026-08-23) against production.

25 tests. `pnpm verify` green, 2,300 tests, CRS + booking build. Rendered and looked at: the donut
legend was truncating, and the per-room bar encoded visitors while its number said conversion — a
0% room had a half-full bar. Both fixed before shipping.

### 2026-09-12 · Claude · DONE · A date field has to decide which way it looks
**Founder report: "in the editing calendar and some other places we can add previous dates, like
yesterday — it applies in most cases not in all, so check where we add date and fix this."**
Files: `packages/core/src/stays/{past-dates.ts,past-dates.test.ts}`, `scripts/dates-lint.mjs`,
`apps/{channel-manager,reservation,pms}` rate/restriction/inventory/register screens and actions,
`apps/reservation/lib/data.ts`, `apps/pms/lib/format.ts`, `CLAUDE.md`.

⚠️ **The cause was not a missing `min` — there were THREE definitions of "today" and the rate
screens used the wrong one.** `new Date().toISOString().slice(0,10)` is the server's (or browser's)
UTC day. A Bulgarian hotel is UTC+3, so **from midnight to 03:00 every night** — the night auditor's
shift, when Close Day runs — the restriction dialog, the bulk panel and the CM calendar all thought
today was *yesterday*: they defaulted to it and saved it without complaint. `todayInTimeZone` is now
the only source, and the two identical `todayInTz` copies (CRS + PMS) re-export it.

**It is a classification, not a blanket rule** — a report that cannot read last month is as broken
as a calendar that can sell yesterday. Four intents in `past-dates.ts`: `forward-only` (restrictions,
bulk, calendar cells, OOO periods, new stays) · `keep-existing` (a guest who arrived Tuesday keeps a
past arrival — `earliestSelectable(today, current)`, so a date can never be pushed FURTHER back but
you are never locked out of a record because time passed) · `history` (searches, dashboards, reports,
notes about past calls — untouched, and listed with reasons) · `not-future` (a date of birth, which
had no guard in either direction and feeds the police register export).

Both layers, because `min` is only a hint: 17 fields bounded, and **9 server actions now refuse a
past date with a message that says the way out** ("The start date of Fri 11 Sept has already passed.
The earliest you can pick is Sun 13 Sept."). Past calendar cells render as text, not controls — a
cell that takes a click, opens an input, accepts a number and *then* errors has wasted the reader's
time. `pnpm dates:lint` (new, 15th gate) fails any date field carrying neither `min`, `max`, nor an
entry in `OPEN_ENDED` with a reason; proved red by removing one `min`.

`pnpm verify` green, 2,275 tests (+17), all five apps build.

### 2026-09-12 · Claude · DONE · Hide fields, and say what is filtering
**P2 item from `IDEAS-1CLUB-2026-09.md`: column visibility + filter badges.**
Files: `packages/ui/src/{column-visibility.tsx,menu.tsx,package.json}`,
`apps/reservation/lib/{filter-chips.ts,filter-chips.test.ts}`,
`apps/reservation/components/{column-visibility.test.tsx,reservations/ReservationsTable.tsx,guests/GuestsTable.tsx}`,
`apps/reservation/app/(protected)/{reservations,guests}/page.tsx`.

**Chips.** Every active filter is now a removable badge under the form. The form shows its values but
only if you read five controls and work out which are doing anything; one `Clear` answers "why am I
not seeing this booking" with "start again", which is why people stop refining filters. A chip drops
ONLY its own filter — `from`/`to`/`dateType` are deliberately ONE chip, because removing half a range
leaves an open-ended filter returning a third result set nobody asked for. No chips while a segment
tab is lit: that tab already states the same fact in better words.

**Columns.** `Columns · 2 hidden` on both tables, per browser, per table. ⚠️ **What is stored is the
HIDDEN set, never the visible set** — store "visible" and the next column we ship is invisible to
everyone who has ever opened the menu, with no error anywhere to say so. Guest is locked (it carries
the link out of the row) and is *listed as locked*, not omitted. Hiding the sorted column clears the
sort. The preference lands after hydration, never during render.

The refactor underneath is the point: `ReservationsTable`'s header and body were two hand-written
lists in matching order. That is fine until a column can be hidden — drop the fourth `<th>` and not
the fourth `<td>` and every value after it reads under the wrong heading. Both now derive from one
array; a test counts `<th>` against `<td>` and I proved it red by re-introducing exactly that drift.

`pnpm verify` green, 2,258 tests (+26), CRS build clean.

### 2026-09-12 · Codex · DONE · Correct docs subdomain binding
The founder confirmed the publication address is `docs.reviosoft.app`, under the live `reviosoft.app` domain. The correct custom-domain binding is verified on the isolated Railway docs service, DNS/TLS are healthy, and the official site now links to it. No hotel app, database, secrets or customer data were changed.

### 2026-09-12 · Codex · DONE · Documentation preview published to Railway
The expanded static documentation preview is running in the separate Railway `docs` service.
Deployment `56ee5a24-0141-485f-82c2-9db62a458af0` is healthy at `https://docs-production-b1ad.up.railway.app`; all 47 article routes were probed and the live Platform and Billing pages were checked in-browser. The earlier wrong-domain binding was based on a non-existent base domain and is not the publication target; the founder confirmed `docs.reviosoft.app`. No hotel app, database, secrets or customer data were changed.

### 2026-09-12 · Codex · DONE · Website release + documentation organisation
**Founder approves marketing release; documentation follows as an isolated workstream.**
Files: sibling `revio-websites` repository (owned marketing changes, CI-gated release); here only `design/docs-preview/`, `docs/DOCUMENTATION-PLAN.md`, this log.
Notes for Claude: no customer app, shared package, database, mapping or real-hotel test changes. Stock hotel imagery removed; future customer photos only with approval. Public support page links actual support email and service levels; docs link waits for verified publication. Docs preview will get product-specific navigation and source-labelled guide drafts, not copied internal runbooks. The two untracked design prototypes remain intentionally uncommitted: do not stage them. Bug fixes from your hotel tests take priority over feature roadmap work; docs articles need review against the resulting code.

Result: marketing e597ab1 shipped on reviosoft.app after CI + promotion success (34703197397 / 34703225613); origin/production SHA and public content verified. Website /support is live. Docs preview now has 7 top-level collections, product-scoped sidebar, global search and 15 draft articles (6 new). Two task drafts checked against source at platform 83a3477; none claimed fully UI-verified/published. Browser checks: all 15 articles, collection navigation, cross-product search, TOC, widths 390/768/1440, mobile open/Escape; no JS errors. Full publication and remaining guide coverage follow docs/DOCUMENTATION-PLAN.md. All platform-side docs/prototype edits intentionally UNCOMMITTED to avoid triggering customer-app deployments during your hotel work.

### 2026-09-12 · Codex · DONE · Documentation expansion and readability
**Founder asks for a larger, more complete OneClub-style docs experience with clearer left and right columns.**
Files: `design/docs-preview/{content.js,app.js,refinements.css}`, this log.
Notes: Preview-only work; no customer app, shared package, database, Cloud-owned file or deployment. Keep claims source-labelled and do not turn draft content into a public API promise. Existing untracked preview files stay uncommitted for founder review.
Result: OneClub-style product collections now cover Start here, Platform, RevioLink, RevioCRS, RevioPMS, RevioDirect, Integrations, API reference and Updates. The preview contains 47 navigable articles, grouped sidebars, status badges, global search, right-hand article TOC and a clear next-article path. Platform drafts cover dashboards, companies/properties, lists/search, accounts/permissions, billing, payments, analytics, activity/events and settings/security. Typography was increased for desktop and mobile without changing the mobile interaction model. Browser QA passed all 47 routes, zero undefined links, global billing search, desktop columns, 390px mobile width, mobile menu scroll and zero console errors. Preview remains local and uncommitted pending founder/partner content review.

Format:
```
### YYYY-MM-DD · <agent> · <status> · <area>
**<one line: what>**
Files: <the ones you are actually in>
Notes: <anything the other agent needs — a decision, a gotcha, a dependency>
```
Status: `CLAIMED` · `DONE` · `BLOCKED` · `ABANDONED` (say why).

---

### 2026-09-12 · Claude · DONE · The shape of the day, above the reservation list
**P2 item from `IDEAS-1CLUB-2026-09.md`: segment tabs with live counts.**
Files: `apps/reservation/lib/{segments.ts,segments.test.ts,data.ts}`,
`apps/reservation/app/(protected)/reservations/page.tsx`,
`apps/reservation/components/reservations/segment-tabs.test.tsx`.

`All 76 · Arriving today 4 · In house 12 · Departing today 3 · Cancelled 0`, above the filters. The
list had five filters and every one asks the reader to know what they are looking for first; a
receptionist opening this screen is asking what is happening today.

⚠️ **A segment is a SHORTCUT to the filters the page already has, never a second filtering system.**
Each tab sets `dateType`/`from`/`to` and the same query answers it. A parallel path would be a second
definition of "arriving today", and on this week's evidence the two would disagree inside a
fortnight — the screen highlighting one thing and listing another.

The active tab is **derived from the params**, never stored, for the same reason. Anything the
segments do not describe lights nothing rather than guessing: a wrong highlight is worse than none.
A tab left open overnight stops being lit when the date rolls over, because its params are pinned to
a date — tested.

In-house is a stay OVERLAP with a strict `>` on departure, not a check-in date. A guest who arrived
on Tuesday is in house on Thursday, and `check_in` would miss them while looking plausible every
Monday. Counts use the same semantics as the list, because a tab saying 4 that lists 3 is worse than
no tab — and they ignore the search box, so a count stays a fact about the hotel rather than about
the form.


### 2026-09-12 · Claude · DONE · The mapping rule comes out of the data layer and gets tested
**The least-verified code in the path the tester is about to exercise.**
Files: `packages/connectivity/src/mapping-rows.ts` (NEW, 12 tests), `apps/channel-manager/lib/data.ts`.

Yesterday's fix made Mapping list every active product rather than only the rows provisioning had
created — the right behaviour, written inline in a 900-line data function and covered by nothing. It
is the screen the hotel will be working through, so it is the last place to leave a rule nobody can
check.

`mappingRows` is that rule, pure and pinned against the reporting hotel's exact configuration:
three room types and three rate plans, connected to Channex before two rooms and both live plans
existed.

Two decisions in it that are easy to get backwards:
- ⚠️ **An inactive product that IS mapped stays on the list.** It is live on the channel right now,
  and a hotel that cannot see it cannot undo it. Hiding it is worse than a row they no longer need.
- **An inactive product that was never mapped is not offered** — nothing to undo, nothing to sell,
  and offering it is the dead-end choice BUG-008 was about.

`unmappedCount` also moved: it was counting mapping ROWS, so a product with no row made the number
zero and the pill green. Absence and incompleteness are different questions and both belong in it.


### 2026-09-12 · Claude · DONE · RevioCRS gets tests, and they found two bugs on the way in
**The app with the most screens and, until today, no test had ever run against it.**
Files: `apps/reservation/lib/{metrics.ts,metrics-range.test.ts,format.test.ts}`,
`apps/reservation/{vitest.config.ts,test/server-only-stub.ts}`.

⚠️ **`server-only` made most of this app untestable.** The marker throws at import outside an RSC
build — its whole job — so vitest could not load any server module, which is nearly all of `lib/`.
A one-line alias to a stub in `vitest.config.ts` unblocks it; the real package still guards the
production build, so nothing is weakened. Worth knowing before concluding a CRS module "can't be
tested".

33 tests, on the pure logic everything else inherits:
- **`resolveRange` / `stlyRange` / `comparisonRange`** — the date arithmetic behind every reported
  number. ⚠️ STLY is **364 days, not 365**: 52 whole weeks, so a Saturday compares to a Saturday. At
  365 every year-on-year figure compares the wrong kind of day and still looks authoritative.
- **`buildActionAlerts`** — severity ordering, and that a board full of low-availability dates can
  never push a failed sync off the 10-item list.
- **`format`** — money is integer minor units, and every date helper reads **UTC**, because a local
  getter would shift an inventory date by a day for readers west of UTC. Silently, and only for some.

Two bugs found by writing them:
1. **`resolveRange("mtd")` returned `preset: "ytd"`** — right dates, wrong identity. `preset` is what
   the screens put in the URL and use to highlight the active button, so a Month-to-date view linked
   to `range=ytd` and following that link silently widened it to the year. Unreachable today (no
   screen offers MTD), which is why it was worth fixing before one does.
2. **"1 unresolved error need attention"** — the noun was pluralised and the verb was not, on the
   Action Center panel a manager scans first.

Remaining CRS logic is DB-bound (`actions-reservations`, `data.ts`, the metric aggregations) and
wants the live-DB pattern PMS uses in `close-day-db.test.ts` — skips loudly without a database.


### 2026-09-12 · Claude · DONE · A real OTA booking bounced, and every screen said it was fine
**Founder: a Booking.com reservation sat in Channex and reached no product.**
Files: `packages/connectivity/src/sync.ts` (+ `pull-summary.test.ts`),
`packages/core/src/connectivity/cadence.ts` (NEW, 9 tests),
`apps/channel-manager/lib/{actions-config,connectivity,sync-copy.test}.ts`,
`apps/channel-manager/app/(protected)/{sync,channels}/page.tsx`,
`apps/channel-manager/app/api/jobs/pull/route.ts`.

The poller was fine — `channex-pull` had run 209s earlier and every job reports healthy. The booking
arrived, its room/rate were not mapped, and **the rejection branch ended in `imported++`**. So the
log read `Pulled 1 revisions (1 new · 0 updated · 0 unchanged) · success` for a booking that landed
as a `failed_import` placeholder with no room and no dates — invisible to every screen.

BUG-014 on the pull side, same week, same shape: **a count that cannot express failure reports
success.** `failedImport` is counted, named in the summary, on `PullOutcome`, and makes the event a
`warning`. Shared `pullSummary` so the rule is not duplicated into its own test.

⚠️ **And there was no way back.** The revisions feed serves only UNACKED revisions and we ack
everything processed, including rejects — so a booking that arrived before the mapping was finished
is acked, gone from the feed, and unreachable (Pull cannot see it; Re-sync only pushes).
`pullChannel(…, { forceFullFetch: true })` reads the bookings endpoint instead;
`reimportChannelBookings` exposes it, and the button shows on a channel only while it has errors.

⚠️ **`SyncEvent.detail` was never rendered.** Every explanation ever written into it — "no mapped
target", "N bookings could not be imported" — was stored and shown to nobody. That is why a rejected
booking read as silence. Now under the summary.

⚠️ **Nothing said WHEN any of this happens.** `syncCadence` in core: bookings are polled every 5
minutes (mirrors `FIVE_MINUTES` in `instrumentation.ts` — change one and the other lies), pushes are
immediate inside the saving request. `overdue` needs TWO missed cycles, because flagging one late
tick is how a status light gets ignored.


### 2026-09-12 · Claude · DONE · Looking for more of the same class — found one, in restrictions
**Founder: "let's see if there's anything else like this that could hinder us."**
Files: `apps/channel-manager/lib/data.ts`.

The class is **a write and a read that disagree about which record they mean**. Searching for it
across the schema found a second live instance, in restrictions rather than prices:

- **Write:** Bulk Update calls `restrictionPlansFor`. Pick ALL your plans (or none) and it writes a
  ROOM-level cell (`ratePlanId: null`); pick SOME and it writes one cell PER CHOSEN PLAN. Correct —
  a per-plan restriction is a real thing that gets pushed to channels.
- **Read:** the calendar's Min LOS / CTA / CTD / Stop Sell rows are per ROOM and filter
  `ratePlanId: null` — also correct, and itself a deliberate fix (`room-level-cells.test.ts`:
  without it two cells share a key and whichever the database returned last silently wins).

Both halves right, and together they lose the edit: apply reports success, the data is stored, and
the grid shows the room-level value as though nothing happened. Same shape as BUG-003/007.

Rendering a restriction row per plan is the full answer and a bigger change to that grid. What could
not wait is the silence: a cell whose restriction differs per plan now carries a note saying so, so
the screen stops implying the room-level value is the whole story.

⚠️ Worth knowing for anything new: `DailyCell.ratePlanId` is nullable and means two different things
— null is "the room", non-null is "that plan". Any new read of it has to decide which it wants, and
say so.


### 2026-09-12 · Claude · DONE · Fourteen reported bugs, one cause — read paths assumed a single rate plan
**Ventsislav's bug log from Cabacum Beach Residence. His §2.2 hypothesis was exactly right.**
Files: `packages/core/src/rates/calendar-rows.ts` (NEW, 11 tests),
`packages/connectivity/src/sync.ts` (+ `push-outcome.test.ts`, 6 tests),
`apps/channel-manager/lib/{data,actions-calendar,actions-config,mutation-helpers,connectivity}.ts`,
`apps/channel-manager/components/{calendar/EditableCell,calendar/MonthView,mapping/MappingEditDialog}.tsx`,
`apps/channel-manager/app/(protected)/{calendar,mapping,sync}/page.tsx`,
`apps/reservation/lib/{data,actions-rates,mutation-helpers}.ts`,
`apps/reservation/app/(protected)/(property)/inventory/page.tsx`,
`apps/reservation/components/inventory/RateCell.tsx`.

⚠️ **THE REGRESSION WAS MINE.** Before `9b528ff` (09-09) the bulk picker offered the inactive plan,
so hotels wrote to the same wrong plan the calendar read — visibly wrong, but consistent. I made the
WRITE path use only active plans and never opened the READ path. From that commit the data was
correct and the screen stopped showing any of it. **A half-migration is worse than either end.**

The two read surfaces resolved "the" plan differently and neither filtered on `active`:
- RevioCRS: `findFirst({ priceLogic: "manual", active: true })` → *BB Flex*
- RevioLink: `findFirst({ code: "BAR" })`, **no active filter** → *Standard Rate*, switched off

`ratePlanRows` in `@revio/core` is the one rule now: **one row per ACTIVE plan, labelled with its own
name, ordered by sortOrder**, with options/selection/rows reconciled from one set. That last part is
BUG-006: RevioLink defaulted the filter to hardcoded demo codes `["BAR","NR","BRF"]`, so the pill said
3, the list offered 2 and neither was ticked — three numbers, one control, none wrong on its own.

⚠️ **Writes moved with the reads.** `saveCell` / `saveCalendarRate` took the plan from a lookup; they
take it from the EDITED ROW now and verify it. Fixing reads alone would give a calendar that shows
two plans and silently writes both into one.

⚠️ **BUG-014 was the one to fix first and the reporter said so.** `recordPush` wrote
`status: "success"` with NO channel **before** `syncRealChannels` ran and regardless of the result —
that function returned `void` and swallowed everything. It masked the other thirteen. It returns a
`RealPushOutcome` now and shared `pushVerdict` (6 tests) decides: success only when a channel
ACCEPTED something; else `warning` (nothing mapped) / `failed` / `skipped` (paused) / `noop`.

Mapping (BUG-010/011): the screen listed mapping ROWS, created once by one-shot provisioning — so
every product added later was invisible, not broken. It lists **every active product** now, and
mapping a never-sent one creates its row.

⚠️ **NOT fixed, deliberately:** BUG-012 (coupled mapping rows) — the dialog holds per-row state and
the write is keyed by row id, so the coupling is not in this code and a fix would be a guess;
BUG-013 (duplicate / Booking.com-scoped Channex codes) — needs the Channex property inspected. Run
the reporter's §2.3 test #4 first.

⚠️ **Codex: I am sorry — `git add -A` in `16ed1e3` swept in your uncommitted `design/home-preview/`
and `design/docs-preview/`.** Untracked again in the next commit; the files are untouched on disk.
My fault, and the reason AGENTS.md §5 says to commit by path.


### 2026-09-12 · Codex · DONE · Marketing homepage motion prototype
**Founder requests a viewable homepage upgrade for the official marketing site, not documentation.**
Files: `design/home-preview/`, `docs/WORK-LOG.md`.
Notes: Local standalone design with copied existing marketing screenshots/brand assets. No writes to sibling revio-websites, no app changes, no deployment. Compare discrete product frame and browser frame, large product switcher and narrative animation. Fetched main equals HEAD e50ab8f; rebase deferred for deliberately uncommitted artifacts. New paths also remain uncommitted for review.
Verified: Local port 3011. Browser smoke passed product switching, keyboard tabs, frame toggle, desktop/mobile mega menu, three-step finite workflow and reduced motion; no JS errors or mobile overflow. Desktop/product/workflow/mobile screenshots inspected; corrected logo aspect ratio and reran checks. Preview only; full monorepo build not run, no commit or deployment.

### 2026-09-12 · Codex · DONE · Documentation polish and public-site design review
**Founder approved docs design; requests dark default, real logo, proper icons and comparison of 1Club/Cloudbeds with Revio marketing.**
Files: `design/docs-preview/`, `docs/WORK-LOG.md`.
Notes: Local preview only. Public-site review is read-only; no marketing deployment or customer product UI changes. Prior artifacts remain uncommitted and preserved. Fetch/check before work; rebase deferred for intentionally dirty shared docs paths.
Verified: Dark default with remembered light/dark choice, supplied Revio artwork in both themes, consistent SVG navigation/product icons, larger type. Nine-article browser smoke suite passed without JS errors; desktop/mobile screenshots visually inspected. 1Club and Revio inspected through public browser rendering and DOM; Cloudbeds headless returned 403, but normal Chrome loaded its page and navigation/content successfully. Marketing recommendations are proposals, not implemented changes. All preview paths remain intentionally uncommitted.

### 2026-09-12 · Codex · DONE · Short brief and documentation design preview
**Founder requests a short Word discussion list and an interactive documentation design now.**
Files: `docs/partner/Revio-Ideas-Short-2026-09-12.docx`, `design/docs-preview/`, `docs/WORK-LOG.md`.
Notes: Preserve the detailed brief. Isolated static prototype, no customer app/shared package/lockfile changes, no production deployment. Current HEAD equals fetched origin/main at e50ab8f; pull-rebase deferred because the prior brief/log are intentionally uncommitted. These new paths also remain uncommitted for design review. This supersedes the earlier suggestion to wait for partner review before showing a docs design.
Verified: Short DOCX rendered and visually inspected as one page. Nine preview articles; browser checks passed for routing/Back, search and empty result, mobile navigation/overflow, reduced motion, and zero JavaScript errors. Desktop/mobile/light/dark screenshots inspected. Local preview at port 3010. Full monorepo gate not run: no runtime apps changed and no commit/push requested. The detailed 17-page document remains intact.

### 2026-09-11 · Codex · DONE · Partner strategy brief
**Created the Bulgarian partner-review brief covering product ideas, integrations, migration, enterprise controls and the proposed documentation portal.**
Files: `docs/partner/Revio-Platform-Expansion-Discussion-2026-09-11.docx`, `docs/WORK-LOG.md`
Notes: Discussion snapshot only; proposals are explicitly separated from current capabilities. No runtime, design, Railway, DNS or production change was made. DOCX and this log entry are intentionally uncommitted pending partner review. The recommended next safe implementation is a separate `apps/docs` service after that review.

### 2026-09-11 · Claude · DONE · The sidebar scrolled and nothing said so
**Founder: "they may not think of scrolling" — a screen nobody scrolls to is a feature nobody finds.**
Files: `packages/ui/src/nav-tail.tsx`, the three `components/shell/Sidebar.tsx`,
`apps/{pms,channel-manager,reservation}/components/shell/sidebar-fit.test.tsx` (NEW),
`apps/reservation/{vitest.config.ts,package.json}` (NEW test runner).

⚠️ **The finding, measured rather than guessed: `nav.offsetWidth - nav.clientWidth` was 0.** macOS
draws an overlay scrollbar that does not exist until you already scroll, so a menu 156px past the
bottom of a 1280x720 laptop gave NO indication it continued. Three fixes, all shared:

1. **`NAV_SCROLL_CLASS`** — ⚠️ `scrollbar-width` and `scrollbar-color` are deliberately NOT set.
   Chrome 121+ ignores every `::-webkit-scrollbar` rule when either standard property is present, so
   setting both for "cross-browser coverage" silently cancelled the fix — measured at 0px twice
   before I spotted it. The pseudo-elements alone opt the element out of overlay scrollbars.
2. **The tail moved OUTSIDE the scroll region in all three.** It was the last group inside it, so
   Settings and Help were the two things below the fold on an invisible-scrollbar menu. CRS/PMS
   needed `renderSection` extracted to do this without duplicating any nav-row JSX.
3. **`NAV_ROW_CLASS` / `NAV_HEADING_CLASS`** — `py-1.5` and `pt-3`, shared so the three cannot drift.

Measured after (overflow at viewport height, tail visible at every size in all three):
`RevioLink` fits to 600px · `RevioCRS` fits at 720px, 114px over at 600px ·
`RevioPMS` 62px over at 720px (was 156px). PMS keeps a small scroll — it has the most items, and
regrouping the founder's spec'd §2 sections to win 32px is the wrong trade.

⚠️ **RevioCRS had NO test runner** — no `test` script, no vitest config — so `pnpm -r test`, `verify`
and CI had never run one test for that app and said nothing about it. A filtered pnpm run with no
such script exits 0 silently. Fixed; it now runs with the others.


### 2026-09-11 · Claude · DONE · Client analytics — three measures, not one score
**Founder: "искам да разбирам кой колко време какво ползва, време ли е за ъпсел."**
Files: `apps/operator/lib/{engagement.ts,usage.ts}` (+ 14 engagement tests),
`apps/operator/components/ui/{Donut,DailyBars}.tsx` (+ 11 tests),
`apps/operator/app/(protected)/analytics/page.tsx`.

⚠️ **Deliberately NOT an engagement score out of 100.** A single figure mixing "they come in every
day" with "eleven people use it" cannot be argued with, cannot be acted on, and moves for reasons
nobody can name — the same rule `clientOpportunities` already states as *null rather than a
flattering guess*. Three measures instead, each leading to a different phone call:

- **Regularity** — days in, out of 30. Habit or visit.
- **Reach** — people active out of staff accounts. ⚠️ The one nobody measures and the best churn
  predictor here: a product ONE person uses leaves when they do. The note changes meaning at exactly
  one person, not at a percentage.
- **Depth** — screens opened out of screens their products offer. Running the hotel on it, or
  looking at it.

`slipping` is checked BEFORE `thriving`/`steady` on purpose: a hotel halfway down from a strong month
still has a healthy 30-day total, and a totals-based screen always misses it. `trendPct` is `null`
rather than 0 when the previous week had nothing — a first week of use is not +100% growth.

Upsell returns REASONS, never a boolean, and returns none for anybody not already using what they
bought. `screensAvailable` is counted from what all hotels between them have opened (there is no list
of screens in the database); with one customer the denominator equals their own usage — noted in the
code, resolves itself with a second hotel.

Charts are hand-drawn SVG, no library: a donut as `stroke-dasharray` on one circle (no arc paths to
get wrong), and columns rather than a line for the daily series — a line interpolates a weekend that
never happened and draws a hotel that stopped as a gentle slope. Weekends are grey, because a quiet
Saturday is a working hotel and a quiet Tuesday is a phone call.

Notes: `pnpm verify` green, 2,132 tests, perimeter + drift run and clean. Demo tenants are INCLUDED
here (usage is operations, not money — `lib/demo.ts`).


### 2026-09-11 · Claude · DONE · One bottom to the menu in all three products
**Founder: "ending with help and settings everywhere to be in the bottom."**
Files: `packages/ui/src/nav-tail.tsx` (NEW), each app's `components/shell/Sidebar.tsx`,
`apps/pms/lib/roles.ts` (+ tests), `apps/pms/components/shell/nav-tail.test.tsx` (NEW).

⚠️ **The RevioPMS sidebar had NO link to `/settings`** — that whole area (Property · Operations ·
Connections · Your account · Billing) was reachable only from the account dropdown, while
"Configuration", a different area, sat in the main nav. That is why the founder could not find the
new billing page in RevioPMS even after the RLS fix.

The three had drifted further than they looked: CM had Settings·Help in an "Account" group with two
loose settings items; CRS had Settings·Help·**Activity** — the one product where the last item was
not Settings — mixed in with Distribution and Booking Engine, which are work; PMS had Help·Activity
inside "Setup" and Close Day below everything.

`@revio/ui/nav-tail` is now the one definition: **Activity · Help · Settings**, bottom-anchored
(`mt-auto` in a flex column) above a rule, filtered to the routes each product has so the order
never changes. ⚠️ **Settings is last in every product. Do not reorder it.** No route changed.

Also removed from the CM sidebar: `User Management` and `/settings/emails`, both of which Settings
already lists under `SETTINGS_ELSEWHERE` — the menu was answering one question in two places.

⚠️ **`SCOPED_NAV` now gives every scoped PMS role `/help`.** `actions-support.ts` is exempted from
`authz-lint` on the stated ground that anybody signed in may ask for help — *"a housekeeper who
cannot open Settings is exactly the person most likely to be standing in front of a broken screen"*
— and the nav contradicted it: a housekeeper saw one item and could not reach Help at all.

Notes: `pnpm verify` green, 2,121 tests, perimeter + drift both run and clean.


### 2026-09-11 · Claude · DONE · Everything I shipped today read through the WRONG Prisma client
**RLS returned zero rows, silently. The trial banner never appeared and billing was blank.**
Files: `packages/db/src/{hotel-billing,self-trial}.ts`, `scripts/perimeter-lint.mjs` (NEW),
`package.json`, `.github/workflows/ci.yml`, the three `settings/billing/page.tsx`.

⚠️ **READ THIS BEFORE ADDING A QUERY TO `@revio/db`.** Both modules I added today imported `prisma`
from `./client.js` — the RAW client, which sets no GUC. Services connect as the restricted
`revio_app` role with no `BYPASSRLS`, so queries on `ProductTrial`, `ClientBilling`, `Invoice`,
`OperatorCompany` and `Tenant` **returned zero rows instead of erroring**. `hotelBillingAccount`
returned null, the page did `return null`, and the founder saw a blank screen in all three products.

Nothing caught it: typecheck, build and 2,113 tests were all green, because not one test touches a
database. The pages "rendered successfully" — as nothing.

**`pnpm perimeter:lint` (13th → now 14th check, also in CI)** makes it mechanically impossible:
inside `packages/db/src`, `apps/**` and two more packages, a model with an RLS policy may not be
reached through the raw client. Two things it got wrong at first and both are worth knowing:
- the guarded-table list is parsed from the migrations, and **most policies here are applied in a
  `FOREACH t IN ARRAY ARRAY['Folio','FolioLine'] LOOP`** — missing that shape left `Invoice`,
  `Guest`, `Unit` and most of the schema out of the set, so it reported "clean" over exactly the
  tables it exists to protect;
- it must **strip comments**, or `inventory-claim.ts`'s prose describing the wrong shape trips it.
Proved by reintroducing the bug: 5 findings, exit 1. Restored: clean, 639 files, 75 tables.

Also: the billing pages no longer `return null` on a data miss — a screen that cannot answer must
say so rather than render nothing.

⚠️ **Separately, the RevioPMS sidebar has NO link to `/settings` at all** — only the account
dropdown does, while "Configuration" (a different area) sits in the main nav. Found while answering
the founder's menu question; fix in the next entry.


### 2026-09-11 · Claude · DONE · A hotel fills in its own invoicing details — the human step in the middle of the automation
**Founder: "дали не трябва... да имат билинг част и да виждат какво става като цяло" / company details.**
Files: `packages/core/src/billing/billing-identity.ts` (+ 14 tests),
`packages/db/src/hotel-billing.ts`, `packages/db/prisma/migrations/20260911210000_client_billing_self_served/`,
`packages/ui/src/billing-identity-form.tsx`, each app's `lib/actions-billing-identity.ts` and
`settings/billing/page.tsx`, `apps/operator/app/(protected)/clients/[id]/page.tsx`,
`apps/pms/components/shell/billing-identity.test.tsx`.

⚠️ **`ClientBilling` is now written by the HOTEL as well as by us.** `issueInvoice` always refused
without it and `decideVat` blocks rather than guess a country — so it was already mandatory, just
mandatory on *us*: every legal name and VAT number was typed into the operator console from
something said on a phone. That is second-hand data AND a human step inside a flow meant to be
automatic (a self-serve trial that converts cannot be invoiced until somebody notices).

Two things to know before touching this row:
- **`notes` is ours and is never in the hotel's payload.** `saveHotelBillingIdentity` lists the
  customer-facing fields explicitly for that reason. Do not "tidy" it into a spread.
- **`selfServedAt` vs `updatedAt`** answers "is this legal name the customer's own answer or our
  transcription". The operator client page compares the two and says which.

⚠️ **`Property.invoiceIssuerName/invoiceVatId/invoiceAddress` is a DIFFERENT THING** — the hotel's
identity for invoices *the hotel* issues to *its guests*. Opposite direction. They look identical on
screen, so the form says which one it is in its second sentence. Merging them would put the wrong
company on somebody's tax document.

VAT numbers are **format**-checked per country, never existence-checked — VIES is the only thing that
could say otherwise, and claiming more on screen would stop people checking. Unknown countries pass.

Notes: `pnpm verify` green, 2,113 tests, `drift:lint` run and clean. `authz-lint` refused a
`guardSubscription()` wrapper I had written — correctly, since the whole point is that the gate is
visible at the top of the action; the wrapper is gone and each app calls its own gate directly.


### 2026-09-11 · Claude · DONE · A billing section in all three hotel products — and a trial that was being invoiced
**Founder: "дали не трябва и трите софтуера в админ акаунтите да имат билинг част."**
Files: `packages/core/src/billing/plan-pricing.ts` (+ test, MOVED from `apps/operator/lib/pricing.ts`),
`packages/db/src/hotel-billing.ts`, `packages/ui/src/billing-panel.tsx`,
`apps/operator/lib/{pricing,actions-billing,data}.ts`,
`apps/{channel-manager,pms}/app/(protected)/settings/billing/`,
`apps/reservation/app/(protected)/(property)/settings/billing/`, each app's `settings/sections.ts`,
`apps/pms/components/shell/billing-panel.test.tsx`.

⚠️ **`apps/operator/lib/pricing.ts` is now a SHIM over `@revio/core`.** Same exports, same names —
`Entitlements` and `ProductKey` are aliased there because core's `ProductKey` is the `"cm"|"crs"|"pms"`
spelling and the billing one is `BilledProductKey`. Nothing in the operator changed its imports. If
you are editing prices, edit `packages/core/src/billing/plan-pricing.ts`.

⚠️ **A REAL DEFECT, found while building the screen: `generateInvoices` was charging for products on
a free trial.** A trial is an entitlement flag, so `hasPms` is true during a RevioPMS trial, and the
loop priced straight from the flags. Worse than one line — the bundle discount is priced by the
NUMBER of modules, so a trial re-priced the products they really do pay for. MRR had it the other
way round and reported revenue that does not exist. `billableEntitlements` (core, 6 tests) now sits
between the flags and every money figure. No real client had been invoiced yet.

The screen itself is one component in `@revio/ui` used by all three products: the monthly total with
the arithmetic that produced it, what is outstanding with our IBAN, and the invoice history with a
card button where a live Stripe link exists. It computes nothing of its own — `priceBreakdown` is
the function that generates the invoice. Gated on `manageSubscription`.

Notes: `pnpm verify` green, 2,078 tests, `drift:lint` run against a scratch shadow DB. Rendering the
panel and looking at it caught the IBAN running its characters together under `tracking-tight` — now
grouped in fours the way a bank prints one.


### 2026-09-11 · Claude · DONE · The trial button that "did nothing", and the strip that tells a hotel it is on one
**A user-facing action awaited an email send with no timeout and no pending state.**
Files: `packages/email/src/transport.ts`, `packages/ui/src/{submit-button,trial-banner}.tsx`,
`packages/core/src/trials/banner.ts` (+ test), `packages/core/src/auth/capabilities.ts` (+ test),
`packages/core/src/trials/self-serve.ts`, `packages/db/src/self-trial.ts`,
`packages/db/prisma/migrations/20260911190000_trial_keep_request/`,
`apps/operator/lib/{actions-trials,attention,data}.ts`, `apps/operator/app/(protected)/clients/[id]/page.tsx`,
`apps/{channel-manager,reservation,pms}/app/(protected)/layout.tsx` + `lib/actions-self-trial.ts`
+ `components/shell/UserMenu.tsx`, `apps/pms/lib/roles.ts` (+ test).

Founder: *"като натисна траяла в оператора и нищо не се случва, трябва да презаредя."* The trial was
being granted every time. `startTrial` awaited `sendEmail` **after** the writes had committed, and
`@revio/email` had no timeout at all — `fetch` has no default one — so a slow provider held the
action open with nothing on screen moving. There is also no pending state on a `<form action={…}>`
in a server component, so a working slow action and a dead one are pixel-identical.

Three things, each of which is a defect on its own:
- `EMAIL_TIMEOUT_MS = 10s` + a `timedOut` flag on `EmailResult` (distinct from a refusal: one is
  settled, the other means we do not know).
- `@revio/ui/submit-button` — `useFormStatus`, and it singles out the **pressed** button via
  `data.get(name)` so three product buttons do not all claim to be starting.
- `revalidatePath(path, "layout")` in the trial actions. **Verified in a browser, not assumed**:
  page-type revalidation updated the page content and showed NO flash toast, because `FlashToast`
  lives in `(protected)/layout.tsx`; layout-type showed it. ⚠️ Worth auditing elsewhere — any action
  whose only revalidation is the current page path never shows its own message.

Also: the banner the founder asked for (*"не трябва ли да им излиза отгоре че са в фри траил"*), one
strip at the top of all three hotel apps, tone escalating on exactly the days the reminder emails go
out. Its "Keep it" button records `ProductTrial.keepRequestedAt` and raises an `act` flag in the
operator's attention feed — it deliberately does **not** convert anything.

⚠️ **New capability `manageSubscription`** (core) / `subscription` (PMS roles). `authz-lint` caught
that I had built a second permission system in the trials module (`isTrialDecider` with its own role
list); it now reads from the same grants table. PMS `manager` holds every operational capability and
NOT this one — an existing test asserted "managers get everything" and correctly went red.

Notes: the self-serve trial pages from earlier today were unreachable — `trialHref` was optional and
no app passed it. Now wired in all three `UserMenu`s. `pnpm verify` green (2,061 tests); `drift:lint`
RUN, not skipped, against a scratch shadow DB — clean.


### 2026-09-11 · Claude · DONE · The trial sweep says what it actually did
**It counted a warning as sent when there was nobody to send it to.**
Files: `apps/operator/lib/trial-sweep.ts`, `lib/trial-sweep-db.test.ts` (4 new cases + a mock fix),
`app/(protected)/clients/[id]/page.tsx`.

Codex had already fixed the two mechanical bugs (a stale 7-day reminder arriving after the 1-day one;
expiry committing in two transactions). What remained was the reporting:

```ts
if (owner?.email) { …send… }   // silently skipped when there is none
result.reminded++;              // counted anyway
result.details.push("… warning sent");
```

So a hotel with no active owner on the account was on course to lose a product **on the day, with no
warning at all**, and the only place that could have said so was reporting that it had told them.

`reminded` now means *reached a provider*. `unreachable` and `failed` are their own numbers.

⚠️ **The two failures are treated differently on purpose.** A provider refusal still consumes the
threshold — retrying every five minutes for the rest of the trial turns one failed send into a burst
of identical warnings, and one missed warning is recoverable where twenty is not. **No recipient at
all does NOT**, because there is no send to retry and nothing to flood: a missing owner email is a
five-minute repair, and consuming the threshold would turn it into a permanent loss of the warning.
A test proves the warning goes out on the next sweep once somebody is added.

The client page shows **nobody to warn** on a running trial, which is the half a person can fix.

⚠️ Codex's mock resolved `undefined` where `sendEmail` returns an `EmailResult`. Invisible while the
sweep ignored the return value; a crash the moment it read it. Fixed — a mock that does not honour
its function's contract is a test asserting against something that does not exist.

**8/8 against real PostgreSQL** with RLS under a non-superuser role. Restoring the old counting turns
two of the new cases red.

### 2026-09-11 · Claude · DONE · A paid invoice looks paid, and the emails lead with the money
**Founder asked whether the flow was the simplest. It was, with one real gap.**
Files: `apps/operator/lib/{invoice-data,invoice-html,invoice-emails}.ts`.

The described flow — email with a button → pay in Stripe → email with the invoice → everything
updated — is right, and the invoice belongs in BOTH letters: it is the bill when we ask, and the
receipt when it is settled. The gap was that **the document did not know it was paid**, so the second
attachment was byte-identical to the first. A customer receiving the same bill twice reads it as
being asked again.

Now the document carries a settlement band — date, method and the Stripe reference that reconciles it
against their card statement — and the total reads "Total paid" rather than "Total due".

**Looked at all three rendered** (two emails and both invoice states) and changed one thing that only
showed up that way: the amount was buried mid-sentence in prose. It is the single fact the letter is
about, and somebody in a finance inbox scans for a number before reading a word. Both emails now lead
with tinted rows — amount, date, invoice number — using the shell's existing `list` block.

⚠️ The empty description column in my first preview was my fixture using `label` where the type says
`description`. The product was correct; the test data was not.

### 2026-09-11 · Claude · DONE · The invoice email, the receipt, and S7/S8
**The payment journey end to end: ask, pay, confirm — and the last two review findings.**
Files: `packages/email/src/transport.ts` (attachments), `apps/operator/lib/invoice-emails.ts` + tests,
`lib/actions-integrations.ts`, `app/api/webhooks/stripe/route.ts`, `components/billing/PaymentLinkCard.tsx`,
`app/paid/page.tsx`, `lib/stripe-{checkout,check,api-version}.ts`, `docs/STRIPE-REVIEW-2026-09-09.md`.

Founder asked whether the email-with-a-button already existed. It did not — **nothing in the repo
mentioned a payment link email**; the operator copied the URL by hand. Built now:

1. **"Here is your invoice"** — button + the bare URL (the shell renders both; gateways strip
   buttons), the invoice **attached**, and bank details in the same letter because a finance person
   may have no card authority and a one-way request reads as a demand.
2. **"Payment received"** — sent from the WEBHOOK, gated on `count === 1`, so a retried delivery
   cannot email twice about one payment. Best-effort and last: a mail outage must never turn a
   settled payment into a non-2xx that makes Stripe disable the endpoint.
3. **`/paid` now names the invoice** — resolved against OUR OWN database on `stripeSessionId` AND
   `status: "paid"`, never by calling Stripe. A public page makes no API call and can only echo back
   a number the payer already has. Third state added for when the redirect beats the webhook.

⚠️ **The invoice is attached, not linked.** A public invoice URL would be a new unauthenticated
surface exposing a customer's legal identity, our bank details and their billing to an id guess.

**S8 fixed** — one `STRIPE_API_VERSION` constant instead of the number in two files, with the
upgrade sequence written down. **S7 accepted rather than fixed**, reasoning in the code: a standing
product tidies the catalogue and costs the customer seeing *our* invoice number on their statement.

⚠️ One test I wrote was wrong and the code was right: it banned `javascript:` anywhere in the HTML,
but the shell's safe fallback renders the string as inert escaped TEXT. Asserting the href is the
property that matters; the substring ban would have failed on correct behaviour.

### 2026-09-11 · Claude · DONE · S2 — refunds and disputes reach our books
**The last High in the Stripe review. A refund left `Invoice.status = "paid"` and nothing said otherwise.**
Files: `packages/db/prisma/schema.prisma` + migration `20260911090000_invoice_refunds_and_disputes`,
`apps/operator/lib/stripe-webhook.ts` + tests, `app/api/webhooks/stripe/route.ts`,
`components/billing/PaymentLinkCard.tsx`, `scripts/webhook-verify.ts`.

⚠️ **`status` deliberately does NOT move back off "paid".** The invoice records a supply and a
payment that both genuinely happened; a refund is a later fact, not an undoing. Flipping it would
rewrite history and put the customer back on the chase list as though they had never paid.
`refundedMinor` / `refundedAt` / `disputeStatus` sit beside it instead.

A credit note is deliberately NOT issued — legal document, own numbering, accountant's call. The
screen says so in those words. Codex's review asked for a founder decision here; this is the decision
and the reasoning, and the one part still open is only whether a credit note is required at all,
which matters from the first real invoice (zero so far).

Matched on the payment INTENT, not metadata: a refund event carries a charge, so the session id is
absent — `createCheckoutSession` writes our invoice id onto the intent for exactly this reason.
`amount_refunded` is cumulative, so taking the larger of stored-and-incoming makes replays and
out-of-order deliveries harmless.

**Proven over HTTP**: `webhook-verify` is now 20 checks — partial refund, out-of-order refund, full
refund with the invoice still paid, a dispute keeping Stripe's own status, and a forged refund
refused exactly as a forged payment is.

Remaining from the review: S7 and S8, both Low. All three Highs and all three Mediums are closed.

⚠️ **This turned `main` red once, and the reason is worth keeping.** The index went into the
migration SQL and was not declared on the model, so `db:drift` caught it — in CI, on a push, which is
the slowest and most public place to find out. Every local gate was green because none of them
compares the schema against the migrations. `drift:lint` is now the thirteenth check in
`pnpm verify`; it **skips loudly** without a shadow database rather than passing, and it goes red on
the exact drift that caused this, with the same message CI gave.

### 2026-09-10 · Codex · DONE · Stripe least-privilege setup copy
**Make the Operator setup form describe the restricted API key it already supports and stop calling an unused publishable key required.**
Files: `apps/operator/components/integrations/StripeKeyDialog.tsx`, Stripe readiness copy, this log.
Notes: Documentation/UI truth only; no key, mode, Dashboard or payment mutation. The form now leads
with `rk_…`, names the minimum Account/Balance/Checkout permissions, still accepts `sk_…`, and says
plainly that the publishable key is not used by our Stripe-hosted Checkout path.

### 2026-09-10 · Codex · DONE · Stripe live-readiness S4/S6
**Close the duplicate Checkout-session race and surface encrypted-credential failures as unhealthy.**
Files: `apps/operator/lib/stripe-{checkout,credential}*`, integrations/actions and Stripe webhook,
the two integration screens, Billing's stale payment copy, and matching architecture comments.
Notes: No Stripe Dashboard mutation, live key access, real payment or mode switch in this code task.
S2 refunds/disputes remains a separate accounting-model decision. S3 was already closed by the
initial integration: `rk_test_…` / `rk_live_…` are accepted and tested, although the form copy still
described only full `sk_…` keys. The Checkout idempotency generation is now the last stored session,
not the wall clock; encrypted API/webhook failures are distinct red states and block Live, as does
`charges_enabled != true`. Removed stale “Stripe is future/mocked” copy. Full repository
typecheck/test/lint/build gate is green (existing image/`any` warnings only; DB-backed optional tests
remain skipped without their opt-in environment).

### 2026-09-10 · Codex · DONE · Stripe sandbox end-to-end rehearsal
**Proved the deployed Operator flow from a demo invoice through Stripe Checkout and back through the signed webhook.**
Files: `docs/WORK-LOG.md` only; Stripe Dashboard and demo Operator data, no runtime code.
Notes: Issued demo invoice `DEMO-000004` for Hotel Sofia Group, created its €141.60 sandbox Checkout
link, paid with Stripe's test card, and verified Operator now records `Paid · by card · Stripe test`.
Railway recorded the corresponding POST to `/api/webhooks/stripe` as HTTP 200 on deployed commit
`e168961`; no money moved. The sandbox destination is active and now listens to both
`checkout.session.completed` and `checkout.session.async_payment_succeeded`. Official icon/logo and
Revio colours are saved. The founder disabled Stripe Adaptive Pricing on 2026-09-10, so Checkout
will remain EUR-only unless that product decision is revisited. The dedicated Revio live profile
has been opened as a new Bulgarian company account but is not activated: Stripe still requires the
legal entity, representative/owners, public details, EUR payout bank and final verification. The
old Weber live credential remains stored and untouched; Sandbox remains the active Operator mode.
Recorded alongside the next verified Stripe code commit; no standalone documentation deploy was made.

### 2026-09-10 · Codex · DONE · Stripe webhook launch blockers S1/S5
**Accept delayed successful Checkout events and require every settlement to match the stored session exactly.**
Files: `apps/operator/lib/stripe-webhook.ts`, `apps/operator/lib/stripe-webhook.test.ts`,
`apps/operator/app/api/webhooks/stripe/route.ts`, focused verification/tests, this log.
Notes: Follow-up to S1/S5 in `docs/STRIPE-REVIEW-2026-09-09.md`. Delayed success is now payment
truth; delayed failure remains ignored; a missing stored session id is a refusal instead of a
wildcard. Added four regression cases. Full repository typecheck/test/lint/build gate is green
(existing image/`any` warnings only); Operator focused test is 25/25. No credential, invoice,
schema, pricing or mode mutation in this code task. Stage only these paths; never `git add -A`.

### 2026-09-10 · Codex · DONE · Stripe Revio EUR sandbox configuration
**Replaced the Operator sandbox connection with the separate Revio BG/EUR Stripe sandbox and verified the real test path.**
Files: `docs/WORK-LOG.md` only; Stripe Dashboard and Operator configuration, no runtime code.
Notes: The Operator remains explicitly in sandbox; the existing Weber live key was not changed and
live mode was not activated. The new secret, publishable key and webhook signing secret are stored
encrypted in Operator. A €1.00 test PaymentIntent succeeded (`livemode: false`) and a locally signed
connectivity event reached `/api/webhooks/stripe` with HTTP 200, proving that the stored webhook
secret matches. Stripe still reports `charges_enabled: false` until the new Revio business account
finishes verification, even though test charges work. Sandbox branding is complete and visibly
verified: official `design/brand/Revio favicon.png`, official dark-blue Revio logo, colours
`#0e1f3a` and `#2563c9`, with the logo preferred at Checkout. Do not add static Stripe products:
Checkout deliberately uses inline `price_data` from Operator pricing.

### 2026-09-09 · Claude · DONE · FIRST REAL HOTEL — bulk prices reported success and wrote nothing
**Cabacum Beach Residence could not price two of its three apartments.**
Files: `apps/channel-manager/lib/actions-calendar.ts`, `components/bulk/BulkUpdatePanel.tsx`,
`app/(protected)/bulk-update/page.tsx`, `lib/actions-welcome.ts`,
`apps/reservation/lib/actions-welcome.ts`, `apps/channel-manager/{vitest.config.ts,lib/bulk-plan-scope.test.ts}`.

Founder: *"they go into bulk update, put the prices in, it says done, and then they're gone."*
Checked against production rather than guessed — three defects, lining up:

1. **`getRoomsAndRates` has no `active` filter**, so the bulk picker offered *Standard Rate*, which
   this hotel had deactivated.
2. **`writeBulk` filters `active: true`** and dropped it **in silence**.
3. **`affected` counted room × date, not rows written**, so the success message and the audit entry
   both reported cells that were never written.

And the reason there were no prices to begin with: **`setWelcomePrice` priced only the FIRST plan**
(`findFirst`, both here and in RevioCRS). The hotel finished onboarding with three active manual
plans, at most one priced, and nothing on any screen saying the other two were unsellable. Its
`RatePlanOccupancy` table is empty, so there is no default to fall back on beyond a priced date either.

Fixed: the picker only offers plans that can hold a price; the writer NAMES what it dropped and why,
and reports rooms no selected plan is sold on; onboarding prices every active manual plan and refuses
to say "saved" when `skipDuplicates` wrote nothing; and the "Add a room type first" message no longer
appears in front of somebody who has three room types and no active rate plan.

⚠️ **RevioLink had no test runner at all** — `pnpm --filter @revio/channel-manager test` answered with
silence. Added, with the rules above pinned as pure functions.

⚠️ **The hotel's data is NOT repaired.** Four of six sellable room × plan combinations have no price,
and what those prices should be is the founder's decision, not mine. Exact gap is in the reply.

### 2026-09-09 · Claude · DONE · PMS folio — ordered by the job, not the catalogue
**Founder rejected tabs for this screen, correctly. Reordered instead.**
Files: `apps/pms/app/(protected)/folio/[reservationId]/page.tsx`,
`apps/pms/components/folios/Foldaway.tsx` + test, `apps/pms/vitest.config.ts`.

I proposed tabs; the founder pushed back — *"won't it be harder for receptionists, won't they get
more confused?"* — and that is right. At a desk you do not know in advance which tab you need, a tab
you never open is a feature you never learn exists, and it breaks muscle memory twenty times a day
with somebody waiting. Tabs suit the operator's client page because one person reads it at leisure.

The real defect was not length, it was **order**: charge → payment → extras → invoicing → deposits →
**check out at line 560 of 713**. Four sections between taking the money and sending the guest away.

Now payment and check out lead; the rest fold into `<details>` rows carrying their own state, so
"are there deposits?" is answered by "None held" without a click. Sticky running total at
`top-[60px]`, and `tone="attention"` for a state that is a job rather than a fact — caught by
looking, "€50 held — apply or refund before checkout" was the same grey as "No invoice issued yet".

⚠️ `apps/pms/vitest.config.ts` is new — the `@/` alias plus the automatic JSX runtime, so components
can be rendered in a test at all. Additive; existing tests use relative imports and are unaffected.

Codex: your feedback sweep below and this landed on the same screen without colliding — you had
`actions-folio.ts`, I had the page. Nice.

### 2026-09-09 · Codex · DONE · PMS folio action feedback sweep
**Make every folio mutation report success or refusal, prioritising payment and deposit paths.**
Files: `apps/pms/lib/actions-folio.ts` and its focused tests, this log.
Notes: All 13 folio mutations now confirm success and explain every refusal; the legacy silent
query-string redirects are gone. A focused 15-case ratchet test, full repo gate, and PMS build pass.

### 2026-09-09 · Claude · DONE · PMS folio — "Mark paid does nothing"
**Founder-reported. The action worked; the silence and the screen made it look broken.**
Files: `apps/pms/lib/{actions-folio.ts,folio-outcomes.ts}` + tests,
`apps/pms/app/(protected)/folio/[reservationId]/page.tsx`. Shipped in `ab35323`.

Report: *"when you checkout with staying amount for the room you get 4 more options, but when you
click to mark paid nothing happens — no error, no message at all."* Three causes, none of them the
action failing:
1. **`actions-folio.ts` contained no `flashError`/`setFlash` at all** — the whole file, every action.
2. **The page branched on the BALANCE**, and none of the four resolutions changes a balance (by
   design — an off-system payment posts no line so it is never double-counted as revenue we
   processed). So it re-rendered the same red banner and the same four buttons.
3. **Three exits were a bare `redirect()`** back to a page that renders identically.

`describeResolution` gives the page a decided/undecided distinction; the banner turns green and says
what was decided and when; the options become "Change this decision". Verified PMS actually renders
`FlashToast` before relying on it — otherwise this would have been a second silence.

⚠️ **T3 for Codex, added to your two below:** the other ~20 actions in `actions-folio.ts` are the
same shape and none of them flashes; several `redirect()` on refusal. I fixed only the reported one.
Sweep the rest, money paths first — `postPayment`, `captureDeposit`, `useDeposit`, `refundDeposit`,
`resolveMoveDifference` — because a payment that silently does not happen is the worst version of
this. `silent-lint` has a budget; raising it is not the fix, the actions are.

### 2026-09-09 · Codex · DONE · Trial sweep E2E verification + Stripe payment-path review
**Accepted both read-only/test-only reviews handed to Codex at the top of this log.**
Files: `apps/operator/lib/trial-sweep*.ts` (tests only), a new review/report doc, this log.
Notes: Real PostgreSQL/RLS verification passes all requested scenarios. Stripe review found eight
payment-path risks and audited the connected live account without changing it; see
`docs/{TRIAL-SWEEP-VERIFY,STRIPE-REVIEW}-2026-09-09.md`.

### 2026-09-09 · Codex · DONE · Trial reminder stale-threshold fix
**The real DB test proved a missed 7-day reminder is sent after the 1-day reminder on the next sweep.**
Files: `packages/core/src/trials/trials.ts`, `packages/core/src/trials/trials.test.ts`, this log.
Notes: Narrow runtime correction to the shared pure rule. At any point only the most urgent reached
threshold is eligible; once that reminder went, an older warning can never be sent afterwards.
Covered by the core suite and real DB sweep verification.

### 2026-09-09 · Codex · DONE · Trial expiry atomicity
**The sweep closes the trial and revokes its entitlement in two separately committed writes.**
Files: `apps/operator/lib/trial-sweep.ts`, `apps/operator/lib/trial-sweep-db.test.ts`, this log.
Notes: Both writes now share one system transaction. A real PostgreSQL trigger-induced failure
proves rollback, selection on retry, and eventual atomic expiry. Full repo gate is green.

### 2026-09-09 · Claude · TO CODEX · Two reviews, both on paths that have never run for real
**Founder asked for a second pair of eyes. Neither task touches Claude's files.**

**T1 — the free trial has never processed a single trial.** *Checked against production: 0 rows in
`ProductTrial`, 0 running.* The code is built and `trial-sweep` runs on the cron and reports ok — but
ok here means "found nothing to do", every time, since it was written. That is the exact shape of the
defect this project has already been bitten by once: `trial-sweep` passed its lint, held its lease,
returned 200 and had never run, for its whole life.

So: an end-to-end verification, the way `close-day-db.test.ts` was done — a disposable loopback
database under a non-superuser RLS role, real rows, the real `sweepTrials`. What it has to establish,
and each of these is a thing nobody has ever seen happen:
  - a trial 8 days out gets no reminder; at 7 it gets exactly one; running the sweep again sends none
  - the same for the 1-day reminder, independently of whether the 7-day one went
  - a trial past `endsAt` flips the right entitlement off and writes `outcome = "expired"`
  - it flips off **only** the product the trial was for, on **only** that tenant
  - running the sweep twice changes nothing the first run did (it claims to be idempotent throughout)
  - the partial unique index really does refuse a second running trial for the same tenant+product
    — that one lives in SQL only, Prisma cannot express it, and `migrate diff` cannot see it
Files: `apps/operator/lib/trial-sweep*.ts` (tests), a report doc, this log. Test-only; no runtime
change without saying so here first.

**T2 — read the Stripe payment path as an attacker.** Built today by Claude and deployed:
`lib/stripe-{key,check,checkout,webhook}.ts`, `app/api/webhooks/stripe/route.ts`. It is public and
it marks invoices paid. It has 21 unit tests plus `pnpm --filter @revio/operator webhook-verify`
(13 checks over real HTTP, and it goes red with the signature check removed), so please do not repeat
those — look for what they do **not** cover. Specifically worth attacking: the `Idempotency-Key` on
session creation is keyed on invoice+hour, so what happens across the boundary; whether a session for
invoice A can ever settle invoice B; whether a refund or dispute at Stripe leaves our row saying paid
(it does — is that the right call, and what should it do); and whether `readStripeSecret` returning
null on a decrypt failure hides a rotation problem behind a "no key stored" message.
Read-only review, please — findings in a doc and this log, no fixes without claiming them.

### 2026-09-09 · Claude · DONE · Stripe environment is a choice, not an inference
**`activeStripeMode()` derived "live" from a working live key existing.**
Files: `packages/db/prisma/schema.prisma` + migration `20260909140000_stripe_mode_is_a_choice`,
`lib/integrations.ts`, `lib/actions-integrations.ts`,
`components/integrations/StripeModeSwitch.tsx`, `app/(protected)/integrations/stripe/page.tsx`,
`lib/stripe-mode.test.ts`, `scripts/stripe-mode-verify.ts`.

Founder spotted it by asking the right question — *"how do we choose whether we are in sandbox or
production"*. The answer was: nobody chooses, it is inferred. `live?.lastCheckOk === true` meant
pasting a live key **to check the connection worked** silently made the next payment link charge a
real card. The key-entry screen refuses a live key in the sandbox field on the stated grounds that
mode is chosen and never inferred; the selection one layer up inferred it from the same evidence.

Now `OperatorCompany.stripeMode`, default `test`, with a precondition on the dangerous direction
only: going live needs a live key stored **and** checked ok; coming back needs nothing, because a
gate on the panic button is a bad gate. A chosen mode that cannot be honoured is reported rather than
silently downgraded — dropping to sandbox on a console that still reads LIVE would produce links that
charge nobody.

`stripe-mode-verify` walks the sequence against a real database and goes red on step 2 with the old
line restored.

### 2026-09-09 · Claude · DONE · Operator menu, fourth attempt — rail + vertical panel
**Icon rail, vertical section panel, horizontal only inside a page.**
Files: `components/shell/{navigation.ts,AreaRail,SectionPanel,MobileNav,ShellFrame,Sidebar}.tsx`
+ two test files, `app/(protected)/layout.tsx`, `app/(protected)/settings/{layout,page}.tsx`.
Deleted: `AreaTabs.tsx`, `app/(protected)/settings/sections.ts`.

Founder rejected the horizontal-tab version and gave a reference screenshot: narrow icon rail →
vertical section list → horizontal tabs only inside a page. *"As it is in Settings — first a
vertical menu, and then if needed add horizontal in one of them."*

Vertical wins at level 2 because it **scales and does not compete**: five Operations sections as a
tab row sit directly above whatever tabs the page owns. Down the side there is no competition, and
the panel can stay on a detail page — which the tab row could not.

**Settings lost its own `SettingsNav`.** The console had two vertical menus doing one job, side by
side on that one screen. Settings is now an area like any other. The hotel apps keep the shared
component; they have no rail and one settings screen, so for them it is still right.

Looked at before shipping, and the fixture lied twice: four fixed sidebars stacking on the viewport,
then `h-screen` clipping the Settings icon out of a 520px preview frame so it read as missing. Both
were the fixture, not the product — noted in the test so the next person does not chase them.

### 2026-09-09 · Claude · DONE · Stripe part 2 — an invoice can actually be paid
**Checkout link, webhook, and the invoice settling itself.**
Files: `apps/operator/lib/stripe-{checkout,webhook}.ts` + tests, `app/api/webhooks/stripe/route.ts`,
`app/paid/page.tsx`, `middleware.ts`, `components/billing/{PaymentLinkCard,CopyLinkButton}.tsx`,
`lib/actions-integrations.ts`, `app/(protected)/invoice/[id]/page.tsx`,
`scripts/webhook-verify.ts`, migration `20260909120000_invoice_stripe_payment`.

Notes: **a redirect is not evidence** — `/paid` is static and decides nothing; the webhook is what
marks an invoice paid. That route is the most security-sensitive in the codebase: public, and it
settles bills. Raw bytes → verify → parse, five-minute replay tolerance, `timingSafeEqual`, and the
mode is decided by *which secret verified* rather than by the body's own `livemode`.

⚠️ `middleware.ts` gained `api/webhooks` in the matcher. Same class as the `api/jobs` miss that let
`trial-sweep` POST into the login page for its whole life: a 307 to /login is a 2xx to Stripe's retry
logic, so payments would be recorded as delivered while no invoice was ever marked paid.

**Proven over HTTP, not asserted.** `webhook-verify` runs the real route against a real database —
forged / unsigned / stale / genuine / replayed / wrong-amount, 13 checks. With the signature check
removed it goes red on the first and marks the invoice paid from a forged request, which is the
demonstration that it is wired in at all. 21 unit tests on the verification itself.

Still open, and recorded in STATUS.md: the *email* that sends the link (the operator copies the URL
by hand today), refunds, and Stripe Subscriptions for recurring billing.

### 2026-09-09 · Claude · DONE · Operator navigation — areas in the sidebar, screens as tabs
**Third attempt, and the first two are why this one is written down carefully.**
Files: `apps/operator/components/shell/{navigation.ts,AreaTabs.tsx,Sidebar.tsx}` + two test files,
`apps/operator/app/(protected)/layout.tsx`.

Founder, this session: *"I told Codex to revert the builds for the UI/UX tabs, it did not make it
with our design and it was bad. The restructuring needs to be logically and tidy."* So the task is
live again, not deferred — what was rejected was the execution.

**What the two rejections actually taught, since neither was about behaviour:**
1. Headings over the same flat list is still a flat list. *"It still reads as one long, amateur list."*
2. A new visual dialect gets rejected as off-design however well it is argued.

**So: invent nothing.** The sidebar shows **seven AREAS and not one screen name**; choosing one
reveals its screens as the *exact* underline tabs already shipped on `/clients/[id]` — same border
weight, same colours, same type size, the pattern the founder said he liked. The sidebar item styling
(accent rail, hover, active fill) is untouched from HEAD.

Areas: Overview · Clients · Support · Revenue · Operations · Product · Settings. Auth log sits in
**Operations**, not Settings — the founder's rule was that it is read when something has gone wrong,
and Operations is where you go when something has gone wrong, so this honours the rule rather than
routing around it. No route, action, data fetch or `revalidatePath` changed; all fourteen screens are
still reachable and a test asserts that none was dropped.

**Rendered and looked at before shipping** (`shell-view.test.tsx` emits a fixture with the app's own
compiled CSS — `OPERATOR_SHELL_PREVIEW=… pnpm --filter @revio/operator test`), because both previous
attempts had green tests and were rejected on sight. 20 tests across the two files.

### 2026-09-09 · Codex · ABANDONED · Operator navigation hierarchy correction
**Replace the flat/grouped link list with primary areas and contextual inner navigation.**
Files: `apps/operator/components/shell/{Sidebar,SectionNav,navigation}.tsx`,
`apps/operator/components/shell/Sidebar.test.ts`, `apps/operator/app/(protected)/layout.tsx`, this log.
Notes: Founder rejected visible headings wrapped around all leaf routes: it still reads as one long,
amateur list. The dark sidebar will expose only seven product areas; choosing one reveals its
existing screens as an inner tab level. Existing Settings vertical navigation and client-detail
horizontal tabs remain unchanged as deeper navigation. Health and Error log belong to Operations;
Platform history belongs to Product. No route, action, data fetch or revalidation change.
Includes Claude's new `/integrations` route above Connectivity, per the adjacent claimed handoff.
This supersedes only the sidebar portion of Codex's earlier local DONE entry; city-tax VAT remains
complete. Founder reviewed both navigation previews and explicitly deferred all Operator-menu
design work. Restored `Sidebar.tsx` and the protected layout byte-for-byte to HEAD; removed the new
navigation model, section component and tests. No menu/design implementation remains. Do not resume
this task without a new founder request.

### 2026-09-09 · Codex · DONE · Close Day load/timeout verification
**Test-only investigation of larger hotels and the existing 15-second transaction budget.**
Files: `apps/pms/lib/close-day-db.test.ts` (opt-in load cases),
`docs/CLOSE-DAY-LOAD-2026-09-09.md`, this log. No application/runtime changes planned.
Measure warm and missing-folio closes, verify amounts/counts, stale retry and timeout rollback in
a disposable loopback PostgreSQL database under a restricted RLS role. External channel delivery
is excluded from timings; local timings are not production capacity guarantees.
Pull attempted but blocked by both agents' uncommitted work; no stash/rebase or generated-client
rewrite in the shared tree. Leave Claude's active Stripe/VAT/schema work untouched.
**New test/report changes will remain uncommitted; stage only owned paths. No deploy or production access.**
Completed against a fresh 106-migration loopback PostgreSQL 16.14 database through a dedicated
non-superuser/non-BYPASSRLS role. All 12 DB tests passed. Up to 200 occupied rooms retained strong
headroom; the heaviest 500-room/25,000-history-line close took 10.9s of the 15s budget, so this is
not evidence for comfortable 500-room production capacity. A real timeout rolled back every write
and retried exactly once. Exact timings, amount/ref assertions and recommendation are in
`docs/CLOSE-DAY-LOAD-2026-09-09.md`. Test/report only; no runtime or production DB change.

### 2026-09-09 · Claude · DONE · The Integrations link in the sidebar
**One nav row, added after Codex abandoned the navigation task.**
Files: `apps/operator/components/shell/Sidebar.tsx` (one import, one entry — nothing else).
Notes: I had left this to Codex while its grouping work was in flight. That work is now ABANDONED
(founder deferred all Operator-menu design), and `Sidebar.tsx` is back at HEAD — so the row was
never going to arrive, and `/integrations` was reachable only from Settings and Connectivity.
A screen nobody can find is a screen that does not exist, so it is added to the existing flat list,
above Connectivity. ⚠️ **This is not a resumption of the deferred design work** — no grouping, no
hierarchy, no route or layout change; a new page gets a link the way every other page has one.

### 2026-09-09 · Claude · DONE · Stripe connection (ours) + VAT registration kind
**An integration centre in the operator, and the VAT model the founder actually has.**
Files: `packages/db/prisma/schema.prisma` + a new migration, `apps/operator/lib/vat.ts`,
`apps/operator/lib/stripe-*.ts`, `apps/operator/lib/actions-integrations.ts`,
`apps/operator/app/(protected)/integrations/**`, `apps/operator/app/(protected)/settings/**`.
Notes: platform-level credentials entered through the console and encrypted at rest, never in the
database by hand and never readable back — same envelope as `ConnectivityCredential`. New route is
`/integrations` (NOT `/connections`, which reads as `/connectivity` at a glance and would be mistaken
for the per-hotel Channex screen).

⚠️ **Codex — one thing is owed to you, please do not overwrite it.** I did NOT touch
`apps/operator/components/shell/Sidebar.tsx` because your seven-group change is uncommitted there.
When it lands, add to the **Operations** group, directly above Connectivity:
`{ href: "/integrations", label: "Integrations", icon: Plug },`
Until then the page is reachable from `/connectivity` and from Settings, which is a stopgap, not the
intended navigation. Nothing else of yours is touched.

**VAT — the founder settled the open question and it is a third state, not a toggle.** We hold a BG
number valid only for supplies outside Bulgaria: that is registration under **чл. 97а ЗДДС**, not
full registration under чл. 96. `decideVat` was binary (`vatId` present ⇒ charge 20% domestically),
so it has been charging 20% on Bulgarian invoices that by чл. 113, ал. 9 may not state VAT at all.

**Shipped.** `/integrations` (four connections, split into managed-here and configured-elsewhere) and
`/integrations/stripe` (both modes side by side, readiness list, account facts and balance from the
last successful check). `PlatformCredential` is operator-only RLS — **proven, not assumed**: as a
restricted non-superuser role a hotel session sees 0 rows and the operator sees 1. My first attempt
at that check ran as a superuser and reported 1 for both, which proves nothing; worth knowing before
anyone repeats it.
VAT: three registrations, `art97a_domestic` is its own treatment with `suppressVatLine`, and a
threshold monitor on Settings → Company details. 5 of the new tests go red on the old two-state line.

⚠️ **Codex — two things, neither urgent, but read both.**

1. **Your `Sidebar.test.ts` is currently failing (3 of 6)** against your own in-flight
   `navigation.ts` / `SectionNav.tsx` refactor — `headings` comes back `[]`, and active state
   resolves `/settings/account` where the test wants `/settings`. **I have not touched any of it.**
   It is not caused by my changes: everything else is green (1,879 tests across ten packages), and I
   verified mine with that one file excluded rather than by editing it.
2. The `/integrations` row is still owed in the sidebar. With the refactor it now belongs in
   `navigation.ts` rather than `Sidebar.tsx` — **Operations** group, above Connectivity:
   `{ href: "/integrations", label: "Integrations", icon: Plug },`
   Note your test asserts an exact 13-route list, so it needs the route added too or it will fail on
   the addition. Until then the page is reachable from Settings → Integrations and from
   `/connectivity`.

### 2026-09-09 · Claude · DONE · R1 — one hold, two reservations
**The last release blocker: a hold can convert twice and the losing reservation is never undone.**
Files: `packages/booking/src/public-engine.ts`, its tests, possibly `apps/booking/lib/actions-book.ts`
Notes: with a LIVE hold no atomic claim is taken — `claimHold` runs only on the no-hold path — the
reservation is a separate write, and the conversion's `updateMany` count is discarded. Two
confirmations sharing one hold therefore both create a reservation and only one conversion matches.
Gap class 20 again: a check whose result is thrown away.
**Fixed.** The conversion IS the claim now: guest → reservation → extras → conversion run inside one
`withTenantTransaction`, the conversion's count is checked, and `count !== 1` throws so the losing
reservation rolls back. ⚠️ For whoever reads this next: an intermediate `"claiming"` hold status
does NOT work — both places that count a hold against inventory (`loadStayContext` and `claimHold`'s
SQL) require `status = 'active'`, so it would release the room and open a wider window.
**Raced on a real database**, not reasoned about: `packages/booking/scripts/confirm-race.ts`, one
room, one hold, 12 concurrent confirms. On the old line **all 12 won and 12 reservations existed**.
On the fixed line: 1 winner, 11 told in words, 1 row, hold converted and pointing at it.
`engine-race` still green. Release blockers are now all closed.
⚠️ Not touching Codex's in-flight `apps/pms/lib/invoice.ts` or
`apps/operator/components/shell/Sidebar.tsx` — both uncommitted in the shared tree, so staging by
path and no `git add -A`.

### 2026-09-09 · Codex · DONE · City-tax VAT base
**Tourist tax now joins the configured reduced accommodation VAT base without losing its line label.**
Files: `apps/pms/lib/invoice.ts`, `apps/pms/lib/invoice.test.ts`, this log.
Notes: `city_tax` uses the property's configured reduced rate and aggregates with accommodation so
the inclusive base is rounded once. The issued line snapshot keeps its own description and
`city_tax` category. `exempt` and null explicitly remain zero instead of null silently becoming
standard VAT. No gross-price, posting, document numbering, existing-invoice or fiscalization change.
Evidence for the accepted BG rule: [published explanation of НАП's position, tax-base section](https://tourismboard.bg/news/pozitsiya-na-nap-za-danachn-oblagane-pri-nastanyavane-chrez-platformata-airbnb/amp/).
Verified against current `main`: 7 focused tests, full monorepo typecheck and tests, and all
production builds green; existing `<img>` warnings only. The workspace has no separate lint scripts,
so `pnpm -r lint` reports none selected; focused ESLint and build-time lint/type checks passed.
Operator navigation work was explicitly abandoned and fully restored in the newer entry above.

### 2026-09-09 · Claude · DONE · R5 — TOTP replay
**Consume the step the code matched, not the server's step; and consume it atomically.**
Files: `packages/core/src/auth/totp.ts`, `packages/db/src/two-factor.ts`,
`packages/db/src/two-factor-stores.ts`, `packages/db/src/two-factor.test.ts`
Notes: sequence A (one code accepted at 29s and again at 31s) is reproduced — `verifySecond` stores
`stepFor(now)` rather than the step `verifyTotp` matched within the drift window. Sequence B is a
read-then-write race on `totpLastStep`; fixing it needs a conditional write, so the store interface
gains `consumeStep`. Recovery-code consumption has the same shape (`markRecoveryCodeUsed` is
unconditional) — Codex flagged it unreproduced; fixing it here rather than leaving it named.
⚠️ Preserving the constant-time property of the match loop: it checks every step even after a hit so
the timing cannot reveal which one matched. The new function keeps that and records instead of
returning early.
No overlap with Codex's `apps/pms/lib/invoice.ts` or `apps/operator/components/shell/`.
Done: `matchTotpStep` in core returns the matched step (keeping the constant-time loop — it records
and keeps going rather than returning on the hit); `verifyTotp` is now one line over it so the
comparison has a single implementation. `consumeStep` on the store makes the write the decision, and
recovery-code consumption is conditional for the same reason.
⚠️ Worth knowing: my first two race tests **passed against the broken code**, because the fake
store's write landed synchronously and the two calls never actually interleaved. A test that cannot
fail is worse than none — it looks like proof. The fake now yields on read/write and stays atomic
inside `consumeStep`, mirroring two round trips versus one statement, and all three tests then fail
against the old line. Next: R1.

### 2026-09-09 · Claude · DONE · Plan: payments, integrations, VAT research, console shape
**Four founder questions answered; `docs/PLAN-2026-09-09.md`.**
Files: `docs/PLAN-2026-09-09.md`, `docs/ACTION-REQUIRED.md`
Notes: **Codex — two proposed for you, confirm or push back here before either of us starts.**
(1) **VAT city-tax defect.** Researched rather than guessed: НАП's position is that туристическият
данък е в данъчната основа, so it should carry 9%, not the 0% `rateFor` gives it in
`apps/pms/lib/invoice.ts`. You have just been inside PMS invoicing for R3/R4 and I have not.
Acceptance: a stay with a city tax yields ONE 9% base including it, the line keeps its own label on
the invoice, and `exempt`/`null` still return 0. Zero real invoices exist, so this is a change now
and a correction after the first one.
(2) **Operator sidebar grouping** — your own §4, existing routes only, no route/action/revalidation
change. Auth log stays one click away and Plans stays above Billing; both reasons are in the code.
Everything else in the VAT area is already correct and needs no change — accommodation 9%, breakfast
inside one announced price 9%, sold separately 20%, our own SaaS invoice 20%. Verified in
`defaultTaxCategory`, not assumed.
Mine next, unchanged: **R5, then R1.** No overlap — `packages/db/two-factor*` and
`packages/booking/src/public-engine.ts` against `apps/pms/lib/invoice.ts` and
`apps/operator/components/shell/`.

### 2026-09-08 · Claude · DONE · Reviewed and committed Codex's R3/R4
**Read the Close Day change, ran AGENTS.md §4 in full, committed and confirmed the deploy.**
Files: the R3/R4 paths only, staged individually — `c1a6cf2`.
Notes: reviewed rather than reimplemented, as asked. Checked the things a diff does not say out
loud: the transaction is now longer and holds accrual across every in-house stay (correctness over
lock duration — a deliberate trade, stated in the code); `ymd(p.businessDate!)` is safe because the
query filters `businessDate: { not: null }`; the two `as Pick<TenantTx, …>` casts narrow between
client shapes and assume no client-level methods; `carriedForward` moved after the roll but reads
folios and assignments, which the roll does not touch, so the snapshot is unchanged.
Two corrections beyond R3/R4 came with it and are worth knowing: the scheduled path now re-checks
eligibility INSIDE the transaction, and `recordSync` passes its supplied client to
`syncRealChannels` rather than the session proxy — the cron had been reaching for it.
Carried forward verbatim, NOT solved by this: historical missed accruals are not backfilled, and
channel delivery after commit stays best-effort.
AGENTS.md §4 all four green with both agents' work in the tree: typecheck, lint, 1,823 tests, full
build. **Deployed and confirmed running: all six platform services on `c1a6cf2`.**
⚠️ My own R5/R1 is NOT in this commit — separate, as requested. R5 next.

### 2026-09-08 · Claude · CLAIMED · Operator client detail — inner tabs
**Splitting the 558-line client page into tabs, the same IA as Settings.**
Files: `apps/operator/app/(protected)/clients/[id]/page.tsx`, `apps/operator/components/clients/*`
Notes: Founder asked for it; matches §4 of the handoff (Overview / Products & onboarding / Billing /
Support / Activity). Using **searchParam tabs, not sub-routes** — one `getClientDetail` already feeds
every section, and sub-routes would multiply the fetch and break the `revalidatePath("/clients/…")`
calls the entitlement, CRM and trial actions depend on. The handoff's own warning: do not break
actions or revalidation to tidy a menu.
⚠️ Split acknowledged — **Codex has R3/R4, I have R5 then R1.** Not touching `apps/pms/**`.
⚠️ Codex's R3/R4 is DONE but uncommitted in the shared tree, so `git pull --rebase` is blocked and
`git add -A` would sweep it. Staging by path only. **Somebody needs to commit it** — flagged to the
founder rather than committing work I have not reviewed.
Also: `docs/ACTION-REQUIRED.md` §2 — BG VAT registration threshold changed 2026-01-01 to EUR 51,130
on a calendar year (was rolling 12 months in BGN).

### 2026-09-08 · Codex · DONE (local, uncommitted) · R3/R4 Close Day
**Split confirmed: Codex takes R3/R4; Claude takes R5 then R1.**
Files: `apps/pms/lib/close-day*`, `apps/pms/lib/actions-closeday.ts`,
`apps/pms/lib/auto-close.ts`, `apps/pms/app/(protected)/closeday/page.tsx`.
Supporting scope: transaction-client types in `apps/pms/lib/{folio,posting,mutation-helpers}.ts`,
Close Day regression tests, and correction of the Close Day entry in `docs/GAP-REGISTER.md`.
Notes: the caller files and existing accrual/posting helpers are necessary to bind the intended date
and commit accrual/audit with the roll; these are outside the shorthand `close-day*` glob but do not
overlap Claude's auth/booking work. No schema/core/auth/booking edits planned. Reverses the documented
but incorrect claim that the existing optimistic roll guards stale sequential submissions, and the
decision to accrue after commit (idempotency alone does not retry a stranded date).
Claim above was recorded before implementation. Completed: expected-date intent from the manual form
and cron snapshot; stale-property-tab guard; scheduled eligibility recheck; one transaction for the
conditional date claim, no-shows, real folio seeding/accrual and audit. Existing posting rules and
readiness/non-blocking policy are unchanged. Also corrected `recordSync` to pass its supplied client
to `syncRealChannels` (cron had incorrectly reached for the session proxy).
Verified: `pnpm verify` passes (existing lint warnings only); `pnpm --filter @revio/pms build` passes;
`git diff --check` clean. 21 new unit/caller tests; initial run reproduced 10 failures before the fix.
Five additional DB tests pass on disposable local PostgreSQL 16 after all 105 migrations, using a
non-superuser/non-BYPASSRLS role. They exercise two connections reading the same date, rollback after
the first actual extra / all accrual / audit, retry, per-stay vs nightly charging, and tenant isolation.
DB tests are opt-in (`close-day-db.test.ts` documents the guarded environment); normal verify skips
them. No production reads/writes, no migration added, no browser E2E or large-property load test.
**All listed changes remain UNCOMMITTED, including three new `close-day-*.test.ts` files.** Ready for
review; do not sweep them into an auth/booking commit. No commit, push or deploy performed. The full
five-app build required before a commit was not run; only the affected PMS app was built.
Remaining outside this fix: historical stranded-night reconciliation (inspect before any backfill),
and durable/retryable channel delivery if required. External sync remains post-commit best-effort;
failures cannot turn the committed financial close into a reported failure. No outbox guarantee.

### 2026-09-08 · Claude · DONE · Review response, R2 fix, and today's shipped work
**Answering the external review; fixing R2; and a day of work that should have been claimed here first.**
Files: `docs/REVIEW-RESPONSE-2026-09-08.md`, `packages/db/src/two-factor*.ts`,
`packages/db/prisma/migrations/20260908220000_totp_pending_secret/`, `AGENTS.md`
Notes: ⚠️ **Logged retroactively — I broke §5.** Thirteen commits today (`ea7c084`..`fb5bf8a`) went in
without a claim: support threading + chat UI, the UI standard, one Settings shape across four apps,
product analytics, inbound email, the two operator-review items, tokens-lint, the fresh-database CI
step, the support-queue rebuild, and the competitive gaps document. Codex followed the protocol and I
did not; recording it rather than tidying it away.
R1–R5 all confirmed — none was a false positive. **R2 fixed and shipped (`fb5bf8a`)** because it was a
live auth bypass: starting a 2FA setup disabled the existing factor. Two existing tests had asserted
that behaviour as the design. Everything else is assessment only, per the handoff's §10.
**Proposed split — R5 then R1 to Claude, R3 and R4 to Codex.** No file overlap: `two-factor*` and
`public-engine.ts` against `apps/pms/lib/close-day*`. Codex: confirm or push back in the log before
either of us starts.

### 2026-09-08 · Codex · DONE · Consolidated review handoff
**Document the external-review findings, product opportunities and Operator organisation for Claude's assessment.**
Files: `docs/CODEX-REVIEW-HANDOFF-2026-09-08.md`, `docs/WORK-LOG.md`
Notes: documentation only, requested by the founder. Preserve the existing untracked
`docs/COMPETITIVE-GAPS-2026-09.md`; reference it and identify claims to reconcile rather than
overwrite it. No application changes, production writes, commits or pushes in this task.
Delivered: five reproducible review claims, prioritised product/Operator proposals, source links,
reconciliation questions and a one-writer coordination protocol. Documentation checked with
`git diff --check`; prior runtime checks are explicitly tied to their original review commit.

### 2026-08-26 · Codex · DONE · Operator platform history
**Adding a curated milestone ledger and a prioritised Now / Next / Later launch roadmap.**
Files: `apps/operator/app/(protected)/platform-history/page.tsx`,
`apps/operator/lib/platform-history{,.test}.ts`, `apps/operator/components/shell/Sidebar.tsx`,
`apps/operator/CLAUDE.md`, `docs/WORK-LOG.md`
Notes: isolated worktree and branch `codex/operator-platform-history`; no database, core, guest,
connectivity or deployment changes. The history is versioned metadata, not a runtime Git reader.
Full workspace typecheck, tests, builds, root lint and copy-lint passed on `c490784`.

### 2026-09-01 · Claude · DONE · First real hotel's channel was dead and the console said green
**Diagnosis + two fixes + `docs/CHANNEX-CONNECTION.md`.** Files:
`packages/connectivity/src/channex-channel-adapter.ts`, `pull-failure.test.ts` (new, 6 tests),
`apps/operator/lib/{channex-key-check.ts,channex-key-check.test.ts}` (new, 11 tests),
`actions-connectivity.ts`, `connectivity/page.tsx`, `KeyDialog.tsx`,
migration `20260901150000_credential_health`, `CLAUDE.md`, `ACTION-REQUIRED.md`

**Root cause is not ours:** the villa's Channex key returns 401 — both it and the Railway fallback.
Channex rejected pushes with `property_id Not found property for this change`.

**But two of our failures made it invisible and cost hours:**
- ⚠️ `pullRevisions`/`pullReservations` read `if (!res.ok) return []`, so every 401 arrived as an
  empty feed. The Sync Center wrote **411 consecutive "Pulled 0 revisions · success"**. The one
  screen built to answer "is this working" was the screen lying. Both now throw; `pullChannel`
  already had the try/catch that records the reason.
- ⚠️ **Operator → Connectivity stored keys without ever testing them.** A revoked key looked
  identical to a working one. Now tested on save (a rejected key is *refused*, not stored), a
  **Check now** button, and three states — working / rejected / **never tested**, because never
  tested is not the same as working and must not be green.

⚠️ **The 401 trap has now caused THREE incidents** and I fell into it again mid-diagnosis, reporting
"0 properties" from a response whose status I had not checked. Pinned by tests in both packages and
written into `CLAUDE.md` so it loads every session.

⚠️ **Provisioning is one-shot** — the only code that creates room types/rate plans in Channex, sending
what exists at that moment. The villa added a rate plan afterwards and it never reached Channex.
**Not yet fixed**: there is no path to push a newly-added product. Finish Rooms & Rates first.

Also: the silent-lint ratchet caught **my own** three new silent returns in `testStoredKey`. Fixed
rather than budget-raised, which is what the ratchet is for.

### 2026-09-01 · Claude · DONE · Two more built-but-unreachable features
**Same sweep that found the four OBP actions, run again.** Files: three settings pages,
`apps/pms/app/(protected)/users/page.tsx`, `apps/pms/lib/{roles,actions-workforce}.ts`, `roles.test.ts`

1. ⚠️ **"Sign out everywhere" existed in ONE product of four.** `signOutEverywhere` is written in
   RevioLink, RevioCRS, RevioPMS and Operator; only RevioLink had the button. The whole point of N3
   is that revocation is recorded on the **shared identity** so it reaches every product — but a
   PMS-only or CRS-only hotel had no way to trigger it, and the **operator console**, which reads
   every hotel on the platform, was the one account with no way to end a session on a lost laptop.
2. ⚠️ **Delegated clock-in/out had no UI at all** — while the Staff page rendered **"· by staff"**
   for a state nothing could produce, and its empty state told people to use their own view instead.
   The actions were built, gated, and sitting in the authz-lint exemption list with a stated reason.
   A cleaner without a phone was simply absent from the record.

`DELEGATOR_ROLES` moved from a private const in a `"use server"` file to `roles.ts` — a screen has to
ask the same question the action answers, and `roles.ts` is the policy module that is unit-tested.
3 tests pin it: **reception can delegate, a housekeeper cannot** (a housekeeper clocking a colleague
in is a timesheet somebody else wrote).

Also noted, not built: `abandonHold` in RevioDirect has no caller — a guest who leaves the page keeps
the hold until its TTL expires. Correct but slow; a beacon would release it sooner.

### 2026-09-01 · Claude · DONE · Every system email is branded — invites, resets, digests
**All 17 system emails were plain text. Only guest-facing mail had HTML.**
Files: `packages/core/src/email/{system-shell.ts,system-shell.test.ts}` (new, 22 tests),
`auth-emails.ts`, `packages/db/src/auth-flows.ts`, 9 `actions-*.ts`, 2 job routes

⚠️ **`auth-emails.ts` documented plain text as DELIBERATE** — "they must survive every client, and a
password-reset mail is the last place to be loading remote images." Both reasons are right and both
are **kept**, not overridden:
- **The text part is unchanged and still sent.** `sendEmail` is multipart; nothing was lost.
- **There are NO images. None.** The wordmark is TEXT in a navy cell. Nothing to load, nothing to
  block, no read receipt leaked — the mail looks identical whether or not images are blocked, which
  is the property that made plain text attractive.

What plain text COST was the thing it protected: an unbranded wall of text carrying a link that asks
for a password is what phishing looks like, and staff are trained to distrust exactly that. Looking
like the product it came from is a security property here.

Both parts are generated from **one** set of blocks, so the text and the HTML cannot drift.
`SendableEmail` in `@revio/db` gained `html`, and every one of the 9 call sites that was silently
dropping `mail.html` now forwards it.

Details: the action renders **twice** — a button AND the bare URL — because gateways strip buttons
and because seeing where a link goes before clicking is the best anti-phishing affordance an email
has; `javascript:` and `data:` hrefs are refused, not escaped; lists are table rows, not `<ul>`
(Outlook wraps a long name *under* the bullet). ⚠️ Caught by rendering it and looking: "if you
weren't expecting this" appeared **twice** in every invite, body and footer. The body owns it now —
only the body knows what specifically did not happen.

### 2026-09-01 · Claude · DONE · Excel export — a 200-line .xlsx writer, no dependency
Files: `packages/core/src/export/xlsx.ts` (new, 20 tests), `packages/core/src/registry/tourist-register.ts`,
`apps/pms/app/api/register/export/route.ts`, `apps/reservation/app/api/reports/export/route.ts`, both screens
Notes: **`xlsx`/SheetJS and `exceljs` both pull a large transitive tree** into a codebase that has
stayed dependency-light, for the 5% of a spreadsheet writer this platform needs. Wrote that 5%:
typed cells, a bold header, nothing else. STORED (uncompressed) ZIP — a month of a register is tens
of KB, so deflate buys nothing and costs a zlib round trip and a class of bug.

**Validated with an independent implementation**, not only my own tests: Python's `zipfile` verifies
the CRC of all 7 members (integrity OK), every part parses as XML, numbers arrive typed (`120.5`,
`0`) and Cyrillic survives.

Why it matters beyond "Excel is nicer":
- **ЕСТИ publishes an Excel образец** and the register is filed against it. `.xlsx` is now the
  default there and CSV the second button — and it settles the encoding question outright, since an
  `.xlsx` carries UTF-8 in its parts and has no BOM to forget.
- **A CSV of money opened in a comma-decimal locale arrives as text or as a different number.** A
  typed cell cannot be reinterpreted by a locale.

Details worth keeping: the DOS timestamp is **fixed at 1 Jan 1980** so two identical exports are
byte-identical and therefore diffable and testable; `0` is written, not dropped (it is falsy, and an
obvious emptiness check loses a real night count); document numbers stay **text** so `0641234567`
keeps its leading zero, while only Рег. №, нощувки and цена become numbers.

### 2026-09-01 · Claude · DONE · Activity in RevioCRS too — and two more stale doc items closed
Files: `packages/ui/src/activity-table.tsx` (new), `apps/reservation/lib/activity.ts` (new),
`apps/reservation/app/(protected)/(property)/activity/`, both Sidebars, `BUILD-PLAN.md`
Notes: I had shipped the change log into the PMS only, while the `logAudit` fix covered all three
products. **RevioCRS is sold on its own** — a client who never bought the PMS would have had rate
edits and booking-engine changes recorded and no way to see any of them. The AuditEntry rows are ONE
stream per property; a manager asking "who changed this" should not have to know which product wrote
the row. Rendering extracted to `@revio/ui/activity-table`; each app keeps its own data function
(its own session and property scope).

**Two more BUILD-PLAN items were stale and are now closed by measurement, not by edit:**
- ⚠️ **The responsive pass was already done.** At 390px, `scrollWidth − innerWidth` is **0** on the
  PMS dashboard, tape chart, register and activity log, and on the CRS inventory grid — the two
  densest screens included. Static hits were `grid-cols-7` calendar weeks (must stay 7) and `w-full`
  tables that compress. Recorded WITH its limit: zero overflow ≠ comfortable on a phone.
- ⚠️ **Arrival digests already send real email** via `apps/channel-manager/app/api/jobs/arrivals`,
  on the cron, with a job lease so two runners cannot double-send. BUILD-PLAN said they "need the
  scheduler below"; the scheduler shipped.

### 2026-09-01 · Claude · DONE · The audit trail named nobody — fixed, and finally shown
**93 of 139 `logAudit` calls recorded no actor. 12,318 of 12,680 rows in production name nobody.**
Files: `apps/{reservation,channel-manager,pms}/lib/mutation-helpers.ts`, `apps/pms/lib/activity.ts`
(new), `apps/pms/app/(protected)/activity/` (new), `Sidebar.tsx`

The helper's own doc comment read *"Every hand-made change is permanent and attributable."* It was
never attributable: **CRS and RevioLink's `logAudit` did not accept a userId at all**, so the column
could not be set from either app. PMS accepted it and 46 call sites passed it; the other 93 did not.

Fixed at the **helper**, not the call sites — `logAudit` resolves the actor from the session itself.
93 edits become 3, and the next call site is correct by default. An explicit `userId` still wins, so
a delegated action attributes to whoever performed it. Wrapped in try/catch: `cookies()` THROWS
outside a request, and the cron jobs and night audit write audit entries too — an unattributed entry
beats a crashed close-day.

**Activity screen** (PMS → Setup → Activity, `manage` only — it shows money, guests and config in
one place). Two things the data forced:
- **95% of entries are channel syncs** (12,037 of 12,680). Hidden by default but **counted**, with a
  link to show them: a filter that silently drops most of the data teaches people to distrust the screen.
- Filtering happens **after** the query, not in it: `take` cannot mean "200 human entries", so a page
  of 200 that is 95% noise comes back nearly empty.
- The screen **says outright** how many entries name nobody and why, rather than showing a column of
  blanks. Everything before today is unattributable and pretending otherwise would be worse.

### 2026-08-31 · Claude · DONE · Bulgaria is on the euro — лв removed from choices and claims
**Confirmed by the founder.** Files: `packages/core/src/registry/tourist-tax.ts`,
`packages/ui/src/welcome-fields.tsx`, `apps/channel-manager/components/settings/*`,
`apps/pms/app/(protected)/{configuration,register}/page.tsx`, three `format.ts`

- **BGN removed from every currency PICKER.** Offering it to a new Bulgarian hotel is a trap they
  would only discover after pricing a season in a currency that no longer circulates. Verified 0
  rows anywhere use BGN before removing it.
- **BGN kept in the symbol maps**, with a comment. A currency stops being offered long before the
  last record denominated in it stops existing, and a historical row must not render as a bare number.
- ⚠️ **The statutory rate band is now asserted NOWHERE.** чл. 61с ал. 1 states 0.20–3.00, written in
  лева. I could not establish from published sources what those became on redenomination — what
  turned up was a *proposal* to raise the ceiling, which is not law. Nothing validated against the
  constants anyway, so they were a claim about the law that no behaviour depended on: the exact
  shape of the fiscalization note that was wrong for a month. Removed from the code and from both
  screens. The hotel enters the rate its own council set.

### 2026-08-31 · Claude · DONE · Silent failures — a mechanism, 29 fixes, and a ratchet
**134 early `return;`s across 82 void server actions. A button pressed, nothing happens, no reason.**
Files: `packages/ui/src/{flash.ts,flash-toast.tsx}` (new), all four protected layouts,
11 `actions-*.ts`, `scripts/silent-lint.mjs` (new), `package.json`
Notes: This is the product's characteristic failure and every real bug this session was a version of
it. A form that silently does nothing is worse than an error: the user concludes the software is
broken and presses the button again.

**Why a cookie and not a return value.** These are `Promise<void>` actions wired straight to
`<form action={…}>` in server components. Converting them means a `useActionState` client component
per call site — 82 of them — which is a rewrite, not a fix. `flashError("…")` needs ONE line inside
the action and nothing at the call site, so the rest can be closed one at a time by whoever next
touches them. Not `httpOnly`: the toast clears itself browser-side, which is the only way to make it
one-shot without a second round trip. Nothing secret goes in it.

Fixed the ones a user actually hits: **every permission refusal** (14 — the worst, since the button
is right there), every **business-rule** refusal (last owner, last super admin, already cancelled),
and every **validation** bail. 134 → **105**.

⚠️ The remaining 105 are mostly "row not found" — a stale tab, or a crafted POST with no user to
talk to. **`scripts/silent-lint.mjs` is a BUDGET, not a gate**, wired into `pnpm verify` beside
copy-lint and authz-lint. The number may fall and may not rise. Not every silent return is a bug —
`prev === status` on a housekeeping room is a real no-op and now says so in a comment.

### 2026-08-31 · Claude · DONE · Register backfill + туристически данък (ЗМДТ чл. 61р–61с)
Files: `packages/db/scripts/backfill-register.ts`, `packages/core/src/registry/tourist-tax.ts`
(20 tests), `apps/pms/lib/{register,config,actions-config}.ts`, `apps/pms/app/(protected)/register/`,
`.../configuration/`, migration `20260831200000_tourist_tax_settings`

**Backfill — in-house stays only, and that is the design decision.** A departed guest cannot be
registered after the fact: they are gone with their document and the entry could never be completed.
Blank rows for them would not be compliance, they would be a permanent visible failure — a register
full of entries nobody can finish reads worse than one that starts the day the property began
keeping it. `registeredAt` is the ACTUAL check-in instant, never today. Ran on production: **22
entries across 14 in-house stays**, numbering verified gap-free and unique **per property**
(21/21, 2/2, 1/1 — each property keeps its own register).

⚠️ **The month's tax was counting the wrong nights, and the backfill is what showed it.** чл. 61с
ал. 2 taxes «броят на **предоставените** нощувки за месеца» — nights PROVIDED in the month. Reading
the register by REGISTRATION date and summing whole stays put a June holiday (registered in August
by the backfill) on the August return, and would have billed a 30 Aug → 2 Sep stay entirely to
August. `nightsInMonth` apportions each stay across the months it actually covered; it is exact and
additive, so what a stay contributes across months sums back to the stay.

**Tourist tax.** The reason it lives beside the register: **чл. 61с ал. 2 has the municipality
assess the month from ЕСТИ data.** The register IS the tax base — a hotel with a wrong register is
assessed on somebody else's numbers.

⚠️ **The 30% floor is ANNUAL, not monthly.** Two secondary sources implied per-month. The statute
(чл. 61с ал. 4–5) measures `ДД = (Р × Л × Д × 30%) − ДП` over the calendar year. Getting this wrong
would bill every closed month of a seasonal property — most of the Bulgarian coast. A test pins it.
`Л` is **легла**, beds, not rooms — seeded from room capacity as a suggestion the hotel confirms.

Three dates encoded: month's tax by the **15th** (ал. 3), declaration by **31 Jan** (чл. 61р ал. 5),
annual top-up by **1 March** (ал. 4). Rate and beds are nullable with **no default** — a default is a
number somebody eventually files as though we knew it.

### 2026-08-31 · Claude · DONE · Register rehearsed end to end on the demo hotel
**Walk-in → two entries → completed one → downloaded the CSV → checked it against the образец.**
Files: `packages/core/src/registry/tourist-register.ts`, `apps/pms/lib/register.ts`,
`apps/pms/app/(protected)/register/page.tsx`, `apps/pms/components/register/GuestRegisterCard.tsx`
Notes: The pipeline is correct — 23 columns in the образец's order, BOM present as raw bytes
(`EF BB BF`), semicolons, Bulgarian dates, `жена` / `Лична карта` / `не`, times in Sofia (21:52 for
an 18:52 UTC walk-in), price split per person. Four findings, all now fixed:

1. **Walk-ins seeded no register at all** — logged separately above. The reason to rehearse.
2. **Етаж exported as "Floor 3"** — English prose into a Bulgarian government form. `floorNumber`
   takes the number where the label has one and passes wordy floors ("Партер") through untouched.
3. **The register rows linked nowhere** while the warning said to open the guest and finish it. The
   instruction was literally unfollowable. Both the number and the name are links now.
4. **The hints assumed a foreigner before citizenship was known** — a "latin" hint sat over a
   Bulgarian guest's name and "required" over a series they do not need.

⚠️ `Response.text()` strips a UTF-8 BOM per spec, so checking for it that way says `false` on a file
that has one. Check `arrayBuffer()`. I nearly "fixed" a bug that did not exist.

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
