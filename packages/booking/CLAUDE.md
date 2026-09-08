# Package: Booking (`@revio/booking`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. Consumed by `apps/booking`
> (**RevioDirect**) and by RevioCRS's own public API routes.

The **guest-facing** half of the reservation domain: everything a stranger with no account can cause
to happen. It was lifted out of the CRS the moment a second caller appeared, because an app may never
import another app's internals.

Every function here is **parameterized by a tenant-scoped Prisma client**. This package never decides
a perimeter — the caller does, and the caller is the only code that knows how it established one.

| File | What |
| --- | --- |
| `public-engine.ts` | Availability, quoting, holds, reservation creation, alternative stays. |
| `slug.ts` | `book.revio.app/<slug>` — generation, reserved words, Cyrillic transliteration. |
| `rate-limit.ts` | Abuse protection for the public surface. |

## The three rules that shaped this

**A quote is never trusted across a request.** `loadStayContext` re-derives the price on every page
and again on submit. A form carries identifiers, never amounts — so a tampered field changes *what is
booked*, not *what is paid*, and a tab left open overnight books today's price.

**A hold must exclude itself.** `loadStayContext(…, { excludeHoldId })` exists because the guest
holding the last room would otherwise be told there is no availability — at the exact moment they
press Confirm. This is the single least obvious thing in the package.

**A room is claimed, never checked-then-taken — at BOTH ends.** `remainingFor(...) < 1` produces the
honest message; `claimHold()` from `@revio/db` is what actually protects the room while a guest is
deciding. Both `publicCreateHold` and `publicCreateReservation` go through it — the latter takes a
claim of its own when the caller has no live hold, so a reservation can never exist without one.
`pnpm --filter @revio/booking engine-race` races that end and asserts it never oversells.

⚠️ **The confirm end needed its own claim, and for weeks did not have one (R1).** A guest who arrives
holding a room skips `claimHold` entirely — correctly, they already own the inventory — so nothing
atomic stood between reading the hold and writing the reservation. Every concurrent confirm read the
hold as active, wrote its own reservation, and the conversion's affected count was discarded. Raced
on a real database, **twelve confirms of one hold produced twelve reservations for one room.**

So **the conversion is the claim**: guest, reservation, extras and the hold's conversion run inside
one `withTenantTransaction`, and `count !== 1` on that `UPDATE … WHERE status = 'active'` throws, so
the losing reservation rolls back instead of surviving as a second booking.
`pnpm --filter @revio/booking confirm-race` races this end.

**Do not "fix" it with an intermediate hold status.** Flipping the hold to `claiming` before writing
the reservation looks like the obvious atomic claim and it *releases the room*: both places that
count a hold against inventory — `loadStayContext` and `claimHold`'s SQL — require
`status = 'active'`. The hold has to stay active right up to the instant it becomes a reservation.

**Hold exhaustion is the real threat, not scraping.** A hold takes a room off sale for its TTL, so an
unthrottled create-hold endpoint is a denial-of-*revenue* attack that looks exactly like a sold-out
weekend. `HOLD_PER_PROPERTY` is the limit that matters — a per-IP cap alone does not survive a
distributed attempt. The limiter is in-memory and fails open on restart, which is the right trade
against a limiter that must have Redis up before a guest can book; the interface does not change when
that moves.

## Boundaries

- **Availability and pricing come from `@revio/core`** — the same waterfall and rate plans the staff
  screens use. There is no guest-side inventory and no sync. That is the product's whole claim.
- A booking writes the **one shared reservation** tagged `source = Direct`, which is why it appears in
  RevioCRS and on the RevioPMS front desk with no integration step.
- **No card handling here.** That is `@revio/payments`, called by the app.
- A slug is **permanent once issued** — it ends up in printed QR codes and Instagram bios. Renaming is
  a deliberate, warned action, never a side effect of editing the property name.
