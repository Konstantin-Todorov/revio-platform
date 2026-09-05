# Gap register — defect classes and the guards that hold them shut

Every entry here was a **class**, not an incident. Each was found once, fixed everywhere it occurred,
and then given a **guard** — a test, a lint or a CI step — so that finding it again does not depend on
somebody remembering.

The rule this file exists to enforce:

> **A gap without a guard is a gap that comes back.** Fixing the instance is half the work; the other
> half is making the class impossible to reintroduce quietly.

Status: ☑ guarded (cannot silently return) · ◐ partly guarded · ☐ found, not yet guarded

---

## ☑ 1. An unreadable number reaching the database

**`Math.max(0, NaN)` is `NaN`, not `0`.**

A server action hand-rolls `Math.round(Number(str(fd, "price")) * 100)`. Every operation after a
`NaN` stays `NaN`, `Math.max` does not clamp it, and the value reaches Prisma — rejected as a crash
the user sees, or accepted into a column somebody later does arithmetic on.

It looks solved because `Number("")` is `0`, so the usual `|| "0"` passes a blank field — while
letters, and the comma decimal a European guest types (`12,50`), go straight through.

| | |
| --- | --- |
| **Found** | 2026-09-02 in production, `priceMinor: NaN` from the RevioLink calendar |
| **Then found again** | 2026-09-02, **4 more live sites**: two on a confirmed reservation's price, two on a tax/fee that reaches the guest's all-in price |
| **And again** | the public booking engine's party size, surviving only on a guard in another package |
| **Fix** | `money()` / `decimal()` / `int()` from `@revio/core/forms/parse` — string-based, so a cent cannot drift — or an explicit `Number.isFinite` refusal |
| **Guard** | **`pnpm money:lint`** (budget **0**, in `verify` and CI) |

⚠️ **A price nobody can read is not zero.** Zero is a real price meaning *free*. Refuse it; never
default it. Defaulting the booking engine's party size would have been *worse* than the `NaN` — a
tampered post would quietly price a stay for two that nobody asked for.

## ☑ 2. The schema no longer describing the database

Prisma generates migrations **from** `schema.prisma`. So when the schema stops describing what the
migrations actually build, the next `migrate dev` emits `DROP INDEX` for whatever the schema forgot.
This is not untidiness; it is a destructive migration waiting to be generated.

| | |
| --- | --- |
| **Found** | 2026-09-02 — three live performance indexes (`Folio(propertyId, outcome)`, `Reservation(propertyId, departedAt)`, `ChannelRatePlanMapping(roomTypeId)`) and `StayGuest.dateOfBirth`'s `DATE` type |
| **Why nothing caught it** | typecheck, lint, the full suite and `next build` all pass either way |
| **Fix** | annotate the schema to match the database — no migration, no DDL, no data touched |
| **Guard** | **`pnpm --filter @revio/db db:drift`** in CI, on a throwaway postgres service container |

## ☑ 3. An anchor read off whichever row sorted first

A property-level value taken from `rows[0]` instead of derived from the rows as a set. The main guest
count — the party size the headline price is *for* — came from `roomTypes[0]?.defaultOccupancy ?? 2`,
so a hotel of forty doubles whose single sorted first anchored its whole occupancy ladder on one.

| | |
| --- | --- |
| **Fix** | `resolveMainGuestCount` — the most common room's occupancy, **weighted by how many exist**; ties break toward the smaller, because under-anchoring makes the ladder *add* money (visible) rather than subtract it (silent) |
| **Guard** | `main-guest-count.test.ts` — **18 tests**, one pinning the first-row case directly |

## ☑ 4. A number that was never a decision, rendered as one

The counterpart to class 5. `mainGuestCount` is nullable so that *unset* stays distinguishable from
*chosen*; while unset the value is derived and every screen renders **"· assumed"** beside it.

| | |
| --- | --- |
| **Principle** | a `NOT NULL` default invents a decision for every existing row and destroys the only distinction that matters |
| **Guard** | covered by the same 18 tests (`basis: configured \| derived \| fallback`) |

## ☑ 5. Health reported without being verified

The theme of all three September founder documents, and the same shape as the Channex 401 incidents:
a green pill over a channel that last synced 65 days ago, "Queue empty" above a queue of ten,
`0 Failed Syncs · Clear` where nothing was attempted, `100%` beside 25 open errors.

