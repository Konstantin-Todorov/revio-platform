# Revio — where the project actually is

**Updated 2026-09-22**, at commit `9473a49` — which CI passed and `promote.yml` fast-forwarded onto
`production`, *checked with `git fetch origin production && git log --oneline origin/production -1`;
`main` and `production` are the same commit*.
Every line below names how it was checked. Nothing here is copied forward from another document.

⚠️ **What was re-checked on 2026-09-22 and what was not.** Re-checked today, by query or request:
the deployed commit; **thirteen** scheduled jobs at `operator.reviosoft.app/api/health/jobs`, every
one `ok` and under twelve minutes old; `/login` on all four staff origins and a real booking page on
RevioDirect, all `200`; the full gate — `pnpm verify` EXIT=0, **2,911 tests** across twelve
packages, lint 0 errors at its budget of 25 warnings, `jobs-lint` 13 of 13; `route-walk --app
operator`, 19 of 19 screens healthy; the **state-integrity audit against production**; the error log
and the operator alert feed; every tenant, reservation and invoice count in *The honest commercial
position*; and the Stripe credential state, which turned out to contradict what two other documents
said about it.

**NOT re-checked today:** `route-walk` on the other three apps (it needs them running locally and
only the operator was up); `click-walk`; the three database race harnesses; and any real hotel's
mapping **on Channex**, which needs the Verify button and a human.

⚠️ **Pushing again cancels the previous commit's CI**, so only the newest commit runs to
completion and only it is promoted. `git ls-remote --heads origin production` is the only way to
know what is actually serving — a green "Promote" run for an older commit does not mean that commit
is live, and the promote for the newest one may still be seconds away when you look. Seen again
today: three pushes in one hour left two "Promote to production" runs green while `production` still
pointed at the first of them.

⚠️ **CI failed once today on something that was not ours — and then it was fixed.** `next/font`
could not reach Google while building `apps/pms` (`TypeError: Cannot read properties of null
(reading '1')` inside the Google font loader), CI went red on a commit with nothing wrong in it,
and a re-run went green. The build of all five apps depended on a third party at compile time,
every time, because CI has no Next cache. The fonts are now in the repository — see the 09-22 entry
*The build depended on Google* — and `pnpm build` of all five makes no request to
`fonts.googleapis.com` or `gstatic`.

## Three files, three questions

| | |
| --- | --- |
| **`STATUS.md`** (this one) | What is true right now, and how each claim was checked |
| **`ACTION-REQUIRED.md`** | What is waiting on a person rather than on code |
| **`HANDOFF-2026-09-22.md`** | **What is not settled** — where I am unsure, what I did not check, and what needs reasoning across more of the system than one change should carry |

The third is new on 2026-09-22 and exists because this file has no honest place for *"I believe
this and cannot prove it."* Everything here names how it was checked; anything that cannot be
checked was quietly not written down at all. That is the gap it fills.

## Why this file exists

Status was spread across eight append-only documents — `CLAUDE.md`, `BUILD-PLAN.md`, `GO-LIVE.md`,
`ACTION-REQUIRED.md`, the ideas register and three spec trackers. Nobody can keep eight files in
agreement, so they drifted, and in the first week of September **nine separate claims turned out to
be wrong** — in both directions. Work marked "still open" had shipped weeks earlier; work marked
shipped had never once run.

Three that show the shape of it:

- **Channex production certification** sat on the open list for two weeks. Its own runbook had said
  *"✅ CERTIFIED — production account live"* since 2026-08-24.
- **`book.revio.app`** was carried in five documents as outstanding DNS work. The domain does not
  exist, and `revio.app` was never ours.
- **`trial-sweep`** was declared, scheduled, leased, tested, deployed — and had never run. The cron
  was POSTing into a login page, which answers `200`, so the runner logged `ok` every tick. Found on
  2026-09-07 by reading the job health endpoint *while checking this file*, not by an alarm.
- **The roadmap listed two finished things as outstanding.** Hotel MFA and guest data rights sat in
  "Now · must" on `/platform-history` until 2026-09-22, having shipped on 30 and 29 August. A
  roadmap is the one artefact used to decide what to do next, so two wrong entries make every
  entry a guess. Found by reading the board against the code while updating this file.

### The rule that keeps this file true

1. **A claim here names how it was checked** — a query, a URL, a file. "It should be done" is not a
   status.
2. **The other documents do not restate status.** They hold *reasoning* and *design*; this file holds
   *state*. If they disagree, this file is right and the other is stale.
3. **Check the code before repeating any list**, including the parts you expect somebody else to
   own. Two of the misses above were filed as "external, blocked on the founder" and therefore never
   verified — the rule was applied to the build list and not to the report.

   ⚠️ **This rule kept failing, so it is now enforced.** Five more claims went stale between 13 and
   15 September, every one of them work recorded as open that had already shipped — refunds, the
   cancelled-folio bug, the search dead end, the duplicated surnames, and "the payment-link email is
   not built yet", which sat 130 lines above the button that sends it. A rule that depends on
   somebody remembering is a wish. `pnpm status:lint` checks the ones that cite their code:

       <!-- status: built apps/operator/lib/actions-integrations.ts#emailInvoiceToCustomer -->
       <!-- status: not-built apps/pms/lib/calendar-extend.ts#extendStayByDrag -->

   `built` fails when the symbol is missing; `not-built` fails when it is present, which is the
   direction that actually keeps going wrong. **Cite the code in any new claim here.**

   ⚠️ **The lint has a blind spot, and on 2026-09-22 every stale claim in this file was inside it.**
   It checks claims that cite a symbol. Nothing in it can check a **number or a name**, and those
   are what rotted: *1,945 tests* (2,911), *twelve checks* (seventeen), *nine jobs* then *ten*
   (thirteen), *eight Railway services* (nine), *"all three tenants are demo"* (five tenants, two
   real), and a real client named **Ruse Rentals Tester** that does not exist in production — it is
   *DesManagement 2015*. Every one of them was true when written.

   Two of those now defend themselves: the job count is the number `jobs-lint` asserts, so CI fails
   if they diverge. The rest do not. **A figure in this file is only as fresh as the last time
   somebody ran the query, so write the query beside it.**
4. **A green check is not evidence until you know what it looked at.** `trial-sweep` passed its lint,
   held its lease and returned `200` for its entire life without ever running.
5. **Correct is not the same as usable.** The support thread passed every test and was unreadable.
   The bar every screen is held to is `docs/UI-STANDARD.md`, and the last step in it is "look at the
   rendered page" — which is how both of this week's UI defects were actually found.

---

## Is it live? Yes — all of it

| Product | What it is | Address | State |
| --- | --- | --- | --- |
| **RevioLink** | Channel manager — keeps OTAs in sync | `cm.reviosoft.app` | Live |
| **RevioCRS** | Reservations, rates, guests, analytics | `crs.reviosoft.app` | Live |
| **RevioPMS** | Front desk, housekeeping, folios, invoicing | `pms.reviosoft.app` | Live |
| **RevioDirect** | The hotel's own booking page | `booking.reviosoft.app/<hotel>` | Live |
| **Operator console** | Our internal admin | `operator.reviosoft.app` | Live |
| **Marketing site** | Bilingual since 2026-09-22 | `reviosoft.app` · `/bg/` | Live |
| **Documentation** | | `docs.reviosoft.app` | Live |

