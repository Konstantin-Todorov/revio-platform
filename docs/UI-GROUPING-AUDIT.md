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
| RevioCRS Rooms & Rates | ✅ built 2026-09-25 — `PLAN-ROOMS-RATES-CRS.md` |
| RevioPMS Folio | ✅ decided earlier — one scroll with `Foldaway`, **no tabs** (front desk queue) |
| Settings (all three) | ✅ already the Settings shape |
| Settings → Guest emails (all three) | ✅ done 2026-09-25 — the founder's reference for the shape: "sections on the left, tabs on top — both are top" |
| RevioPMS Extras & Charges | ✅ done 2026-09-25 — tabs "Charge a guest · Catalog", catalog by outlet, drag to reorder |
| RevioCRS Booking Engine | ✅ done 2026-09-25 — sections Overview · Look (tabs: colours/words/logo · background photo) · Taking payment · Extras; Guest emails and room photos linked |

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
- [ ] `/inventory` · [ ] `/bulk` · [x] `/rooms-rates` (built)
- [ ] `/booking-engine` · [ ] `/distribution` · [ ] `/reports`
- [ ] `/activity` · [ ] `/search` · [x] `/help` · [x] `/settings/*`

### RevioLink (`apps/channel-manager`)
- [ ] `/dashboard` · [ ] `/calendar` · [ ] `/bulk-update` · [ ] `/restrictions` · [ ] `/rooms-rates`
- [ ] `/channels` · [ ] `/mapping` · [ ] `/sync` · [ ] `/errors` · [ ] `/reservations`
- [ ] `/audit` · [ ] `/users` · [ ] `/search` · [x] `/help` · [x] `/settings/*`

Revio Operator is out of scope (ours, and not translated either).

## Where the §8 shape fits — first pass, 2026-09-25 (proposals, nothing built)

Ranked by how much a person scrolls past to reach what they came for today (cards on the page), and
whether the screen is used to *set something up* (the shape fits) or *with a guest waiting* (it does
not — `docs/UI-STANDARD.md` §8).

| Screen | Now | Proposed | Why |
| --- | --- | --- | --- |
| **RevioPMS Configuration** ✅ built 2026-09-25 (7 sections, each its own save) | 8 cards, one scroll: taxes · invoice issuer · housekeeping · end of day · compliance · deposits · invoice series · outlets | Sections on the left: **Money** (taxes, deposits, invoice series, issuer) · **Operations** (housekeeping, end of day) · **Compliance** · **Outlets** | Set up once, touched rarely, and the thing you came for is usually card six |
| **RevioCRS Guest profile** ✅ built 2026-09-25 (Profile · Stays · Notes · Privacy & data) | 6 cards stacked: contact · preferences · during their stay · privacy · notes · booking history | Tabs on top: **Profile** (contact, preferences, privacy) · **Stays** · **Notes** | One guest, three different questions; the history is what staff open it for and it is last |
| **RevioCRS Distribution** | 3 cards: connected channel manager · what reaches channels · channels | Tabs: **Channels** · **What is sent** · **Channel manager** | Three views of one thing; fine today, tabs when the Cost of distribution view joins it |
| **RevioLink Channels + Mapping** — ⏸ founder 2026-09-25: leave separate for now | two screens, a channel's settings on one and its mapping on the other | Sections on the left, **one per channel**; tabs on top: **Connection · Mapping · Sync** | One channel is spread over two screens — the pattern the review exists to catch |
| **RevioLink Sync Center · Error Center · Audit** | three screens | One **Activity** area, tabs: **Syncs · Errors · Changes** | Three views of "what happened", chosen by the question, not the table |
| **RevioLink Bulk update + Restrictions** | two screens | Tabs on one screen: **Change prices & availability · Your rules** | The rules are the standing version of a bulk change |
| **RevioPMS Staff & Access** ✅ built 2026-09-25 (On shift now · Shift history · People & access) | who is on shift, then everyone and their access, one scroll | Tabs: **On shift now · People & roles** | The manager at 7am wants who is in; the owner wants who has access |
| **RevioCRS Rooms & Rates / RevioLink Rooms & Rates** | cards per kind of data | Already planned: `PLAN-ROOMS-RATES-CRS.md` — RevioLink takes the same shape after | — |
| **Dashboards (all three), Front Desk, Folio, Calendar, Housekeeping** | — | **No change** | Used with a guest waiting or read at a glance; tabs would hide what must be seen at once |
| **RevioCRS Analytics** | 23 cards | Already has its own sub-views; review with the Analytics owner rather than here | — |

**Decision needed from the founder:** which of these to build, and in what order. Recommended:
RevioPMS Configuration and the RevioCRS guest profile first (most scrolling, used by every hotel), then
RevioLink Channels + Mapping (the one-thing-in-two-places case), then the rest with each product's
Bulgarian pass.

## Suggested order

By how many hotels meet the screen and how often: RevioCRS (with the Rooms & Rates build), then the
RevioPMS screens used with a guest waiting (front desk, reservation view, check-in), then RevioLink.
Each product's review can run alongside its Bulgarian pass — both need every screen opened anyway.