> ⚠️ **A zero from success and a zero from silence must never render the same.**

| | |
| --- | --- |
| **Fix** | `@revio/core/metrics/sync-health.ts` — five states, including `idle` (never ran) and `unknown` (nothing attempted), which are the two screens kept collapsing into green |
| **Guard** | **25 tests**, shared by RevioLink and Operator so the two cannot disagree |
| **Guard** | **`pnpm health:lint`** (budget **0**, in `verify` and CI) — a health CLAIM hardcoded in a success pill must be derived, or carry a stated reason |
| **Also fixed** | Operator **Clients** rendered a green `active` from the CONTRACT status alone, so a client silent for 65 days still read green (7 bug 6 / §10.5). Now a second pill, derived from the last **successful** sync |
| **Also fixed** | RevioLink **Mapping** rendered "All mapped" from a row count, so a product that never reached the channel made it green — see #10 |

## ◐ 10. A product that never reached the channel, counted by asking for rows

`provisionChannexProperty` is the **only** code that creates a room type or rate plan on Channex, and
it is one-shot — it sends what exists the moment it runs. A room type added the week after is created
locally, linked to every plan, made sellable on the booking engine, and never mentioned to Channex.

What makes it dangerous is how it reports. Every "unmapped products" counter asks the mapping tables
for rows whose `status` is not `complete`. A product that was never sent has **no mapping row at
all**, so it matches nothing and adds nothing to the count — the hotel is shown *all mapped*, green,
while selling a room no OTA can see.

| | |
| --- | --- |
| **Found** | the first real hotel hit it; named in the September tracker, in none of the three founder documents |
| **Compounded by** | `unmappedPairs` — the correct, tested function written for exactly this — having **zero callers** |
| **Fix so far** | `structureGap` in `@revio/connectivity`: what is *absent*, not what is *incomplete*. Wired into the notification bell, guarded so a hotel with no channel yet is not warned |
| **Guard** | `structure-gap.test.ts` — **11 tests**, one pinning the added-after-provisioning case |
| **Why ◐** | the gap is now **visible** but not yet **repairable from the product**. Creating the missing room type or rate plan on Channex is still a re-provision, and re-provisioning refuses (correctly) because the property already exists. |

**The repair, staged deliberately.** `planStructureSync` (`structure-plan.ts`, **13 tests**) decides
what to send: it walks the missing products and returns *adopt* or *create* for each, one rate plan
per (room type × manual plan) PAIR.

⚠️ **Adopt before you create** is the rule that matters. A missing mapping row does NOT mean Channex
has never heard of the product — provisioning writes the room type and *then* the mapping, so a
failure between the two leaves it created and unmapped. Creating it again is exactly how
`Ethno Villa Cherry` came to exist twice: a duplicate gets its own uuid, is silent, is permanent, and
is indistinguishable from the real one afterwards.

**The executor.** `applyStructurePlan` (`structure-apply.ts`, **9 tests**) sends it, with three rules
each learned from a real incident: the mapping is written **immediately** after each create (persisting
at the end is how a property came to exist twice); **one refusal does not abandon the rest**; and a
room type that failed **skips its own rate plans** rather than attaching a price to the wrong room.

**Wired to two server actions** in `actions-connect.ts`, both gated (`manageDistribution`):
`previewChannexStructure` is read-only, and `syncChannexStructure` **recomputes the plan** rather than
accepting one from the browser — a plan is a list of things to create in a hotel's Channex account,
and taking it from a client would be a create-anything endpoint.

☐ **Remaining: a screen, and a sandbox rehearsal before one exists.** The write path is tested against
a fake API but has never run against Channex. It must be rehearsed on the sandbox the way every other
Channex change in this repo has been, and only then put behind preview → confirm.

⚠️ **Hold the button until `Ethno Villa Cherry` is resolved.** That property is *already* duplicated in
Channex and awaiting a human decision. Shipping an auto-create button while a property is in that state
risks making a bad state worse, which is the opposite of the point.

### ⚠️ The trap inside class 5: `lastSyncAt` is an ATTEMPT

`Channel.lastSyncAt` is stamped when a push finishes, **before its `ok` is read**. So a channel
failing every five minutes has a very recent one. Asking it "has this client synced lately?" gets a
cheerful yes from a dead integration — the same green, arriving through the fix meant to remove it.