*Checked with `railway status`:* **nine** Railway services — the six platform ones
(`channel-manager` · `reservation` · `pms` · `booking` · `operator` · `jobs`), plus
`revio-websites`, `docs` and Postgres. *Checked with `curl`:* all four staff `/login` pages and a
real RevioDirect booking page answer `200`.

⚠️ This table said **eight** services until today. `docs` was added and nothing here noticed.

**2,926 automated tests pass** (`pnpm verify`, twelve packages and apps), plus **eighteen separate
checks** on every change <!-- status: count checks 18 --> — typecheck, lint, and sixteen ratchets that each exist because something
specific went wrong once: copy · authz · layout-guard · status · silent · money · health · a11y ·
scroll-lock · jobs · submit · zoom · tokens · perimeter · dates · drift. CI additionally applies every
migration into an empty database and runs the seed.

⚠️ That paragraph said **1,945 tests and twelve checks**. Both had been true; neither was. The count
is `pnpm verify` output, summed.

**Nine harnesses prove what unit tests cannot — and since 2026-09-23 seven of them run in CI on
every push.** *Checked in GitHub Actions run `35782941281`, step "Races and isolation":* connected
as `revio_app` (superuser=false, bypassrls=false), `rls-verify` 126/126, `claim-verify` 5/5,
`lease-verify` 6/6, `folio-atomic-verify` ✓, `engine-race` 3 of 12 get a room and never oversold,
`confirm-race` **exactly 1 of 12 confirms wins**, `stripe-mode-verify` 8/8.

⚠️ This paragraph used to list five and say "run them by hand before a release". There were nine,
three of them in no document at all, and "by hand" had come to mean not at all — while CI built a
migrated, seeded Postgres on every push and threw it away unused.

The two that need the apps **running** are still by hand, and both passed on 2026-09-23:

```
pnpm --filter @revio/operator webhook-verify   # forged, mismatched, replayed and refunded Stripe events
pnpm --filter @revio/db handoff-verify         # a hand-off token opens one product once, and only that one
```

Every harness that writes refuses a non-local database, and `webhook-verify` refuses a non-local
console, because it sends forged Stripe events and `OPERATOR_URL` is a real Railway variable.
`rls-verify` is the deliberate exception: DEPLOY.md runs it against production as the restricted
role.

**Channex is certified and connected** — certified 2026-08-24, key in place 08-26. *Checked by query
2026-09-22:* two channels in `channex_prod` mode. ⚠️ **One of them is broken and has been since at
least 20 September**: Ventsi Group's reads `catalogueStatus = property_missing` — it points at a
property Channex has deleted. The other, DesManagement 2015's, reads `ok` and last synced today.
Hotel Sofia Group's is `channex_sandbox`, a different account, and is not billed.

**All THIRTEEN scheduled jobs run.** <!-- status: count jobs 13 --> *Checked at `/api/health/jobs` on 2026-09-22, every one `ok`
and between 201 and 717 seconds old:* `hold-expiry` · `pickup-snapshot` · `channex-pull` ·
`arrivals-digest` · `auto-assign` · `auto-close-day` · `waitlist-sweep` · `trial-sweep` ·
`support-inbox` · `mapping-audit` · `invoice-run` · `operator-alerts` · `demo-refresh`.

⚠️ This said **nine**, then **ten**. Four jobs were added and the number was never moved. It is now
the same number `jobs-lint` asserts, so the two cannot drift apart again without CI failing.

---

## The honest commercial position

This is the part most likely to be misread from the engineering documents, so it is stated plainly.
*Every figure below was queried against production on 2026-09-22.*

**There is no revenue yet. But a real hotel is now on the platform, and bookings have arrived
through it.** That is a change of state since this file last said "no hotel is operating on the
platform yet", and it happened on 12 September without this page noticing.

| | |
| --- | --- |
| Real (non-demo) accounts | **2** — *DesManagement 2015* and *Ventsi Group* |
| Of those, active | **1** (Ventsi Group is suspended) |
| Reservations taken by a real client | **3** — all through their live Channex channel, all `acked` |
| Rooms configured by a real client | **41 units across 3 room types** |
| Invoices issued to a real client | **0** — one draft of €89.68 exists and has never been sent |
| Collected | **€0** |
| Monthly recurring revenue | **€0** |

⚠️ **The previous version of this table named *Ruse Rentals Tester* as one of the two real
accounts.** There is no such tenant in production. It is *DesManagement 2015*, joined 09-09,
billing from 09-12, on `starter`, entitled to all three products and not on a trial.

The three real reservations came in on 12, 13 and 15 September — €6.00, €3.00 and €3.60, the first
two named "Channel Manager Test" and the third a real guest name. They are small because they are
connectivity proofs, not business. **What they demonstrate is the thing the platform is for:** a
booking made at an OTA reached a hotel's system through Channex and was acknowledged, with no
integration step performed by anyone.

There are **three** demo tenants — Hotel Sofia Group, Black Sea Resort and Belmar Boutique Hotel.
All seven other invoices in the system belong to them (four draft, three paid, €1,112.20 in total).
They are real invoices against real pricing, which is how the billing flow stays tested, but they
are not income.

The demo hotels are where the volume is: **128 units, 75 reservations, 25 guests, 15 room types, 10
connected channels**. That is what a prospect sees in a demonstration, and it is genuine data on the
real system — not a mock-up.

**What this means:** the software is finished and proven, and the first real connection works. The
next constraint is a hotel that *runs its business* on it, not a feature.

### Can we take money? Yes — and it is switched off on purpose

⚠️ **This is the entry most recently wrong, in both directions, and it took three queries to settle.
`ACTION-REQUIRED.md` §2b said two things this morning that are not true, and this file repeated the
consequence.** What is actually the case, *checked against `PlatformCredential` and
`OperatorCompany` in production on 2026-09-22*:

- A **live** Stripe restricted key is stored and was last tested **OK at 13:01 today**. Stripe
  answers `chargesEnabled: true`, `payoutsEnabled: true`, `detailsSubmitted: true`,
  `defaultCurrency: EUR`, country `BG`, account `acct_1UE4yvFdkWSHYoRn`.
- The console is set to **`stripeMode = test`**. That is a **stored choice**, not a missing key —
  `activeStripeMode` reads it from `OperatorCompany` precisely so that pasting a live key in order
  to check the connection cannot silently start charging real cards. It used to be inferred from
  whether a live key worked, which did exactly that.

So **charging a real client's card is one switch away**, and the switch is deliberate: the standing
constraint in `docs/PMS-ROUND2-STATUS.md` is test-mode only until somebody decides otherwise.

§2b's two claimed blockers, and why each was wrong:

1. *"No live key is deployed anywhere."* It was reading **Railway environment variables**, where
   only `pms` carries Stripe keys and both are test. The operator does not use environment
   variables for this at all — it reads the encrypted `PlatformCredential` row, and that row holds
   a working live key. Two stores, one of them checked.
2. *"The account's default currency is `usd`."* It queried the **test** account,
   `acct_1TrN0uC9R6il3Bgk`. The live account is a different account id and its default currency is
   **EUR**. A sandbox account's currency says nothing about the business.

