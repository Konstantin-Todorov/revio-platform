# Revio — where the project actually is

**Verified against production on 2026-09-07.** Every line below was checked against the database, the
deployments or the code on that date. Nothing here is copied forward from another document.

---

## Why this file exists

Status was spread across eight append-only documents — `CLAUDE.md`, `BUILD-PLAN.md`, `GO-LIVE.md`,
`ACTION-REQUIRED.md`, the ideas register and three spec trackers. Nobody can keep eight files in
agreement, so they drifted, and in the first week of September **nine separate claims turned out to
be wrong** — in both directions. Work marked "still open" had shipped weeks earlier; work marked
shipped had never once run.

Two that show the shape of it:

- **Channex production certification** sat on the open list for two weeks. Its own runbook had said
  *"✅ CERTIFIED — production account live"* since 2026-08-24.
- **`book.revio.app`** was carried in five documents as outstanding DNS work. The domain does not
  exist, and `revio.app` was never ours.

### The rule that keeps this file true

1. **A claim here names how it was checked** — a query, a URL, a file. "It should be done" is not a
   status.
2. **The other documents do not restate status.** They hold *reasoning* and *design*; this file holds
   *state*. If they disagree, this file is right and the other is stale.
3. **Check the code before repeating any list**, including the parts you expect somebody else to
   own. The two misses above were both items filed as "external, blocked on the founder" and
   therefore never verified — the rule was applied to the build list and not to the report.

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

All seven Railway services deploy from the CI-gated `production` branch and were on the same commit
when checked. **1,671 automated tests pass**, plus eleven separate checks on every change.

**Channex is certified and connected** — certified 2026-08-24, key in place 08-26, two production
channels connected right now. This is the real OTA connection, not the mock.

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

All five invoices in the system belong to **demo** hotels — the two we run ourselves for rehearsal,
plus one more. They are real invoices against real pricing, which is how the billing flow stays
tested, but they are not income.

The demo hotels are where the volume is: 128 rooms, 51 reservations, 22 guests, 12 connected
channels. That is what a prospect sees in a demonstration, and it is genuine data on the real
system — not a mock-up.

**What this means:** the software is finished and proven; the business has not started. The next
constraint is a hotel that uses it, not a feature.

---

## What is being worked on

### In progress
Nothing is half-built. No feature is sitting broken or partly wired.

**Shipped 2026-09-08 — support.** Every product's account menu has *Get help*: it captures the hotel, the
product, the screen and the person automatically, records the request, and emails it. The operator queue is
at `/support`, sorted by **how late against the window we promised** rather than by how loudly it was
reported. The promise itself is 2 hours for *guests affected now*, one working day for a problem, two for a
question — modest and keepable, with no 24/7 claim anywhere.

### Ready to build, in the order I would do them

| | Why | Effort |
| --- | --- | --- |
| **Onboard one real hotel end to end** | The only thing that turns finished software into a business. Everything below is guesswork until a hotel has used it for a week | — |
| **Settings tidy-up in the other products** | Just done for RevioCRS; RevioLink and RevioPMS have the same long-page problem | Small |
| **Product analytics (PostHog)** | We cannot see which screens a hotel actually uses | Medium |
| **In-app AI assistant** | The biggest differentiator and the least urgent | Large |
| **Card payments (Stripe live)** | Deliberately deferred — hotels pay by bank transfer, and there is nothing to collect yet | Medium |

### Deliberately not being built

- **Guest review requests** — on hold since 2026-09-05. Asking a guest introduced by Booking.com or
  Trip.com to leave a review sits inside that OTA's contract. Full reasoning in
  `docs/specs/REVIEW-REQUESTS.md`.

---

## Things that need a person, not code

| | Who | Why it matters |
| --- | --- | --- |
| **Confirm the VAT treatment with an accountant** | Founder | Three readings are implemented and reversible now, expensive later. `docs/ACTION-REQUIRED.md` §2 |
| **Decide what to do about *Ventsi Group*** | Founder | A real account, currently suspended |
| **Run the stuck-stay repair** | Founder | 4 demo records with a departure recorded a month late. Script is written and dry-run checked; production writes are blocked for the agent |
| **Clear old warnings in the operator console** | Founder | 4 faults and 39 warnings, all from resolved problems. They make the console show attention that is not needed |

---

## Known issues

**None open that affect a user.** The three faults recorded this week were all the same thing — a
browser tab left open across a deploy — and the cause was fixed on 2026-09-07: the app now detects it
and reloads itself instead of showing an error that could not be dismissed.

---

## How to check any of this yourself

```
curl -s https://operator.reviosoft.app/api/health/jobs     # are the scheduled jobs running?
git ls-remote --heads origin production                    # what is actually deployed
pnpm verify                                                # every test and check, locally
```