Derive recency from a **successful `SyncEvent`** instead. The RevioLink dashboard already did; the
Operator console was still reading the attempt field when this was written.

## ☑ 6. A state machine enforced by the screen instead of the model

An invoice could be **paid without ever having been issued** — settled with no number and no
`issuedAt`, because `setInvoiceStatus` accepted any status from any status.

| | |
| --- | --- |
| **Fix** | `@revio/core/invoicing/invoice-state.ts` — issued is immutable, only issued can be paid, nothing returns to draft |
| **Guard** | **22 tests**; the screen now asks the same pure function that performs the change |

## ☑ 7. Actions that fail without saying so

A `Promise<void>` action bails early and the screen comes back looking unchanged, so the user presses
the button again.

| **Guard** | **`pnpm silent:lint`** — budget **104**, may fall, never rise |

## ☑ 8. Server actions without an authorization gate

A screen hidden from a role while the write behind it stayed open to a crafted POST.

| **Guard** | **`pnpm authz:lint`** — every action gated, or exempt **with a stated reason** (currently 219 gated / 16 exempt) |

## ☑ 9. Internal vocabulary reaching the user

| **Guard** | **`pnpm copy:lint`** — 477 files, zero internal terms in user-visible strings |

---

## Wanted — classes known but not yet guarded

### ☑ Closed 2026-09-05 — both instances fixed. Kept here for the reasoning.

**A concurrency guard applied to the scheduled path and not to the manual one.**

`/api/jobs/closeday` takes `JOB.autoCloseDay` and says why: *"two closes would roll the business
date twice and skip a day entirely."* The manual **Close Day** button reaches the same
`runCloseDay` with no lease.

Read carefully, a day **cannot** be skipped by two *concurrent* runs: both read `businessDate = D`
outside the transaction and both compute `next` from that read, so both write `D+1` and the value is
idempotent. What a concurrent pair does produce is a **duplicated close record** — the no-show scan
re-reads candidates from before the first run, so the same reservations are counted twice and two
audit entries claim the same close.

**Fixed by making the roll optimistic rather than by adding a lease** — `where: { id, businessDate:
<the value read> }` — because a lease only serialises runs that overlap in TIME, and the dangerous
case here is *sequential*: close, roll D → D+1, and a second close moments later reads D+1 and rolls
to D+2, skipping a day with nothing objecting. The condition refuses both, because it asks the only
question that matters: is the business date still the one I read?

The refusal **throws**, which aborts the transaction, so the no-show updates roll back with it —
marking half a day's no-shows and then declining to close is the split state `runCloseDay`'s own
docstring promises never to leave behind. Both callers treat it as a normal outcome: the button says
so out loud (the day IS closed; a silent redirect reads as "my click did nothing"), and the cron
counts it skipped and carries on with the rest of the sweep.

The mechanism is not novel here: `acquireJobLease` claims its lease with the identical conditional
`updateMany`, and its own comment records that two processes racing it produce exactly one updated
row.


## ☑ 11. Two implementations of an irreversible operation

`channex-provision.ts` stated in its own header that provisioning "moved here, behind an interface
both the CLI and a server action can call." **The button called it; the CLI did not.**
`packages/connectivity/scripts/channex-onboard.ts` — the path `ONBOARDING-A-HOTEL.md` actually tells
people to run — carried its own copy of all of it: the duplicate-title check, `POST /properties`,
the room types, the per-pair rate plans, the channel row and both mapping tables.

The cost was not theoretical. Removing the per-tenant key copy, adding the duplicate guard, and
moving the channel write earlier were each done **twice**, one of them a day apart. Commit `88e3676`
is called *"The CLI onboarder had every bug the button had"*.

| | |
| --- | --- |
| **Fix** | 167 lines of duplicated provisioning deleted; the CLI now calls `provisionChannexProperty` with its own `writes`. One implementation of an operation whose mistakes are permanent |
| **Kept** | `--dry-run` was documented (*"always `--dry-run` first"*) so it moved INTO the shared function — both paths get it now, including the in-app button, which never had a preview |
| **Guard** | `channex-provision.test.ts` — **14 tests** on the function that had none, covering every refusal, the duplicate check, the early channel write, one rate plan per pair, and that a dry run creates nothing |