**What genuinely cannot happen today** is a *guest* paying by card. `apps/booking` — the app that
takes a guest's card — carries **no Stripe variables at all**, and `apps/pms` has test keys only.
*Checked with `railway variables --service <each>`.* That is a different promise from Revio
invoicing its own clients, and only the second one is ready.

---

## What is being worked on

### In progress

**Nothing is half-built.** *Checked with `git status` — the tree is clean, and `main` and
`production` are the same commit.* The two items this section named as Codex's uncommitted work
both shipped: the city-tax VAT base in `f828cac` on 09-09, and the operator sidebar in `7e70a38`
the same day.

### Shipped 2026-09-23 — the front desk could turn one hold into twelve reservations

**Measured, not argued.** `apps/reservation/scripts/crs-confirm-race.ts` raced the front desk's
"confirm this hold" twelve times at once, against the real function, before any fix: **12 of 12
won — twelve reservations, one hold, one room.** The guest's booking page had exactly this defect,
found it, fixed it and wrote the fix down in `packages/booking/src/public-engine.ts`; the staff path
in RevioCRS is different code and still converted the hold unconditionally, after the reservation,
outside any transaction. Same fix applied: the conversion is the claim (`UPDATE … WHERE status =
'active'`), in the same transaction as the reservation, and a loser rolls back whole. After: **1 of
12, eleven refused, one guest row** — three runs. The race now runs in CI.
<!-- status: built apps/reservation/lib/convert-hold.ts#convertHoldToReservation -->

**And a second press was a second guest.** Production held one instance: the demo hotel checked
"Maria Ivanova" in twice on 9 September, 1.2 s apart, rooms 101 and 102, two folios. Nothing raced —
the walk-in button was a plain submit, the action is slow, and people press again. The shared
`SubmitButton` that disables itself while working existed and was on **8 of 211 forms**. It is now on
the 43 that create, post, issue or charge — the folio's *record payment*, *post charge* and *issue
invoice* among them. Proved on the rendered folio: two presses 150 ms apart, **one** €12.34 payment.
`submit-lint` keeps it that way.

⚠️ **What that does not cover, stated plainly:** two tabs, a network retry, or a press before React
has hydrated. Measured: pressed in the first moment of a cold load, two walk-ins still went through.
That needs an idempotency key on the server — `HANDOFF` item 2.

### Shipped 2026-09-23 — twelve different guests could be put in one room

Every path that puts a stay into a physical room — auto-assignment, check-in, walk-in, room move —
checked "is anybody in this room?" and then wrote. Auto-assignment did it inside a transaction and
said so in a comment: *"the difference between a fast placement and two guests behind one door."* A
transaction does not make check-then-write safe; under READ COMMITTED two of them both count zero.
`apps/pms/scripts/unit-claim-race.ts`, twelve distinct reservations claiming one room with a warm
connection pool: **twelve active assignments for one room**, three runs of three.

⚠️ **The first run of that harness said the opposite — 1 of 12 — against code with no lock at all.**
Twelve cold transactions each opened a new connection, which takes long enough that the first had
committed before the others counted. The harness was slow, not the code safe. It now warms the pool
first, and so do `crs-confirm-race` and `ooo-race`, which were re-run warm: both fixes hold.

`claimUnitForStay` (`apps/pms/lib/claim-unit.ts`) locks the unit row with `SELECT … FOR UPDATE`, then
counts, then writes — the same row the out-of-order write locks, so a room cannot be assigned and
taken out of service at the same instant. All four paths use it; only tests write assignments
directly now. Walk-in's guest, reservation and room are one transaction, and a multi-room check-in is
all or nothing. Walked on the rendered pages: a walk-in lands complete, a move retires the old room
only after the new one is claimed. After: **1 of 12**, three runs, warm. In CI.
<!-- status: built apps/pms/lib/claim-unit.ts#claimUnitForStay -->

### Shipped 2026-09-23 — one broken room took six rooms off sale

`apps/pms/scripts/ooo-race.ts` marked one room out of order twelve times at once: **six periods —
six rooms off sale on every channel for one broken room.** Two copies of this write existed: the
maintenance one counted existing periods before creating (count-then-create, so racers all count
zero), and the housekeeping board carried its own inline copy with no count at all, under a comment
in the shared file claiming it was "shared by the housekeeping board". Neither was a transaction,
so a failure between the status and the period could leave a room reading "out of order" while
channels sold it — or, coming back, "clean" and off sale for ever.

Now one core, `apps/pms/lib/unit-ooo.ts`, in a transaction that updates the **unit row first** so a
second caller waits on it and then sees the first one's period. Both paths call it. After: **1 of
12**, and twelve concurrent "back in service" leave no period and report the freed dates once.
Production checked first: no unit carried a duplicate period, and none disagreed with its status.
<!-- status: built apps/pms/lib/unit-ooo.ts#takeUnitOutOfOrder -->

### Shipped 2026-09-23 — one lease policy, and six jobs that told the health check they had succeeded

Founder's decision, applied to all thirteen: `withJobLease`, releasing on failure. Doing it found
that six routes released in a `finally` that stamped `lastRunAt` even when the run threw — and the
dead-man's switch reads `lastRunAt`, so a job failing on every tick would have read "ok" for ever.
One of them was the operator alerts job, the one that watches the others. *Checked in production:
the 05:00 tick after the deploy ran 13/13.*

### Shipped 2026-09-22 — the build depended on Google, and fixing it broke the font

`next/font/google` self-hosts the bytes it ships, so **runtime** was never the issue. It fetches
them at **build** time, on every build, and CI has no Next cache. That is why a Google hiccup this
morning turned a clean commit into a red CI and stopped `production` where it was. The variable
woff2 for each family is now committed; `node scripts/fetch-fonts.mjs` refreshes them.

⚠️ **The switch to `next/font/local` broke the font on four apps and compiled perfectly.** The
Google loader registers the family under its real name; the local loader names it after the JS
binding. Each staff app's `globals.css` carried a hardcoded `--font-hanken: "Hanken Grotesk", …`
that beat the class `next/font` puts on `<html>` — and matched only because of that coincidence.
The moment the bytes came from a local file, four apps fell back to the system sans. **Typecheck,
2,911 tests and seventeen lints all passed on it.** The only thing that saw it was reading the
computed style on a rendered page, which is the last step in `docs/UI-STANDARD.md` and the reason
it is written down.

*Checked by measurement, not by looking:* the same string at 40px is **500.41px wide on production
and 500.41px locally** for Hanken; 538.64 on both for Plus Jakarta at weight 400; 385.2 on both for
Instrument Serif, against 474.41 for the browser's generic serif. The variable file gives five
distinct widths across 400–800, which is what had to be true when one file replaced five.

### Shipped 2026-09-22 — the error log stopped being mostly weather

Four of the five unresolved rows in the production error log were not faults. They were Next's
`Failed to find Server Action`, filed once per app every time a deploy replaced the build under
somebody's open tab. The page had claimed since it was built that this was not recorded; no code
ever made that true. `isDeployMismatch` now drops the class **at the recorder**, so all ten call
sites are covered by one gate rather than each remembering.

