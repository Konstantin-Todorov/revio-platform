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

**1,759 automated tests pass** (`pnpm verify`, ten packages), plus **eleven separate checks** on every
change — typecheck, lint, and nine ratchets that each exist because something specific went wrong
once: copy · authz · silent · money · health · a11y · scroll-lock · jobs · zoom.

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

### Ready to build, in the order I would do them

| | Why | Effort |
| --- | --- | --- |
| **Onboard one real hotel end to end** | The only thing that turns finished software into a business. Everything below is guesswork until a hotel has used it for a week | — |
| **Jobs on Platform Health** | `trial-sweep` sat at `never` in a JSON body nobody reads. The console should say it. `docs/OPERATOR-REVIEW-2026-09.md` item 2 | Small |
| **RevioDirect visibility in the operator** | Bookings, revenue, usage fee and commission avoided all exist and appear nowhere. Item 3 | Small |
| **Settings tidy-up in the other products** | Done for RevioCRS (a hub with five sub-pages); RevioLink still has ~8 sections on one page. RevioPMS is short enough to leave | Small |
| **Product analytics (PostHog)** | We cannot see which screens a hotel actually uses | Medium |
| **Inbound email for tickets** | We can send from a thread but not receive into one; a customer replying to the email is currently invisible | Medium |
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
| **Run the stuck-stay repair** | Founder | **3** demo reservations (all Hotel Sofia Group) with a departure recorded a month late. Script written and dry-run checked; production writes are blocked for the agent |
| **Clear old warnings in the operator console** | Founder | 4 faults and 39 warnings, all from resolved problems. They make the console show attention that is not needed |

---

## Known issues

**None open that affect a user.** The three faults recorded this week were all the same thing — a
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
git ls-remote --heads origin production                    # what is actually deployed
railway logs --service jobs                                # what the cron actually got back
pnpm verify                                                # every test and check, locally
```
