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

## ◐ 5. Health reported without being verified

The theme of all three September founder documents, and the same shape as the Channex 401 incidents:
a green pill over a channel that last synced 65 days ago, "Queue empty" above a queue of ten,
`0 Failed Syncs · Clear` where nothing was attempted, `100%` beside 25 open errors.

> ⚠️ **A zero from success and a zero from silence must never render the same.**

| | |
| --- | --- |
| **Fix** | `@revio/core/metrics/sync-health.ts` — five states, including `idle` (never ran) and `unknown` (nothing attempted), which are the two screens kept collapsing into green |
| **Guard** | **25 tests**, shared by RevioLink and Operator so the two cannot disagree |
| **Why ◐** | the module exists and is used, but nothing *stops* a new screen inventing its own green. See "Wanted" below. |

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

⚠️ **Next**: a repair path that creates only the missing products against the existing Channex
property, matching by title first so it cannot duplicate — the same guard provisioning already uses.

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

- **☐ Health invented per screen (class 5).** `sync-health.ts` is correct and shared, but nothing
  fails when a new screen hardcodes a green pill. A lint for status/health literals rendered without
  going through the module would close it.
- **☐ Two onboarding paths.** The in-app button and `scripts/channex-onboard.ts` both exist; both are
  guarded now, but one should probably go — two paths is two places for the next gap.

---

## How to add to this file

When you fix something and it turns out to be a class rather than an incident:

1. Fix **every** occurrence, not the reported one. (Class 1 was reported once and had five more.)
2. Add the guard — a test if it is logic, a lint if it is a pattern, a CI step if it is invisible
   locally.
3. **Prove the guard fails.** Reintroduce the bug, watch it go red, put it back. A gate nobody has
   seen fail is not a gate; classes 1 and 2 were both verified this way.
4. Add the row here.