⚠️ **Dropped from the table, not from the record.** It still goes to the container log, because
there is one reading under which it is a real fault — if it keeps arriving long after a deploy has
settled, two instances are serving different builds — and only a log line carries the deploy stamp
that separates the two readings. *Checked: 17 tests, deliberately weighted toward proving the
filter does NOT match; a bare "Failed to fetch", a plain chunk 404 and "Server Action failed: folio
is already closed" all still file.*

**And six job routes that could not say they had failed.** Five were given a `catch` on 09-22
morning; the remaining six answered a bare 500 with an empty body, so `run-jobs` logged
`HTTP 500 in 10166ms · ` and nothing after the separator. All thirteen now report. `jobs-lint`
fails a job route with no `catch`, which is how the seventh — `demo-refresh` — was found: a grep
for "catch" had matched the word in a comment.
<!-- status: built packages/db/src/app-errors.ts#isDeployMismatch -->

*Production error log, checked 2026-09-22: **2 unresolved**, both transient infrastructure — a
Postgres restart that hit `auto-close-day` at 06:51 and a mailbox disconnect on 09-18. Neither has
recurred; the close-day job ran normally at 18:10 the same day.*

### Shipped 2026-09-22 — two alerts on one mapping, saying opposite things

DesManagement 2015 carried both of these from 20 September:

```
act   Apartment, 2 Bedrooms · Standard Rate is publishing to the wrong room on Channex
soon  "Standard Rate" is switched off but still mapped on Channex
```

They are the same row, and the second is right — it says in as many words *"nothing is published
for it"*. The first says prices are going to the wrong room right now, and the client page repeated
it in red beside a claim that every push succeeds. Both halves are false: `syncChannel` has filtered
on `ratePlan.active` since 09-17.

The filter belongs in `crossWiredFromRecord`, which carries the rule in its own doc comment — *"a
false accusation on a console somebody reads before phoning a customer costs more than a missed
one"* — rather than in a query one caller remembers. `active` is a **required** field on
`RecordedMapping`, and that is what made the compiler name all three call sites; a grep had found
two. *Checked: the alert resolved itself in production within ten minutes of the deploy, by the
alerts job running the fixed code.*
<!-- status: built packages/core/src/connectivity/cross-wired.ts#crossWiredFromRecord -->

### Shipped 2026-09-22 — Google's numbers, and whether products get opened

`operator.reviosoft.app/website` answers eleven Google Analytics and Search Console queries without
anybody signing into Google — traffic split by source, landing pages, search queries and pages split
two ways, and the calls to action the marketing site was already collecting and nobody was reading.
Service-account JWT signed with `node:crypto`; no `googleapis` dependency.

⚠️ **The private key is the one value that does not pass through a transcript.** It is pasted by the
founder into a Railway variable. The screen names the two ways it is usually pasted wrong — a key
ID instead of a key, and a JSON blob instead of a PEM — because both happened.

**Product analytics gained the question it was missing.** It could say whether anybody was there and
which screens were worth building; it could not say whether a product a hotel is *entitled to* ever
gets opened. `apps/operator/lib/adoption.ts` answers that per product: entitled → opened in 30 days
→ opened in 7 → screens reached → entitled and never opened. The denominator is **entitlement, not
the invoice**, because a trial nobody opens is the most useful thing to know before it ends.
<!-- status: built apps/operator/lib/adoption.ts#getAdoption -->

**Sitemap `lastmod`.** Search Console reported 31 indexed and **27 "Discovered – currently not
indexed"**, almost all of them the new Bulgarian pages. The sitemap carried no `lastmod` — the one
field Google says it uses. `changefreq` and `priority` are still deliberately absent.

### Shipped 2026-09-22 — a failed job stopped reporting success

A job whose work threw kept its lease. A held lease answers `{ ok: true, skipped: … }`, so every
tick for the rest of the TTL reported success and did nothing. One failure silently suppressed the
job and told the runner it was fine — which is how a 500 at 09:51 became silence. `withJobLease`
releases on both paths.

⚠️ **The lease policy itself was NOT changed, deliberately.** Four of the five other job routes
state in their own comments that a failed run should wait out its TTL rather than retry on the next
tick. That is a decision, and it is not one to reverse while fixing something else. The
contradiction is recorded in `ACTION-REQUIRED.md` §2d and is on the roadmap as *A failed job reaches
a person*.

### Shipped 2026-09-22 — the marketing site is bilingual

`reviosoft.app` serves 21 paths in Bulgarian under `/bg/`, plus `/search`, `/login` and a localised
404. hreflang reciprocity and canonical self-reference verified page by page; the sitemap carries
both locales. Fonts are self-hosted, which removed the last third-party call before consent —
Inter for Latin, Source Sans 3 for Cyrillic, because Inter has no Bulgarian `locl` forms.

⚠️ **The products are still English-only**, which is the wrong way round: a site is read once and a
front desk is used every shift. On the roadmap as *The staff products in the hotel's own language*.

### Shipped 2026-09-17 — the first real hotel's connectivity, and what hid behind it

The largest single day in the project by commit count (about thirty), and nearly all of it was
things that were failing silently on a real client.

- **Channex calls us instead of being polled** 288 times a day — and the ring is not trusted: the
  webhook triggers a pull rather than carrying the payload.
- **What Channex did with a push is read back**, from its own task log, instead of us recording what
  we sent and calling that success.
- **A cancellation releases the room on every path there is** — CRS, channel manager and OTA pull
  each had their own cancel and none of them released the assignment.
- **A booking we cannot import now sends mail.** It had been silent, and a real client's booking had
  been lost for two days with nothing saying so.
- **"Pulled 0 revisions · success", every five minutes, against a property Channex had deleted.**
  A filter on an id that does not exist is not an error, which is why nothing noticed for weeks.
- **A rate plan switched off went on pushing for ever**, publishing one room against another.

### Shipped 2026-09-16 — one sign-in opens every product the hotel bought

Central login replaced four separate doors; the login page was rebuilt as the first impression it
is; one Dialog primitive replaced the hand-rolled copies. Building it exposed that **the second
product's onboarding had been written, tested and was unreachable**, and that switching products
sent hotels to `localhost`.

### Shipped 2026-09-15 — something that opens every screen, and something that presses things

`route-walk` opens **90 screens** <!-- status: count screens 90 --> with a real session — 21 RevioLink, 24 RevioCRS, 26 RevioPMS, 19
Operator — and asserts not merely a 200 but that the page is not one of our own failure screens.
`click-walk` is the other half: a real browser pressing things. See the section at the foot of this
file for why a 200 is not success, and for the three times each has been proven to fail.

### ⌘K and the notification centre — shipped 2026-09-14, all four products

The founder asked for two things, for every product, scoped per software and per client, **without
moving anything's position**. Both are live at `c641c3e`.

**⌘K / Ctrl K.** The topbar form that posted to `/search` is now a palette: results as you type,
Enter opens the first one. `/search` stays — it is still the right screen for "show me everything",
and Enter on nothing still goes there. The ranking is shared (`packages/core/src/search/hits.ts`,
19 tests) because "which result is best" is not a per-product opinion; what each product *searches*
is entirely its own. It groups before it scores, so the list keeps its shape between keystrokes.