⚠️ Note the ordering: the tests were written **before** the consolidation, not after. Merging two
implementations of an irreversible operation with no cover would have been the riskier half done blind.

---

## ☑ 12. A queue that hands the freed resource back to whoever just released it

`waitlistSweep` releases a lapsed offer's hold and sets the entry back to `waiting`, then — in the
same run, in a second transaction — reads every `waiting` entry and offers the freed room to the
oldest. That is the guest who just let it lapse. They are the oldest by construction, because being
oldest is why they were offered it first.

So the room they ignored went straight back to them, the person behind them heard nothing, and the
three offers `MAX_OFFERS_PER_ENTRY` allows were spent in three sweeps a few minutes apart rather than
over three real chances. The module's own docstring says "the next person only hears anything if that
offer lapses", which is the behaviour that did not happen.

It was invisible for the usual reason: the file had **no test**, while both its siblings in the same
package did.

| | |
| --- | --- |
| **Fix** | Entries lapsed in this run are excluded from this run's offers. They keep their place — position is derived from `createdAt` and never renumbered — they are simply not eligible for inventory their own lapse released |
| **Guard** | `packages/booking/src/waitlist-sweep.test.ts` — **26 tests** on a 255-line file that had none, pinning the four rules its docstring states: expiries before offers, hold before mark, one offer per freed room, silence when the room went in the gap |

⚠️ The general shape: **a release and a re-allocation in the same pass, where the releaser is still
a candidate.** Worth checking anywhere else a resource returns to a pool that is then drained by
seniority.

---

## ☑ 13. A monitor that enumerates what happened instead of what should exist

`/api/health/jobs` is the dead-man's switch for the cron — the thing that catches a scheduler whose
failure is otherwise silent. It read `JobLease` rows and mapped over them.

A lease row is created by `acquireJobLease` on a job's **first run**. So a job declared in `JOB` and
never once scheduled has no row, and a list built from rows cannot contain it: the endpoint answered
`200 ok` with the job simply missing from the body. Adding a job to the code and forgetting its cron
entry is the single most likely way a job never runs, and it was the one case the monitor could not
see. Its docstring even claimed absence was "reported as `never`, visible in the body" — true only of
a row that exists with a null `lastRunAt`, which is a different and rarer thing.

Found by asking whether the switch knew about `waitlist-sweep`, which had just been declared. It did
not.

| | |
| --- | --- |
| **Fix** | The list starts from the `JOB` registry and joins the leases onto it. A declared job with no row is `never`; an orphan row for a name no longer declared still appears, because a half-finished rename is worth seeing |
| **Kept** | `never` still does not return 503. A monitor that screams on every deploy gets muted, and "not finished" and "broke" deserve different volumes |
| **Guard** | `apps/operator/lib/job-health.test.ts` — **16 tests**; the logic moved out of the route handler into a pure module, because the previous version was neither pure nor tested |

⚠️ Same family as class 5 and class 10: **a health signal derived from rows that exist rather than
from the thing being asserted.** Three now. Ask of any green indicator: what row's absence would make
this say ok?

---

## ☑ 14. A guarantee whose two halves live in different files

Found while auditing an architecture change rather than a bug, and nothing was broken — which is the
point of the entry.

The shell moved from scrolling an inner `<main>` to scrolling the document natively. `useScrollLock`
survived that, because it always locked `<body>` as well as the nearest scrolling ancestor. But the
reason body-locking works at all is a CSS rule in a different file that nobody has to read: the UA
propagates overflow from `<html>` to the viewport and falls back to `<body>` **only while `<html>`'s
own overflow is `visible`**.

So `html { overflow-x: hidden }` — the most common fix there is for a horizontal-scroll bug on
mobile, and mobile overflow was being worked on in the same round — would have stopped every dialog
in all five apps from holding the page behind it. No error, and the symptom reads as a layout bug:
scroll to the bottom of a long dialog, the wheel chains through to the page underneath, and closing
it drops you somewhere else.

The live defect was the **docstring**, which still described the `<main>` scroller as current and
called body-locking a no-op. On code this load-bearing, a comment describing the previous
architecture is worse than no comment: it invites a "simplification" in either direction.

| | |
| --- | --- |
| **Fix** | The docstring now describes both architectures, says which one does the work today, and names the CSS dependency explicitly |
| **Guard** | **`pnpm scrolllock:lint`** — refuses any `overflow` declaration on an `html` selector in an app's `globals.css`, exempting `@media print`. In `verify` and in CI |

