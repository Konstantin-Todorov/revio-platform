# Channex PMS Certification — Runbook & Status

Everything needed to complete the [Channex PMS certification form](https://forms.gle/xA8F3eSYBPBd8apYA)
and get **production** access. Source: Channex "PMS certification tests" (14 scenarios).

> **The one rule that decides pass/fail:** *"If a test cannot be reproduced from your UI (because the
> event is faked by a script), certification fails at the screenshare stage regardless of task IDs
> submitted."* Task IDs pre-fill the form; the **live screenshare** requires each ARI change to come
> from the **RevioLink UI**. See §4 — that wiring (calendar edit → Channex push) is the real gate,
> and the app already has the pieces for it.

---

## 1. The certification sandbox (built + verified)

Property **"Revio Test Hotel"** on staging.channex.io, now at the exact cert data model:

| | Channex object | rooms |
| --- | --- | --- |
| Room type 1 | **Double Room** | 6 |
| Room type 2 | **Twin Room** | 8 |
| Rate plans | **Best Available Rate** + **Breakfast** on *each* room = **4 rate plans** | |

Build/rebuild it (idempotent) with:
```bash
cd packages/connectivity && set -a && . ./.env.local && set +a
pnpm channex:cert-setup     # creates/renames to 2 room types × 2 rate plans, prints all ids
```
The ids are stored in `.env.local` (gitignored): `CHANNEX_{DOUBLE,TWIN}_ROOM_ID`,
`CHANNEX_{DOUBLE,TWIN}_{BAR,BREAKFAST}_ID`.

---

## 2. Tests 1–10 (ARI) — automated, task IDs produced

```bash
pnpm channex:cert            # runs all 10 scenarios via our adapter, prints Channex task ids
```
Every scenario uses the same adapter methods RevioLink uses in production
(`pushRatesAndRestrictions` / `pushAvailability`), over the 2×4 model. Each push returns a Channex
**task id** — paste it into the matching form field.

| # | Test | Our call | Result |
| --- | --- | --- | --- |
| 1 | Full sync — **500 days, 2 rooms, 4 rates, ≤2 calls** | 1 restrictions + 1 availability call (2000 rate-days) | ✅ both tasks `success:true` |
| 2 | Single date, single rate (Twin/BAR 22 Nov = €333) | 1 restrictions call | ✅ |
| 3 | Single date, multiple rates (3 changes) | 1 batched call | ✅ |
| 4 | Multi-date, multi-rate ranges | 1 call | ✅ |
| 5 | Min-stay (3 combos: 3/2/5 nights) | 1 call | ✅ |
| 6 | Stop-sell (3 pairs) | 1 call | ✅ |
| 7 | Multiple restrictions (CTA/CTD/min/max) | 1 call | ✅ |
| 8 | Half-year update (Dec 26 → May 27) | 1 call | ✅ |
| 9 | Single-date availability (Twin 8→7, Double 1→0) | 1 availability call | ✅ |
| 10 | Multi-date availability ranges | 1 call | ✅ |

Verify any task landed: `GET /api/v1/tasks/{id}` → `attributes.success: true, errors: []`, or open the
**Inventory** tab (the calendar shows the pushed rates/availability with realistic variation).

---

## 3. Test 11 (bookings) — full lifecycle over the certified feed ✅

The **Booking CRS** app is installed (enables offline test bookings). The whole lifecycle runs over the
certified **`GET /booking_revisions/feed`** (not the legacy `/bookings`), acknowledging each revision:
```bash
pnpm channex:lifecycle       # create → feed(new) → ack → modify → feed(modified) → ack → cancel → feed(cancelled) → ack
pnpm channex:book            # simpler: create → pull → acknowledge (green "Acked")
```
✅ **Receive / modify / cancel / acknowledge** all verified live. The adapter exposes `pullRevisions()`
(feed) + `acknowledgeBooking(revisionId)`; **RevioLink's own pull uses the feed** — the CM `pullChannel`
prefers `pullRevisions` and acks every revision (verified: app Pull imported a booking and the feed went
empty). For submission the cert wants **booking IDs + screenshots of the bookings in RevioLink** — drive
this from the cert property (§4), whose channel is connected to the sandbox.

---

## 4. What still blocks a live pass — wire the adapter into the RevioLink UI

Tests must be **reproducible from our UI** at the screenshare. The plumbing already exists in the CM:
`Channel.connectivityMode` (`mock | channex_sandbox | channex_prod`), `syncChannel` / `pullChannel`,
the two-stream mapping tables (`ChannelRoomTypeMapping` / `ChannelRatePlanMapping`), and a per-tenant
encrypted key with `CHANNEX_SANDBOX_KEY` env fallback. Remaining wiring for certification:

1. On a RevioLink property that mirrors the cert model (a "Double Room" + "Twin Room", each with BAR +
   Breakfast), add a Channel in **channex_sandbox** mode with `externalPropertyId` = the Channex
   property UUID.
2. **Map** RevioLink's 2 room types → the Channex room-type UUIDs and 4 rate plans → the Channex
   rate-plan UUIDs (§1 ids).
3. Set `CHANNEX_SANDBOX_KEY` on the channel-manager Railway service (value is in `.env.local`).
4. Then editing a rate/availability/restriction in the RevioLink calendar pushes live to Channex — each
   cert scenario becomes a real UI action. Record the task id the app surfaces in the Sync Center.

Until then, `channex:cert` proves the adapter is correct and produces the task IDs, but the screenshare
needs steps 1–4.

---

## 5. Tests 12–14 — written answers for the form

- **12 · Rate limits:** ✅ the adapter has a **built-in rate limiter** — every request is serialized
  through one queue with a minimum gap (`minRequestGapMs`, default 250ms ≈ ≤4 req/s), so we never burst.
  Pushes are also batched into ≤2 calls per change.
- **13 · Update logic:** we send **delta updates on edit** (event-driven). Full sync is a manual/periodic
  action, not a timer. *Confirm in the form:* full-sync ≤ once per 24h off-peak.
- **14 · Extra notes:** we support **min-stay (arrival + through)**, **CTA/CTD**, **stop-sell**, **max-stay**,
  **multiple room types & rate plans**. Advance-purchase has **no Channex equivalent** → surfaced as a
  rejection (Error Center). No card handling in the CM (labels only) → **PCI: not applicable** to ARI.

---

## 6. Open items before scheduling the cert call

- [x] Wire the RevioLink channel → sandbox + map rooms/rates (§4) — done ("Revio Cert Hotel", verified
      live: a UI Re-sync pushed 56/56 to Channex, task success)
- [x] Booking **modify + cancel** + switch pull to the `/booking_revisions` feed (§3)
- [x] Rate-limit queue (§5.12)
- [ ] Fill the form: task IDs (`pnpm channex:cert`), booking IDs + screenshots from the cert property,
      written answers (§5)
- [ ] Schedule the screenshare and drive every scenario from the RevioLink UI on the cert property