**The notification centre.** Four byte-identical copies of `NotificationBell` became one shared
panel with two halves that are deliberately different things: **needs attention** (derived state,
self-healing, no read marks — the old bell, unchanged) and **what happened** (events, with a time,
read/unread and a history). Only events carry the unread count, because an unread badge on a derived
state either ignores being read or hides a problem that is still happening. Nothing writes a
notification row: the feed is derived from what the platform already records, so it cannot drift from
the screens it links to, and the history exists from day one. Read state is two columns on the
account row (migration `20260914060000_notification_read_state`), applied in production — all four
`/api/health` endpoints report `state: ok` with the database reachable, and `prisma migrate deploy`
runs in each service's start command, so a failed migration would have stopped the service booting.

### ⚠️ The security holes both of those uncovered — closed 2026-09-14

The founder asked the question that found them: *"a housekeeper tried to search something and it
pops something from the admin point of view and somehow she can bridge the system."*

**Roles did not scope reads at all in RevioLink or RevioCRS.** Accounts are one shared identity —
that is the platform's central claim — so a housekeeper created in RevioPMS authenticates against
RevioCRS perfectly well, and neither app filtered a single screen by role. Every guest, every rate,
every booking was readable by an account whose job is cleaning rooms. **RLS never covered this and
could not**: a housekeeper and an owner at one hotel are the same tenant, so the database hands them
identical rows. Only the role can tell them apart.

It ran the other way too. `roleAllowsPath` in RevioPMS ended `if (!allowed) return true`, so a role
it had never heard of was treated as a manager — a `revenue_manager` opened folios, guest identity
documents and Close Day.

`roleCanOpenProduct` in `@revio/core` (default-deny, `auth/read-scope.ts`) closes both directions,
and search and notifications are both filtered by it plus the product's own screen rule. Proven live
rather than only in tests: a housekeeper searching "mar" gets nothing and "10" gets her rooms; an
owner searching "mar" gets both bookings; her notification panel shows "16 rooms to clean" and not
the hotel's open balance.

**⚠️ And a deeper one: a layout that RETURNS a refusal is not a refusal.** In the App Router the page
segment renders independently of what the layout returns — dropping `{children}` changes the HTML,
and Next executes the page anyway and streams it into the RSC payload. Measured twice on RevioPMS
with the real database: a role-refused response was **208 KB containing a real guest's name**, and an
entitlement-refused one (which is how `ProductLocked` had always worked in all three hotel apps) was
**211 KB with the same**. A hotel that never bought RevioPMS was being served RevioPMS's data behind
a screen saying it had not subscribed. Both are now `redirect()` — which throws, and so actually
stops the render — to their own routes outside `(protected)`; the responses fell to 35 KB and 42 KB
with nothing of the hotel's book in them. `pnpm layout:lint` fails on the pattern and is in `verify`.


### The invoice job — alarmed, then cleared, and the alarm was mine

`invoice-run` read `never` at 16:48 local, while every other job the cron runner drives had run
within three minutes. I concluded the Railway cron service was executing an older copy of
`scripts/run-jobs.mjs` and wrote that down as needing a person.

**It was not.** At 16:56, after `production` moved to `b64c517`, the same endpoint reads
`invoice-run: ok · 374s`. The runner had simply not finished redeploying when I looked — the job
was mid-deploy, not missing.

⚠️ **The lesson is about the check, not the job.** "Declared but never run" is a real and repeated
failure here (`trial-sweep` POSTing into a login page; the waitlist sweep shipped and never run), so
the reflex to shout was right. What was wrong was shouting **inside a deploy window**: a job added
in the same push that is still rolling out will read `never` for several minutes, and that is
indistinguishable from the real fault at a single point in time. **Read it twice, minutes apart,
before calling it.** The same rule already applies to `production` on this page — a promote race
gave two different answers two minutes apart earlier the same afternoon.

*(All jobs were `ok` at 16:56 local on 2026-09-13. The current count and state are at the top of
this file — there were ten then and there are thirteen now.)*

### Shipped 2026-09-13 — the self-serve path, end to end

Eight bugs from Ventsislav's 13 September log (BUG-015…022) plus §4 Mapping and §5 Bulk, then the
trial and billing work the founder asked for. Named here because this is the block that decides
whether clients can be told to set themselves up.

- **§5 — one room-first rate-plan tree**, shared by RevioLink and RevioCRS (`@revio/ui/plan-tree`).
  Two independent lists could not say which plan belonged to which room, which is what produced
  BUG-022. *Checked: 2546 tests, both apps build, panel rendered and read.*
- **Three faults found while wiring it, none in any log.** RevioCRS never consulted
  `ratePlanRoomType`, so a plan attached to one room had its price written on another; a room with
  no tickable plan would have become unselectable while allocation and restrictions are written per
  room type (`ROOM_ONLY`); and the calendar fed `new Date().toISOString()` to the bulk modal's date
  bounds, offering an edit starting yesterday between midnight and 03:00 local.
- **⚠️ The Day 31 promise was not built.** `signIn` refused an account whose entitlement was off, so
  the ended-trial screen — end date, *nothing has been deleted*, **I want to keep it** — was
  reachable only by a hotel still holding a cookie from before the sweep. Opening that door required
  the entitlement asked in `authz.ts` before every write, where a layout cannot be bypassed by
  replaying a server action; RevioPMS had always asked, RevioLink and RevioCRS never had.
  *Checked: `authz.test.ts` in both apps, run with the guard deleted to watch them fail.*
- **The joining month is prorated** (`packages/core/src/billing/proration.ts`). A trial converted on
  the 29th used to bill all 30 days. This is the SiteMinder / Little Hotelier shape — calendar-month
  invoicing with the post-trial remainder prorated — and it makes "you pay from the day you decide"
  true. *Checked: 25 tests, two exhaustive.*
- **One trial, one email.** The sweep sent per `ProductTrial` row, so a hotel got nine emails where
  it should get three. Batched per hotel; the per-product state machine is untouched.
- **The invoice run is scheduled**, not a button — a month nobody pressed it in was never invoiced.
  *Checked at the time: `jobs-lint` 10 of 10 — it is 13 of 13 today — and authz-lint caught the
  first attempt exposing it as a public server action.*
- **An enquiry can be sent a free trial** from the `/leads` queue — a link to the ordinary public
  signup, never an account.
- **A room added after Connect can reach Channex** (`channex-catchup`). Provisioning is one-shot, so
  nothing in the product could send it; the Mapping screen described the problem and offered nothing
  to press. Read-before-create, and the 401 trap handled where it would have cost a duplicate.

### Shipped 2026-09-09 · part 3 — a hotel can pay an invoice by card

`/invoice/[id]` now offers **Create payment link**: a Stripe-hosted Checkout page for the gross
amount, carrying our own invoice number. No card detail reaches Revio.

⚠️ **A redirect is not evidence.** The invoice is marked paid by Stripe telling us so over a webhook
— never by the customer's browser reaching a thank-you page, which anyone can open without paying
and which a customer who pays and closes the tab never reaches. `/paid` is deliberately static.