⚠️ The class: **an invariant maintained in one file and depended on in another, with no link between
them.** The lint is the link. Worth asking wherever a fix is "obvious" in one file and load-bearing
in a second.

---

## ☑ 15. A fix reinstated by its own fallback

Class 5 was "health reported without being verified", and one of its fixes replaced
`max(Channel.lastSyncAt)` with a query for the last **successful** `SyncEvent` — because
`Channel.lastSyncAt` is stamped *before* the response is read, so it records that we tried, not that
it worked. A channel failing every five minutes has a very recent one.

The fix shipped with a fallback under it:

```ts
const lastSync = lastSuccessEvent?.createdAt
  ?? channels.map((c) => c.lastSyncAt)...   // ← the exact value the query above removed
```

So for the case that matters most — a channel that has **never once succeeded** — the code fell
straight back to the attempt timestamp and handed it to `syncRecencyHealth`, whose parameter is
named `lastSuccessAt`. It read "Live". The dashboard printed that value under the label **"Last
Successful Sync"**, so the screen asserted something untrue rather than merely being optimistic.

A second instance was live at the same time and had never been fixed at all: the Channel Status
table passed `ch.lastSyncAt` straight in, per channel, and its column header said "Last Sync".

| | |
| --- | --- |
| **Fix** | The fallback is gone — `null` is the honest answer, and `syncRecencyHealth(null)` already returns "Never synced", which is exactly what happened. Safe because `SyncEvent` rows are never pruned; there is no retention job in the repo. The per-channel table now reads a grouped `max(createdAt) where status = success`, one query for all channels, and its column is renamed to match what it shows |
| **Guard** | **`pnpm health:lint` rule 2** — fails on `lastSyncAt` reaching `syncRecencyHealth`, by either shape: passed inline, or assembled through a `??` fallback. It scans `lib/` as well as screens, because the fallback lived in a data loader and rule 1 only ever read `.tsx` |

⚠️ The class: **a correction that leaves the wrong value reachable through a fallback.** The fallback
looks defensive and is the opposite — it restores the old behaviour precisely in the case the fix was
written for. When removing a bad source, check that nothing still falls back to it.

---

## ☑ 16. A guard on the scheduled path, absent from the manual one

The waitlist cron leases `JOB.waitlistSweep` and states the reason plainly: the sweep **sends email
and places holds**, so two runners could act on the same freed room. The CRS's *Check for openings*
button ran the identical `waitlistSweep` with **no lease at all**.

`publicCreateHold` is atomic, so the same room could never be given away twice — the damage sat one
level up. Two concurrent sweeps can pick the same waiting entry for two *different* rooms, hold both,
and email the guest twice; only the second `claimToken` survives the write, so one of those emails
links to nothing while its room stays off sale for the whole offer window.

Found by asking which operations are reachable **two ways**, after the cron's own comment made the
hazard explicit for one of them.

| | |
| --- | --- |
| **Fix** | The button takes the same lease through `withJobLease`. Global rather than per-property, because the cron sweeps every property under one lease and a per-property lease would not serialise against it. Released on completion, so the TTL is only a crash ceiling |
| **Also fixed** | The button reported **nothing at all** on success. Most sweeps legitimately do nothing, so the screen came back identical and an agent could not tell "checked, nothing free" from "the button is broken" — class 7 arriving through a *successful* path rather than an early return. It now says what happened, including that a check was already running |
| **Guard** | `authz-lint` caught the refactor immediately (the wrapper stopped matching its delegation pattern), which is why `sweepWaitlistForm` now states its own `requireCapability` rather than inheriting one a reader cannot see |

⚠️ Still open, same class: **PMS Close Day** — see *Wanted*, above.

---

## How to add to this file

When you fix something and it turns out to be a class rather than an incident:

1. Fix **every** occurrence, not the reported one. (Class 1 was reported once and had five more.)
2. Add the guard — a test if it is logic, a lint if it is a pattern, a CI step if it is invisible
   locally.
3. **Prove the guard fails.** Reintroduce the bug, watch it go red, put it back. A gate nobody has
   seen fail is not a gate; classes 1 and 2 were both verified this way.
4. Add the row here.
