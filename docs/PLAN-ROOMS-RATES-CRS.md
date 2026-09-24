# RevioCRS → Rooms & Rates: grouped by what the hotel thinks about

**Status: APPROVED by the founder 2026-09-24, BUILT 2026-09-25** (steps 1–5; step 6, Bulgarian, comes
with the RevioCRS translation). Built as written, with three details decided while building: the old
addresses (`/rooms-rates`, `/rates`, `/setup`) redirect in `next.config.mjs` rather than in a page (a
page redirect runs after the layout has started streaming and threw a React hook error); "Add" asks
only the basics and then opens the new room's or plan's page; the plan form posts no `priceLogic`, so
saving a plan's name or defaults never touches where its price comes from. RevioCRS only for now; RevioLink's Rooms &
Rates stays as it is until the grouping review (`docs/UI-GROUPING-AUDIT.md`) reaches it.

## The problem, in the founder's words

> "там имаме типове, имаме снимки, ценови и още други… не са ли много откачени от всичко снимките"

Today `/rooms-rates` is one long page of six cards, split by **kind of data**:

1. Room types & physical counts
2. Room photos — every room type's gallery, in a card of its own, far from the room it belongs to
3. Rate plans — defaults (min/max stay, advance purchase), tags, direct-channel flag
4. How each plan prices — per room / per person, primary occupancy
5. Rate plan linkage — derived plans, parent, offset, rounding
6. Out-of-order & closure periods

A hotelier does not think "the photos section". They think **"the Deluxe"** and **"the breakfast
plan"**. One room is spread over cards 1 and 2 (plus a dialog for its description, size, beds and
amenities); one plan is spread over cards 3, 4 and 5.

## The decision: the Settings shape, AND regrouped by object

Just putting the six cards in a side nav would keep them split by kind of data. So both changes:

```
Rooms & Rates
├─ Room types        list → one room type, everything about it on one page
├─ Rate plans        list (derived plans nested under their parent) → one plan, everything about it
└─ Closures          the out-of-order & closure periods, as today
```

The frame is the one Help already uses (`HelpFrame` / `SettingsNav` with `prefix`), so the hotel meets
the same shape in Settings, Help and here. The list-then-detail inside a section is the same as
Your requests (`RequestsView`): list, and the picked one on the right on wide screens; two screens
with a way back below `xl`.

### Room types — `/rooms-rates/rooms` and `/rooms-rates/rooms/<id>`

**List row:** cover photo (the first photo) · name · code · physical count · sleeps N · photo count ·
a quiet warning when something a guest sees is missing (no photo, no description).

**One room type, top to bottom — the order a listing is read in:**
1. **The basics** — name, code, unit kind, physical count, max guests, default occupancy, active.
2. **What a guest reads** — description, size m², bed setup, amenities (the 35 curated chips).
3. **Photos** — the gallery for THIS room, upload / reorder / cover, exactly `PhotoGallery` today.
4. **Sold on** — the rate plans that sell this room (links to them), so "which prices apply to this
   room" is answered here instead of by elimination.
5. Delete (guarded as today — `?blocked=` when something depends on it).

This is the shape of the Booking.com extranet and of Airbnb's listing editor: a room owns its photos
and its description. Borrowing it is the UI standard's first rule.

### Rate plans — `/rooms-rates/plans` and `/rooms-rates/plans/<id>`

**List:** a tree — each derived plan indented under the plan it takes its price from, with its offset
("Standard −10%"). This replaces the separate Linkage card: the linkage is visible in the list itself.
Row shows: name · code · per room / per person · direct or OTA/corporate only · active.

**One plan:**
1. **The plan** — name, code, tags, active, bookable on the direct channel.
2. **How it prices** — per room or per person, primary occupancy (today's pricing board, for one plan).
3. **Where its price comes from** — own prices, or derived from a parent with offset and rounding
   (today's linkage board, for one plan; the same cycle/recalc/precedence guardrails).
4. **Defaults** — min / max stay, advance purchase, used when a date has no rule of its own.
5. **Rooms it sells** — links back to the room types.

### Closures — `/rooms-rates/closures`
The out-of-order & closure periods card, unchanged. Rooms taken out of order in RevioPMS still show
here, read-only, as today.

## What must not change

- **One record rule.** These are the same shared-core rows RevioLink edits. Two edit surfaces, never
  two tables that sync.
- **Every existing write stays** — `lib/actions-rates.ts`, `actions-inventory.ts`, the photo actions.
  This is a re-arrangement of screens, not of data.
- **Links that exist keep working:** `/rooms-rates` (dashboard "Rooms available", Inventory, Bulk,
  the sidebar, `?blocked=`), `/rates` and `/setup` (already redirect here). `/rooms-rates` lands on
  Room types; `?blocked=<plan>` lands on that plan.
- Dialogs used elsewhere (`RatePlanDialog`, `RoomTypeDialog` for "add") keep working; editing moves
  onto the detail pages.

## Order of work

1. Frame + sections + `/rooms-rates` → `/rooms-rates/rooms` redirect, links kept.
2. Room type list and detail (photos move in). Look at it with real photos.
3. Rate plan tree and detail (pricing + linkage move in). Check a derived plan and a cycle refusal.
4. Closures.
5. Remove the old six-card page. `pnpm verify`, look at every section at phone width, production check.
6. Bulgarian comes with the RevioCRS translation pass, in the same strings pattern as RevioPMS.