That webhook is the most security-sensitive route here: public, and it settles bills. Raw bytes →
verify → parse; a five-minute replay tolerance; constant-time comparison; and **which mode signed is
decided by which secret verified**, never by the body's own claim. `pnpm --filter @revio/operator
webhook-verify` fires real HTTP at it and checks the database — forged, unsigned, stale, genuine,
replayed, wrong-amount. *Verified by removing the signature check and watching a forged request mark
the invoice paid*, then putting it back.

`middleware.ts` gained `api/webhooks`, the same class as the `api/jobs` miss that let `trial-sweep`
POST into the login page for its whole life.

### Shipped 2026-09-09 · parts 1–2 — payments plumbing, and a VAT defect that would have overcharged every Bulgarian client

**`/integrations`** — every connection the platform depends on, in one list, because three of the four
fail *silently*: a rolled Stripe key, an unset `RESEND_API_KEY` and an unread mailbox all look
exactly like a quiet day. **`/integrations/stripe`** holds our own Stripe account: keys pasted in the
console rather than into a Railway variable or the database, encrypted at rest, **tested before they
are stored**, and never readable back. Both modes are shown side by side rather than behind a switch,
because test and live are different accounts whose data cannot see each other.

⚠️ **Mode is chosen by a person and checked against the key, never inferred from it.** Stripe puts the
mode in the prefix, so inferring is trivial — and that is the trap: a live key pasted into the field
you believe is sandbox charges real cards while you rehearse. Refused in both directions.

⚠️ **The VAT defect.** `decideVat` read "has a VAT number" as "registered" and charged 20%. We hold
`BG205090014` under **чл. 97а ЗДДС** — valid only for cross-border services — under which we may
**not state VAT on a Bulgarian invoice at all** (чл. 113, ал. 9). Every domestic invoice would have
carried 20% we are prohibited from charging. **Zero had been issued to a real client**, which is the
only reason this was a defect and not a credit note and an apology. Five tests go red on the old
line. Also added: a monitor for the чл. 96 threshold (EUR 51,130 of *domestic* turnover in a
*calendar* year, seven days to apply) on Settings → Company details.

*Checked against production:* migration applied 00:46 UTC, `vatRegistration = art97a`,
`PlatformCredential` empty and waiting for a key.

### Shipped 2026-09-08 — an external review, and all four release blockers closed

An outside reviewer (Codex) read the codebase and filed five findings. **All five were confirmed by
reading the code; all five are now fixed and deployed.** The register of verdicts, effort and division
of work is `docs/REVIEW-RESPONSE-2026-09-08.md`.

| | What was wrong | Now |
| --- | --- | --- |
| **R1** | **One hold could become many reservations.** A guest who reaches Confirm already holding a room skips `claimHold` — correctly, they own the room — so nothing atomic stood between reading the hold and writing the reservation, and the conversion's affected count was thrown away | The conversion **is** the claim: reservation and conversion in one transaction, count checked, loser rolled back. Raced on a real database: **twelve concurrent confirms of one hold produced twelve reservations before the fix, one after** |
| **R2** | Starting a 2FA setup turned off the factor you already had, so a half-finished enrolment left an account less protected than before it began | The pending secret is held separately; the live factor is untouched until the new one is proven |
| **R3** | Close Day could close a different day than the one the operator was looking at | The caller states the date it meant; a stale intent is refused in words |
| **R4** | A failure part-way through Close Day could strand a night — date moved, charges not posted | One transaction; a failure leaves a recoverable state |
| **R5** | A one-time code could be replayed inside its own step | The step that actually matched is the one consumed, atomically |

Also shipped that day: the **client page as three tabs** (Overview · Products & setup · Billing, with
what needs attention pinned above them), the **support queue as scannable rows** rather than a stack
of full conversations — *"it's hard to know when there are many hotels asking"* — and two documents
that are assessments rather than code: `docs/COMPETITIVE-GAPS-2026-09.md` and
`docs/PLAN-2026-09-09.md` (Stripe model, integration centre, Bulgarian VAT with sources).

### Shipped since this file was last written (13 commits, 2026-09-07)

| | What it does |
| --- | --- |
| **Help centre** | *Get help* in every product's account menu, with 16 articles suggested by the screen you are on |
| **Support queue** | Requests recorded and emailed, sorted by **how late against the window we promised** — 2 hours for *guests affected now*, one working day for a problem, two for a question. No 24/7 claim anywhere |
| **Ticket threading** | A support request is now a conversation both sides can read: reply from the operator console, the hotel sees the thread in its own product |
| **Phone, email and meetings** | The queue records requests that did not arrive by typing, so it is not a picture of only the customers who use the form |
| **Error log** | Application faults with descriptions, grouped rather than one row per occurrence |
| **Trials** | A 30-day trial granted from the client page, warned at seven days and one, stopped automatically, never a surprise charge |
| **Demo-request acknowledgements** | The website now emails the prospect back, and the operator can see which prospects never heard from us |
| **Onboarding fix** | A hotel buying two products at once was sent backwards one screen per step — see gap class 21 |
| **First-operator bootstrap** | A fresh install could not create the account needed to log in and create anything |
| **Job reachability** | `trial-sweep` had never run; the runner now requires JSON evidence rather than a status code, and `jobs-lint` guards the middleware exemption |
| **One Settings shape** | All four products use one `SettingsNav` from `@revio/ui` — sections down the side, `/settings` redirecting to the first, Help listed among them. It also corrected 24 `revalidatePath("/settings")` calls that had been pointing at a redirect stub, 14 of them wrong since the RevioCRS split |
| **Two checks for the first client** | CI now applies every migration from empty and runs the seed (both were broken this week and nothing saw it); `tokens-lint` catches a Tailwind colour class that resolves to nothing — it found an invisible status dot on the housekeeping board and an unstyled demo badge, both pre-existing |
| **Inbound email** | A customer who presses reply now lands in the ticket thread, and the case reopens. Reads `support@reviosoft.app` over IMAP from the cron, never modifying the mailbox. **Inert until its three variables are set on the operator service — DEPLOY.md, "The support mailbox"** |
| **Product analytics** | `operator.reviosoft.app/analytics` — active people week on week, which screens are used, which are barely touched, and per hotel: who has gone quiet and **which products they are billed for and have never opened**. First-party, not PostHog: no third-party processor to name in a hotel's contract, and it reconciles against the same database as everything else |
| **Jobs on Platform Health** | Every scheduled job, its state and when it last succeeded, on the screen a person opens — `never` shown as loudly as `stale`. The last two items of `docs/OPERATOR-REVIEW-2026-09.md` are now closed |
| **RevioDirect in the operator** | Bookings, revenue, our 2% and commission avoided on the client page, all four scoped to bookings the engine itself produced |
| **Help tabs** | Help · Your requests, with the open count on the tab, so a waiting hotel sees it without scrolling and the page's furniture stops moving |
| **Support round 2** | A hotel can now reply to our reply, which reopens the case; the lateness clock measures the current turn rather than the age of the thread; one card shows a case whether waiting or answered; tabs and a linkable `/support/[id]`; open requests lead the help page instead of trailing sixteen articles |

### Ready to build, in the order I would do them

⚠️ **This table is no longer the roadmap.** The roadmap lives on `operator.reviosoft.app/platform-history`
(`apps/operator/lib/platform-history.ts`) with a Now / Next / Later shape and a rule that adding a
Now item means moving one out. **It had been a month stale and two of its seven "Now · must" items
had already shipped** — hotel MFA on 08-30 and guest data rights on 08-29 — which was corrected on
2026-09-22. What stays here is the reasoning behind rows this file already argued about.
<!-- status: built apps/operator/lib/platform-history.ts#PLATFORM_ROADMAP -->

| | Why | Effort |
| --- | --- | --- |
| **Onboard one real hotel end to end** | ⏳ **Half true now.** DesManagement 2015 is connected, has 41 units configured and has taken three bookings through Channex. What has NOT happened is a hotel running its business on it for a week. Everything below is still guesswork until that does | — |
| ~~**Send the payment link**~~ ✅ | Built and shipped in `b1437da`. The invoice emails itself: `emailInvoiceToCustomer` looks up the client's billing address, attaches the document, includes the card link when one is live and the IBAN when it is not, and **refuses a draft outright** — an email about a number that can still change is worse than no email. This row said "not built yet" for days, and so did a comment 130 lines above the Send button. <!-- status: built apps/operator/lib/actions-integrations.ts#emailInvoiceToCustomer --> | — |
| ~~**Refunds**~~ ✅ · **recurring** ⏳ | Refunds and disputes ARE handled — the Stripe webhook records `refundedMinor`, `refundedAt` and `disputeStatus` beside a status that deliberately never moves off "paid", because the supply and the payment both still happened. What remains is **recurring**: every month is still an invoice somebody generates and sends. Stripe Subscriptions would automate it, but that is a pricing-model decision before it is a build. <!-- status: built apps/operator/app/api/webhooks/stripe/route.ts#POST --> | Medium |
| **Use the new menu for a week** | ✅ Built on the fourth attempt — icon rail → vertical section panel → horizontal tabs only inside a page, from the founder's own reference. Nothing left to build; what is left is finding out whether the grouping survives daily use. The four rejected shapes and why are in `apps/operator/CLAUDE.md` so a fifth does not repeat them | — |
| ~~**Client analytics**~~ ✅ | Shipped 2026-09-15. Twelve months of billed-vs-paid and their bookings on one shared axis, plus MRR movement in the header. **The health score was deliberately not built**: `clientAttention` and `accountAttention` already derive what needs a call and how soon, and a third scoring system is a second opinion on one question — the copy that drifts is always the permissive one. <!-- status: built apps/operator/lib/client-trend.ts#alignSeries --> | — |
| **Hotel's own Stripe keys** | The model is settled (their account, not Connect — we never touch the money) and designed in `docs/PLAN-2026-09-09.md` §1. It follows ours rather than leading it, and it reuses the `PlatformCredential` shape wholesale — the encryption, the mode validation and the test-before-store are already built and tested | Medium |
| **In-app AI assistant** | The biggest differentiator and the least urgent. Founder's framing: future context, not a task. Waiting for a real support queue to learn from | Large |

### Known gaps against competitors

`docs/COMPETITIVE-GAPS-2026-09.md` — RevioDirect measured against what SiteMinder, Cloudbeds and Mews
actually ship, plus the platform read as a hotel owner rather than as a feature list. Checked against
the code, not the documents. The four that matter most: **no analytics on the booking page at all**
(so an owner cannot see or advertise their own funnel), **no abandoned-booking recovery** (the data is
already captured and thrown away), **one language and one currency**, and **we still cannot take
money**.

⚠️ Two of those four moved on 2026-09-22 and the file has not been re-measured since. *Language*:
the marketing site is bilingual, but the guest-facing booking page and all three staff products
are still English-only, so the gap stands where it matters. *Money*: Revio can now charge its own
clients — see *Can we take money?* above — but a **guest** still cannot pay by card, which is what
that row was about. Re-read `COMPETITIVE-GAPS` against the code before quoting it.

Nothing on that list should start before a hotel is using the product — it exists so the
answer is ready when they say which gap they hit.

### Deliberately not being built

- **Guest review requests** — on hold since 2026-09-05. Asking a guest introduced by Booking.com or
  Trip.com to leave a review sits inside that OTA's contract. Disabled at the boundary rather than
  torn out, so it can be switched back on. Full reasoning in `docs/specs/REVIEW-REQUESTS.md`.
- **Internal chat between colleagues** — the ticket thread already carries the conversation that has
  a subject. A second, subjectless one is a product of its own.

---

## Things that need a person, not code

**Done since this table was last written**, so they are off it: the resolved faults and 39 stale
warnings are cleared, the 3 stuck stays are repaired, the support mailbox password is set, and
**both Stripe keys are now stored and testing OK** — the sandbox row and a live restricted key,
last checked 13:01 on 2026-09-22, both with a webhook secret. The row asking for them is gone.

*Everything below was re-checked against production on 2026-09-22.*

| | Who | Why it matters |
| --- | --- | --- |
| **Two duplicate properties in the Channex account** | Founder | Two are named *Ethno Villa Cherry* — one Ruse/EUR, one Cherven/**CZK**, a Czech currency on a Bulgarian villa — and **no Revio channel points at either**. Neither has a channel so neither is billed, but they need clearing up **in Channex**; nothing in our console can reach them |
| **Decide what to do about *Ventsi Group*** | Founder | A real account, suspended. Its channel was disconnected on 22 Sept because it pointed at a property Channex had deleted. Reconnecting needs a new Channex property and a re-provision — the decision is whether the account continues at all |
| **Four overstays and three open folios on the demo book** | Founder / Operations | The state audit against production reports exactly two faults, seven rows, and **both are records a hotelier reaches, not code**: four stays past their departure date never checked out, and three departed stays whose folio is still open (€733 across Ventsi's three). They are the audit working, not failing |
| **Decide one retry policy for a failed job** | Founder | The codebase holds both positions in its own comments — see `ACTION-REQUIRED.md` §2d. Four routes say a failed run should wait out its TTL; two now retry on the next tick. Either is defensible; having both is not |
| **Decide whether to switch payments to live** | Founder | A working live key is stored and the account is BG/EUR with charges enabled. `stripeMode` is `test` by deliberate choice, and the standing constraint says test-only until somebody decides otherwise. **I do not flip that switch.** Separately, `apps/booking` carries no Stripe variables at all, so a *guest* cannot pay by card whatever this is set to |
| **Confirm the article on the VAT certificate** | Founder | Set to **`art97a`** in `OperatorCompany` — *checked by query* — from your description on 2026-09-09. A BG number valid only outside Bulgaria. If the certificate says чл. 96 instead, it is one click on Settings → Company details. It decides the tax on every invoice |
| **Euro changeover and fiscalization** | Founder | Both are dated obligations rather than features. `TaxInvoice.fiscalRef` is the seam; `docs/specs/BG-FISCALIZATION-RESEARCH.md` |

---

## Known issues

**Two faults open in the production error log, both transient infrastructure, neither recurring.**
*Checked by query 2026-09-22:*

| Service | When | What |
| --- | --- | --- |
| `pms` · `/api/jobs/closeday` | 22 Sept 06:51, once | `prisma.jobLease.updateMany()` could not reach `postgres.railway.internal`. A Postgres restart caught the job mid-lease. The same job ran normally at 18:10 the same day — which is the 09-22 `withJobLease` fix working, because under the old code the lease would have stayed held |
| `operator` · `/api/jobs/support-inbox` | 18 Sept, once | `Unexpected close` from a TLS socket — the mailbox connection dropped mid-sweep. Has not recurred in four days. It now returns a diagnosable body instead of a bare 500 |

**The operator alert feed is empty.** Three were open on real clients this morning. One was
**false** — see the 09-22 entry about two alerts saying opposite things. The other two were
repaired the same evening: DesManagement's stale mapping unmapped, Ventsi Group's dead channel
disconnected. `ACTION-REQUIRED.md` §4b has what was found in each and why neither fix sent anything
to an OTA.

⚠️ **Four of the five rows in this log were not faults at all until today** — one per app per
deploy, from tabs open across a release. The list had become 80% weather, which is how a real fault
goes unread. See the 2026-09-22 entry.

Below is the older record of how issues here have been found, which is the point of this section.

⚠️ **The worst defect of the project so far was live for weeks and no test saw it.** R1 above: on
RevioDirect, two guests confirming the same hold both got the room. It was found by an outside review
reading the code — not by 1,800 tests, not by ten ratchet lints, not by `engine-race`, which races
hold *creation* and was green throughout. When it was finally raced properly it was not a rare
interleaving: **every one of twelve concurrent confirms won.**

Two things follow, and both are now written into `AGENTS.md` and `packages/booking/CLAUDE.md`:

1. **A guard proves only what it looks at.** `engine-race` proved the first half of a two-halved
   promise and its green tick was read as covering both.
2. **Concurrency defects do not show up in unit tests.** The three database race harnesses listed
   near the top of this file are the only instruments that can see them, and none of them runs in CI.

The founder-reported issue from 2026-09-07 — a hotel could not reply to our reply on a support ticket
— shipped on 2026-09-08 with the three presentation problems reported alongside it; see
`docs/SUPPORT-ROUND2.md`. Item 5 of that review, more help content, is deliberately still open and
waiting on the queue to say what is missing.

The three faults recorded that week were all the same thing — a browser tab left open across a
deploy — and the cause was fixed on 2026-09-07: the app detects it and reloads itself instead of
showing an error that could not be dismissed.

⚠️ **That fix handled the browser and not the log.** The server went on filing one row per app per
deploy for another two weeks, which is what made the log unreadable by 09-22. A fix that addresses
the symptom a user sees is not the same as one that addresses the record — this file is the record,
and it said "none open" throughout.

The one real defect found that week that *would* have affected a user — `trial-sweep` never running
— was fixed on 2026-09-07 before any trial existed. *Checked 2026-09-22: there is now **1**
`ProductTrial` row in production, on a demo tenant, started 09-11 and running.* Had one been running, it would never have warned, never expired, and the hotel would have kept
the product free while the console showed a countdown that meant nothing.

---

## How to check any of this yourself

```
curl -s https://operator.reviosoft.app/api/health/jobs     # are the scheduled jobs running?
open https://operator.reviosoft.app/errors                  # has anything thrown, and was it ours?
open https://operator.reviosoft.app/overview                # what needs a call today
open https://operator.reviosoft.app/analytics               # what anybody actually opens
open https://operator.reviosoft.app/website                 # Google's numbers, without signing in
open https://operator.reviosoft.app/platform-history        # what was built, and what is next
git ls-remote --heads origin production                    # what is actually deployed
railway logs --service jobs                                # what the cron actually got back
pnpm verify                                                # every test and check, locally
pnpm route-walk                                            # every SCREEN, signed in (needs the apps running)
pnpm click-walk                                            # what a person PRESSES, in a real browser
```

**Against production directly**, read-only, for the things no screen aggregates:

```
PROD="$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)"

