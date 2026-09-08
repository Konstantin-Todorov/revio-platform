# Revio — where the project actually is

**Verified against production on 2026-09-07**, at commit `37effde`. Every line below was checked
against the database, the deployments or the code on that date. Nothing here is copied forward from
another document.

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

**1,797 automated tests pass** (`pnpm verify`, ten packages), plus **twelve separate checks** on every
change — typecheck, lint, and ten ratchets that each exist because something specific went wrong
once: copy · authz · silent · money · health · a11y · scroll-lock · jobs · zoom · tokens. CI additionally applies every migration into an empty database and runs the seed.

**Channex is certified and connected** — certified 2026-08-24, key in place 08-26. *Checked by query:*
two channels in `channex_prod` mode, both `connected`. That is the real OTA connection, not the mock.

**All eight scheduled jobs run.** *Checked at `/api/health/jobs`:* `hold-expiry` · `pickup-snapshot` ·
`channex-pull` · `arrivals-digest` · `auto-assign` · `auto-close-day` · `waitlist-sweep` ·
`trial-sweep`. The last of those was fixed today — see *Why this file exists*.

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

*Checked by query against production.* There are **three** demo tenants — Hotel Sofia Group, Black Sea
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
Nothing is half-built. No feature is sitting broken or partly wired.

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
| **In-app AI assistant** | The biggest differentiator and the least urgent. Waiting for a real support queue to learn from | Large |
| **Card payments (Stripe live)** | Deliberately deferred — hotels pay by bank transfer, and there is nothing to collect yet | Medium |

### Deliberately not being built

- **Guest review requests** — on hold since 2026-09-05. Asking a guest introduced by Booking.com or
  Trip.com to leave a review sits inside that OTA's contract. Disabled at the boundary rather than
  torn out, so it can be switched back on. Full reasoning in `docs/specs/REVIEW-REQUESTS.md`.
- **Internal chat between colleagues** — the ticket thread already carries the conversation that has
  a subject. A second, subjectless one is a product of its own.

---

## Things that need a person, not code

| | Who | Why it matters |
| --- | --- | --- |
| **Confirm the VAT treatment with an accountant** | Founder | Three readings are implemented and reversible now, expensive later. `docs/ACTION-REQUIRED.md` §2 |
| **Decide what to do about *Ventsi Group*** | Founder | A real account, currently suspended |
| **Clear the resolved faults** | Founder | 4 faults and 39 warnings, all from causes fixed days ago — verified against production, and the script is bounded so it cannot clear anything new. `psql "$DATABASE_PUBLIC_URL" -f packages/db/scripts/clear-resolved-faults.sql` |
| **Run the stuck-stay repair** | Founder | **3** demo reservations (all Hotel Sofia Group) with a departure recorded a month late. Script written and dry-run checked; production writes are blocked for the agent |
| **Set the support mailbox password** | Founder | `support-inbox` is built, deployed and doing nothing until `SUPPORT_IMAP_*` exists on the operator service. The password is yours to paste — see DEPLOY.md |
| **Clear old warnings in the operator console** | Founder | 4 faults and 39 warnings, all from resolved problems. They make the console show attention that is not needed |

---

## Known issues

**None open that affect a user.** The one found by the founder on 2026-09-07 — a hotel could not
reply to our reply on a support ticket — was built and shipped on 2026-09-08 along with the three
presentation problems reported with it; see `docs/SUPPORT-ROUND2.md`. Item 5 of that review, more
help content, is deliberately still open and waiting on the queue to say what is missing.

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
