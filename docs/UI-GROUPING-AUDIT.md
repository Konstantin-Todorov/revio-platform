# Grouping review — every screen, every product

**Status: APPROVED by the founder 2026-09-24, not started.**

> "реално така ще трябва да огледаме всички страници във всички софтуери, за да видим дали не трябва
> да се групират и да се преправят подредби на дадени места"

The same finding came up three times in one day — Help (two tabs, every request open), Rooms (floors
set only inside each room's edit panel), RevioCRS Rooms & Rates (one room spread over two cards, one
plan over three). Each was a screen **grouped by kind of data instead of by the thing a person thinks
about**. This review looks for that pattern everywhere, on purpose, instead of waiting for it to be
tripped over.

## The questions, for every screen

1. **What does the person on it think in?** A room, a guest, a stay, a plan, a day. Is the screen
   grouped by that — or by our tables?
2. **Is one thing spread over several places?** (Photos away from their room; a plan's pricing, linkage
   and defaults in three cards.)
3. **Is a thing that exists impossible to find?** (Floors.) Anything reachable only inside an edit
   panel of something else is invisible.
4. **Is it a long scroll of unrelated cards?** Then it may want the Settings shape (sections left,
   content right) — **but not at a front desk queue** (see `apps/pms/CLAUDE.md`: tabs were rejected
   for the folio, correctly; the same reasoning applies to any screen used with a guest waiting).
5. **Is it a list of things with details?** Then list-then-detail (like Your requests), not everything
   open at once.
6. **Is the same concept shaped differently in two products?** One component per concept.

For every finding write: screen · who uses it · what is wrong · proposed shape · decided / not.
**Nothing is rebuilt without the founder's yes** — the review produces proposals, like
`PLAN-ROOMS-RATES-CRS.md`.

## Already done or decided

| Screen | Outcome |
| --- | --- |
| Help + Your requests (all three) | ✅ done 2026-09-24 — Settings shape, list-then-conversation |
| RevioPMS Rooms — floors | ✅ done 2026-09-24 — Floors card + arrange by floor |
| RevioCRS Rooms & Rates | 🟡 approved — `PLAN-ROOMS-RATES-CRS.md` |
| RevioPMS Folio | ✅ decided earlier — one scroll with `Foldaway`, **no tabs** (front desk queue) |
| Settings (all three) | ✅ already the Settings shape |

## The inventory to review

Generated from the route folders on 2026-09-24. Tick each as it is reviewed; link the proposal.

### RevioPMS (`apps/pms`)
- [ ] `/dashboard` (Front Desk) · [ ] `/calendar` · [ ] `/reservation/[id]` · [ ] `/checkin/[id]` ·
  [ ] `/walkin` · [ ] `/move/[id]`
- [ ] `/guests` · [ ] `/guests/[id]` · [ ] `/register`
- [ ] `/folios` · [x] `/folio/[id]` (decided) · [ ] `/invoice/[id]`
- [ ] `/minibar` · [ ] `/minibar/[id]` · [ ] `/minibar/catalog`
- [ ] `/housekeeping` · [x] `/rooms` (floors) · [ ] `/rooms/[unitId]` · [ ] `/maintenance`
- [ ] `/users` · [ ] `/configuration` · [ ] `/closeday` · [ ] `/activity` · [ ] `/search`
- [x] `/help` · [x] `/settings/*`

### RevioCRS (`apps/reservation`)
- [ ] `/dashboard` · [ ] `/reservations` · [ ] `/reservations/[id]` · [ ] `/reservations/new` · [ ] `/waitlist`
- [ ] `/guests` · [ ] `/guests/[id]`
- [ ] `/inventory` · [ ] `/bulk` · [x] `/rooms-rates` (approved plan)
- [ ] `/booking-engine` · [ ] `/distribution` · [ ] `/reports`
- [ ] `/activity` · [ ] `/search` · [x] `/help` · [x] `/settings/*`

### RevioLink (`apps/channel-manager`)
- [ ] `/dashboard` · [ ] `/calendar` · [ ] `/bulk-update` · [ ] `/restrictions` · [ ] `/rooms-rates`
- [ ] `/channels` · [ ] `/mapping` · [ ] `/sync` · [ ] `/errors` · [ ] `/reservations`
- [ ] `/audit` · [ ] `/users` · [ ] `/search` · [x] `/help` · [x] `/settings/*`

Revio Operator is out of scope (ours, and not translated either).

## Suggested order

By how many hotels meet the screen and how often: RevioCRS (with the Rooms & Rates build), then the
RevioPMS screens used with a guest waiting (front desk, reservation view, check-in), then RevioLink.
Each product's review can run alongside its Bulgarian pass — both need every screen opened anyway.