# the audit the Platform Health page runs, from a terminal
cd packages/db && DATABASE_URL="$PROD" npx tsx scripts/state-audit.ts

# what is actually unresolved, rather than what a page chose to show
psql "$PROD" -c 'SELECT service, route, count, "lastSeenAt" FROM "AppError" WHERE "resolvedAt" IS NULL'
psql "$PROD" -c 'SELECT "clientName", key, summary FROM "OperatorAlert" WHERE "resolvedAt" IS NULL'
```

⚠️ **`route-walk` mints its own session** from the local database and needs no password. If you
find yourself about to type one into a form to check a screen, use `route-walk --app <name>`
instead — it signs the same JWT the app's own login would.

### ⚠️ `pnpm verify` does not open a single page — `pnpm route-walk` does

On 2026-09-14 this repository had **2,591 passing tests and eleven ratchet lints, and not one of them
loaded a screen.** (2,911 and fifteen today; the point stands — none of them opens a page.) Every test proved a function returned the right value; none proved a person could
open a page. The founder found the consequence in production: a search result that led to "We
couldn't find that", and then a white page reading *"Application error: a client-side exception has
occurred."*

`scripts/route-walk.mjs` walks every screen in all four products with a real session and asserts two
things:

1. the server answered, and
2. **the page is not one of our own failure screens.**

The second is the point. A 200 is not success — an error boundary answers 200 with an apology
painted on it, which is exactly how a broken screen looked healthy to every check we had. The
strongest signal it uses is `<!--$!-->`, React's own marker for a suspense boundary whose server
render threw: it appears in dev and in production, whatever the boundary then paints, and it cannot
be defeated by rewording a screen.

It also walks each app **as a second role**, which is the regression test for the read-scoping holes
closed the same day: a `distribution_manager` must reach all 21 RevioLink and 24 RevioCRS screens,
and must be refused all 25 RevioPMS ones, sent to `/no-access`. Both directions are asserted, because
a guard that refuses everybody passes every negative test and breaks the product.

**Proven to fail**, three times, which is the only reason to trust it: a planted throw in the
reservation page, the `roleCanOpenProduct` check deleted (every PMS screen reported as wrongly
opened), and an app that was not running — reported as SKIPPED, never as passing. It is not in
`pnpm verify` because it needs the apps running, the same reason `rls-verify` and `webhook-verify`
are not.

`pnpm click-walk` is the other half, added 2026-09-15 — a real browser driving what a person presses:
⌘K opened and a result clicked, one notification read, then "mark all read". Those are the three
paths that broke on 2026-09-14, and every one of them passed 2,591 unit tests and eleven lints,
because what they broke in is what happens between a press and the database.

⚠️ **Its assertions are positive, not "no error".** "Nothing threw" also passes when the button does
nothing at all — and the founder's bug was a click that led somewhere useless rather than one that
threw. So it insists the palette actually opened a booking, the unread count actually fell **across
a page reload**, and "mark all read" reached **zero** rather than merely fewer. The reload is
load-bearing: the badge drops optimistically on the client whatever the server did, which is exactly
how a write that threw still looked like it had worked.

It creates its own unread events — two, so that marking one read still leaves the "Mark all read"
button to press — and removes them in a `finally`, including on a crash. It refuses to run against
anything but the local `revio_dev` database, because it writes.

**Proven to fail**: `markNotificationRead` made a no-op → *"marking one read did not persist (2 → 2
after reload)"*, which is yesterday's `$executeRaw` bug exactly.

Playwright drives it (a root devDependency, chromium-headless-shell only). Like `route-walk`, it is
not in `pnpm verify` — it needs the apps running.
