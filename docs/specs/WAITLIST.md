# Waitlist — capturing demand a sold-out date currently throws away

> Programme: `docs/IDEAS-1CLUB-2026-09.md` item 1. Products: **RevioDirect** (capture) +
> **RevioCRS** (management). Entitlement: `hasReservation`.

## The problem, stated plainly

A guest searches for dates we cannot sell. Today RevioDirect does something good — it re-quotes real
**alternative stays** from the same availability engine — and then the demand is gone. If a
reservation is cancelled an hour later, the room goes back on sale and **nobody is told**.

That is not a missing feature so much as a leak: the hotel has already paid (in ad spend, in brand,
in the guest's attention) to bring somebody to those dates.

## Why we can build this cheaply

Every primitive exists already. This is assembly, not invention:

| Need | What we already have |
| --- | --- |
| Is the room free now? | `computeWaterfall` in `@revio/core` — the one source of truth |
| Reserve it briefly so an offer is real | `Hold` + `PropertyDefaults.holdTtlMinutes` |
| Expire an unclaimed offer | the hold-expiry job (`POST /api/jobs/holds`, lazy + CRON_SECRET) |
| Tell the guest, as the hotel | `sendTemplatedEmail` + per-hotel branding |
| Keep it tenant-safe | `tenantId` + `tenant_isolation` RLS on every new row |
| Write it atomically | `withTenantTransaction` in `@revio/db` |

## The model

```
WaitlistEntry
  id, tenantId, propertyId
  roomTypeId    String?   -- null = "any room that sleeps my party"
  checkIn, checkOut       -- calendar dates, property timezone
  guests        Int
  guestName, guestEmail, guestPhone?
  locale        String?   -- so the emails arrive in the language they searched in
  status        String    -- waiting | offered | converted | expired | cancelled
  createdAt               -- position in the queue IS this, ascending
  offeredAt     DateTime?
  offerHoldId   String?   -- the real Hold backing the current offer
  offerExpiresAt DateTime?
  offerCount    Int       -- how many times this entry has been offered and lapsed
  source        String    -- booking_engine | staff
```

⚠️ **Position is derived from `createdAt`, never stored.** A stored position has to be renumbered on
every insert, cancel and conversion, and the first time that renumbering is wrong somebody is told
they are second when they are fourth.

## How an offer works — and the race it avoids

When availability appears for a waited stay, the naive move is to email everybody who wanted it.
That produces a race: five guests click, one gets the room, four are told it has gone **after being
told it was available**. That is worse than never writing to them.

So an offer is **sequential and backed by a real hold**:

1. Availability appears for `(roomType, checkIn..checkOut)`.
2. Take the **oldest** `waiting` entry that the availability actually satisfies.
3. Place a real `Hold` for it — the same mechanism the booking engine uses — for
   `PropertyDefaults.holdTtlMinutes` (default 30). The room is genuinely off sale for that window.
4. Email *Your room is available* with a **magic link** carrying the entry id and hold id. Status →
   `offered`, `offerExpiresAt` set.
5. If they book, status → `converted`.
6. If the hold expires, release it, status → `expired` for that round, `offerCount++`, and **offer to
   the next entry**. The email says the offer lapsed.

⚠️ **The hold is the point.** Without it "available" is a guess by the time the guest reads it. With
it, the promise is true for a stated number of minutes — and because it is the *existing* Hold, it is
already subtracted by `computeWaterfall`, already pushed to channels, and already cleaned up by the
expiry job. Nothing new has to be taught about it.

⚠️ **An offer must never outlive the stay.** If `checkIn` is tomorrow and the TTL is 30 minutes, that
is fine; if `checkIn` has passed, the entry expires without an offer. Check the property's timezone,
not the server's.

## What counts as "availability appeared"

Every path that raises the waterfall, and they are all existing writes:

- a reservation is **cancelled** or marked **no-show** (CRS, PMS, or a channel pull)
- a **hold expires** without converting
- an **OOO / closure period** is deleted (PMS maintenance or housekeeping returns a unit)
- **physical inventory** is increased on a room type
- a channel pull imports a **cancellation**

Rather than hook six call sites, the check runs in one place — a `waitlistSweep` job — triggered
**lazily** on the pages that already trigger the hold-expiry sweep, plus `POST /api/jobs/waitlist`
under `CRON_SECRET` for the scheduler when it lands. One implementation, one place to reason about.

⚠️ Do **not** offer inside the cancellation transaction. A cancellation must not fail because an
email provider is having a bad minute — the same rule `@revio/email` already states for
confirmations.

## Matching rules

- An entry with `roomTypeId = null` matches **any** room type whose `maxGuests >= guests`.
- An entry with a `roomTypeId` matches only that room type.
- The whole stay must be available for **every night** — `computeWaterfall` over the range, not the
  first night. A partial match is not an offer; it is a disappointment with a link on it.
- Never offer a room the property has **stop-sold** for those dates. Stop sell is a decision, and a
  waitlist that ignores it sells rooms the hotel deliberately withdrew.

## Guest-facing surface (RevioDirect)

On the sold-out screen, **beside** the alternative stays rather than instead of them — alternatives
convert today, a waitlist converts maybe:

> **Nothing free on those dates.** We can tell you if something opens up.
> `[ email ] [ Tell me if a room opens ]`

Honest states, no invented reassurance:
- On join: *"You're on the list. If a room opens for 14–17 Aug we'll email you — you'll have 30
  minutes to book it before we offer it to the next person."*
- We never say "you are number 3" publicly. The queue is real but the number moves for reasons a
  guest cannot see, and a number that goes **up** reads as a bug.

## Staff surface (RevioCRS)

A **Waitlist** screen next to Reservations:

- Rows: guest, dates, room type or *Any*, party size, waiting since, status, offers made
- Filters: `Waiting · Offered · Converted · Expired`, with **live counts as tabs** (P2 item)
- Actions: **Offer now** (manual jump — a call-centre agent talking to the guest), **Remove**
- One number worth showing at the top: **rooms recovered this month, and their value** — because that
  is the sentence that justifies the feature on a renewal call

## Emails — three new templates

Added to `EMAIL_TEMPLATES` in `packages/core/src/email/templates.ts`, EN + BG, per-hotel branded and
switchable like every other:

| key | When | `canDisable` |
| --- | --- | --- |
| `waitlist_joined` | on join — confirms the dates and states the 30-minute rule | ✅ |
| `waitlist_offer` | a room opened — **the one with the deadline and the link** | ❌ never |
| `waitlist_expired` | the offer lapsed, still on the list | ✅ |

⚠️ `waitlist_offer` cannot be switched off. An offer email is the only thing that makes the hold
meaningful; a hotel that disables it would silently take rooms off sale for nobody.

## Metrics

`packages/core/src/metrics/` gains waitlist conversion, so the CRS dashboard and the Operator upsell
read the **same** function — the rule that already keeps the quote and the push from disagreeing:

- entries, offers made, offers converted, **conversion rate**
- **revenue recovered** = accommodation value of converted entries
- median time from join to offer

## Build order

1. **`packages/core/src/waitlist/`** — pure: `matchesEntry`, `nextOfferable`, `offerExpiry`,
   `describePosition`. Tested first, because the matching rules are where the judgement lives.
2. Migration: `WaitlistEntry` + `tenant_isolation` RLS + indexes on `(propertyId, status)` and
   `(propertyId, checkIn)`.
3. The three email templates (EN + BG).
4. `waitlistSweep` in `@revio/booking` or `@revio/core`, parameterised by a tenant-scoped Prisma
   proxy — the same shape as `@revio/connectivity`'s `sync.ts`, so the caller owns the perimeter.
5. RevioDirect capture + the magic-link claim route.
6. CRS Waitlist screen.
7. Metrics + the operator's recovered-revenue line.

## Open questions for the founder

- **Offer TTL**: reuse `holdTtlMinutes` (30) or a separate, longer window? An email offer is not a
  live checkout — a guest may be asleep. My instinct is a **separate, longer TTL** (e.g. 4 hours),
  configurable, because 30 minutes optimises for the wrong failure.
- **Max offers per entry** before we stop pestering — suggest 3.
- Should a waitlist entry **expire** on its own after the check-in date passes, or be kept for
  reporting? Suggest: status `expired`, kept, because "how much demand did we fail to serve" is a
  number a revenue manager wants.
