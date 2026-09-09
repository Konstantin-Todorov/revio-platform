# Revio — where the project actually is

**Updated 2026-09-09**, at commit `eaadab6` — which CI passed and `promote.yml` fast-forwarded onto
`production`, *checked with `git ls-remote --heads origin production`*. Every line below names how it
was checked. Nothing here is copied forward from another document.

⚠️ **What was re-checked on 2026-09-08 and what was not.** Re-checked: the deployed commit, the nine
scheduled jobs (`/api/health/jobs`), the booking engine responding, the full test and lint gate, and
the three database race harnesses. **Not re-queried today:** the commercial figures under *The honest
commercial position* — those are as at 2026-09-07 and are labelled there. Saying which is which is
the whole point of this file.

---

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

### The rule that keeps this file true

1. **A claim here names how it was checked** — a query, a URL, a file. "It should be done" is not a
   status.
2. **The other documents do not restate status.** They hold *reasoning* and *design*; this file holds
   *state*. If they disagree, this file is right and the other is stale.
3. **Check the code before repeating any list**, including the parts you expect somebody else to
   own. Two of the misses above were filed as "external, blocked on the founder" and therefore never
   verified — the rule was applied to the build list and not to the report.
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
| **Marketing site** | | `reviosoft.app` | Live |

*Checked with `railway status --json`:* eight Railway services, all online. The six platform services
(`channel-manager` · `reservation` · `pms` · `booking` · `operator` · `jobs`) are all on the CI-gated
`production` branch at the **same commit**; the marketing site is on `production` of its own repo;
Postgres is an image.

**1,897 automated tests pass** (`pnpm verify`, ten packages), plus **twelve separate checks** on every
change — typecheck, lint, and ten ratchets that each exist because something specific went wrong
once: copy · authz · silent · money · health · a11y · scroll-lock · jobs · zoom · tokens. CI additionally applies every migration into an empty database and runs the seed.

⚠️ **Three checks are deliberately NOT in that number, because they need a live database**, and each
is the only real proof of something the platform promises. Run them by hand against a scratch or
demo database before a release:

```
pnpm --filter @revio/db claim-verify        # the claim primitive is atomic
pnpm --filter @revio/booking engine-race    # the booking path never oversells a hold
pnpm --filter @revio/booking confirm-race   # one hold becomes exactly one reservation
```

The last of those is new on 2026-09-08 and found the worst defect of the week — see *Known issues*.

**Channex is certified and connected** — certified 2026-08-24, key in place 08-26. *Checked by query:*
two channels in `channex_prod` mode, both `connected`. That is the real OTA connection, not the mock.

**All NINE scheduled jobs run.** *Checked at `/api/health/jobs` on 2026-09-08, every one `ok` and
under a minute old:* `hold-expiry` · `pickup-snapshot` · `channex-pull` · `arrivals-digest` ·
`auto-assign` · `auto-close-day` · `waitlist-sweep` · `trial-sweep` · **`support-inbox`**. The last
is new and is the proof the support mailbox credentials are in place — it was inert until they were.

---

## The honest commercial position

This is the part most likely to be misread from the engineering documents, so it is stated plainly.

**There is no revenue and no hotel is operating on the platform yet.**

| | |
| --- | --- |
| Real (non-demo) accounts | **2** — *Ruse Rentals Tester* and *Ventsi Group* |
| Of those, active | **1** (Ventsi Group is suspended) |
| Reservations taken by a real client | **0** |
| Rooms configured by a real client | **0** |
| Invoices ever issued to a real client | **0** |
| Monthly recurring revenue | **€0** |

*Checked by query against production on 2026-09-07; not re-queried on 09-08, and nothing has
happened since that would move them — there is still no real client using the platform.* There are
**three** demo tenants — Hotel Sofia Group, Black Sea
Resort and Belmar Boutique Hotel — and all five invoices in the system belong to them (three paid, two
draft). They are real invoices against real pricing, which is how the billing flow stays tested, but
they are not income.

The demo hotels are where the volume is: **128 rooms, 51 reservations, 22 guests, 17 room types, 12
connected channels**. That is what a prospect sees in a demonstration, and it is genuine data on the
real system — not a mock-up.

**What this means:** the software is finished and proven; the business has not started. The next
constraint is a hotel that uses it, not a feature.

---

## What is being worked on

### In progress
Nothing of ours is half-built. **Codex has two items uncommitted in the shared tree** (claimed in
`docs/WORK-LOG.md`, both currently green under `pnpm verify`): the city-tax VAT base in
`apps/pms/lib/invoice.ts`, and the operator sidebar's seven-group navigation in
`apps/operator/components/shell/Sidebar.tsx`. They are local only; nothing is deployed. Stage by path
if you commit anything nearby.

### Shipped 2026-09-09 — payments plumbing, and a VAT defect that would have overcharged every Bulgarian client

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

| | Why | Effort |
| --- | --- | --- |
| **Onboard one real hotel end to end** | The only thing that turns finished software into a business. Everything below is guesswork until a hotel has used it for a week | — |
| **Charge a card, not just store a key** | ✅ The *connection* shipped 2026-09-09; what it cannot yet do is take money. `/billing` still issues an invoice nobody can pay by card. Next: a payment intent against an invoice, the webhook that hears it succeeded, and `Invoice.status` moving to paid on its own | Medium |
| **Client analytics** | Every number on the client page is today's value. A twelve-month sparkline, one health score with its parts visible, and MRR movement — the three things every mature console leads with, and all four inputs already exist | Medium |
| **Hotel's own Stripe keys** | The model is settled (their account, not Connect — we never touch the money) and designed in `docs/PLAN-2026-09-09.md` §1. It follows ours rather than leading it | Medium |
| **In-app AI assistant** | The biggest differentiator and the least urgent. Founder's framing: future context, not a task. Waiting for a real support queue to learn from | Large |

### Known gaps against competitors

`docs/COMPETITIVE-GAPS-2026-09.md` — RevioDirect measured against what SiteMinder, Cloudbeds and Mews
actually ship, plus the platform read as a hotel owner rather than as a feature list. Checked against
the code, not the documents. The four that matter most: **no analytics on the booking page at all**
(so an owner cannot see or advertise their own funnel), **no abandoned-booking recovery** (the data is
already captured and thrown away), **one language and one currency**, and **we still cannot take
money**. Nothing on that list should start before a hotel is using the product — it exists so the
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
warnings are cleared, the 3 stuck stays are repaired, and the support mailbox password is set — the
inbound-email job now reads `support@reviosoft.app`.

| | Who | Why it matters |
| --- | --- | --- |
| **Paste the Stripe sandbox keys** | Founder | `/integrations/stripe` → Sandbox → *Set up*. Secret (`sk_test_…`) and publishable (`pk_test_…`) from Stripe → Developers → API keys. The key is tested before it is stored and never shown again. **I do not enter keys, so this one is yours** |
| **Confirm the article on the VAT certificate** | Founder | Set to **чл. 97а** on 2026-09-09 from your description — a BG number valid only outside Bulgaria. That is what the certificate should say; if it says чл. 96 instead, it is one click on Settings → Company details. It decides the tax on every invoice |
| **Decide what to do about *Ventsi Group*** | Founder | A real account, currently suspended |
| **Euro changeover and fiscalization** | Founder | Both are dated obligations rather than features. `TaxInvoice.fiscalRef` is the seam; `docs/specs/BG-FISCALIZATION-RESEARCH.md` |

---

## Known issues

**None open.** But four were open for a day, and how they were found is the point of this section.

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

The three faults recorded this week were all the same thing — a
browser tab left open across a deploy — and the cause was fixed on 2026-09-07: the app now detects it
and reloads itself instead of showing an error that could not be dismissed.

The one real defect found this week that *would* have affected a user — `trial-sweep` never running —
was fixed on 2026-09-07 before any trial existed. There are **0** trials in production, so nothing was
missed. Had one been running, it would never have warned, never expired, and the hotel would have kept
the product free while the console showed a countdown that meant nothing.

---

## How to check any of this yourself

```
curl -s https://operator.reviosoft.app/api/health/jobs     # are the scheduled jobs running?
open https://operator.reviosoft.app/analytics               # what anybody actually opens
git ls-remote --heads origin production                    # what is actually deployed
railway logs --service jobs                                # what the cron actually got back
pnpm verify                                                # every test and check, locally
```
