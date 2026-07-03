# Channex Sandbox — Testing Runbook

How to drive the **real Channex staging sandbox** with our adapter, and test the whole ARI loop
(`push availability/rates → a booking arrives → pull it → acknowledge it`) yourself. Everything here
runs against `https://staging.channex.io` — no production access, no real OTA needed.

> **What Channex is in our architecture:** the connectivity layer between RevioLink and the OTAs.
> RevioLink (us) is the PMS/channel-manager side — we push ARI to Channex and pull bookings from it,
> both via the Channex API with our sandbox key. Channex fans out to Booking.com/Expedia/etc.

---

## 1. What's already set up in the sandbox

Logged into **staging.channex.io** you'll find, under the property **"Revio Test Hotel"**:

| Thing | Value | Where in the UI |
| --- | --- | --- |
| Property | `Revio Test Hotel` (`a1e9b246-…`) | Properties |
| Room type | `Deluxe Double`, 10 rooms, sleeps 2 (`1e2f3c2b-…`) | Rooms & Rates |
| Rate plan | `Standard Rate` (`d20f3885-…`) | Rooms & Rates |
| App | **Booking CRS** installed | Applications → Installed |

The three UUIDs live in `packages/connectivity/.env.local` (gitignored) as `CHANNEX_PROPERTY_ID` /
`CHANNEX_ROOM_TYPE_ID` / `CHANNEX_RATE_PLAN_ID`, alongside `CHANNEX_API_KEY` (the sandbox key, secret)
and `CHANNEX_BASE_URL=https://staging.channex.io/api/v1`.

---

## 2. The three commands (run from the repo root)

```bash
pnpm --filter @revio/connectivity channex:fill    # push 30 days of availability + rates + restrictions
pnpm --filter @revio/connectivity channex:book    # create a test booking, pull it back, acknowledge it
pnpm --filter @revio/connectivity channex:smoke    # minimal 3-day push + pull (quick connectivity check)
```

They read `.env.local` automatically is **not** the case — the scripts read `process.env`. Run them
with the env loaded, e.g.:

```bash
cd packages/connectivity
set -a && . ./.env.local && set +a
pnpm channex:fill
```

### `channex:fill` — proves the PUSH (outbound ARI)
Pushes 30 days starting today: **availability 8** (of 10 — 2 held back so overbooking is demonstrable),
**€120 weekday / €150 weekend** rates, **min-stay 2 on weekends**. This is the exact `pushAri` path
RevioLink uses in production, against the live sandbox.

**See it:** staging.channex.io → **Inventory** tab. The `AVL` row shows `8` and the `RATE` row shows
`120`/`150`. (Before the fill it's all `0`.)

### `channex:book` — proves the PULL + ACK (inbound bookings)
1. Creates an `Offline` test booking (Ivan Petrov, 2 nights, €240) via the **Booking CRS API**
   (`POST /api/v1/bookings`).
2. Pulls it back through **our** `ChannexChannelAdapter.pullReservations` — the production path — and
   prints it normalized: `Ivan Petrov  240.00 EUR  2026-07-06→2026-07-08 ×1`.
3. **Acknowledges** the booking revision (`POST /api/v1/booking_revisions/:id/ack`) so Channex stops
   re-sending it (it re-delivers unacked bookings for 30 min, then emails a warning).

**See it:** staging.channex.io → **Bookings** tab. Your booking is listed with a **green tick in the
"Acked" column**. (You can also click **"New booking"** there to make one by hand.)

---

## 3. What this proved (and a real bug it caught)

- ✅ **Push works** — availability, rates and both restriction types (min-stay, weekend) land correctly.
- ✅ **Pull works** — a booking made on Channex comes back through our adapter, fully parsed.
- ✅ **Acknowledge works** — revisions are acked; no duplicate re-delivery.
- 🐞 **Bug found & fixed by this live test:** Channex returns bookings as JSON:API resources
  (`{ id, attributes: { customer, amount, rooms, … } }`). Our mapper read those fields at the top
  level, so pulled bookings came back as *"Channel Guest / €0.00"*. Fixed `toRawReservation` to unwrap
  `attributes` and derive stay nights from each room's `days` map (Channex omits check-in/out on the
  room). Covered by new unit tests in `channex-mappers.test.ts`. **This is exactly why we test against
  the real sandbox and not just mocks.**

---

## 4. Where the code lives

```
packages/connectivity/
  src/channex-channel-adapter.ts   pushAri · pullReservations · acknowledgeBooking · HTTP
  src/channex-mappers.ts           domain ARI ↔ Channex rows; Channex booking → RawReservation
  scripts/channex-setup.ts         one-shot: create Property + Room Type + Rate Plan (already done)
  scripts/channex-fill.ts          the 30-day ARI push
  scripts/channex-test-booking.ts  create → pull → acknowledge a test booking
  scripts/channex-smoke.ts         minimal push + pull
```

It is **not yet wired into the RevioLink app UI** — these scripts exercise the adapter directly. In the
app, a channel's `connectivityMode` (`mock` | `channex_sandbox` | `channex_prod`) selects the adapter,
and the per-tenant encrypted key is resolved server-side; demo channels stay on the mock.

---

## 5. Certification status (staging → production access)

Channex grants production access after **PMS certification**: 14 scenarios run from our real UI against
this sandbox. Where we stand:

| Requirement | Status |
| --- | --- |
| Push availability / rates / restrictions | ✅ working (`channex:fill`) |
| Pull bookings | ✅ working (`channex:book`) |
| Acknowledge booking revisions | ✅ working (`acknowledgeBooking`) |
| Full sync = 500 days in ≤ 2 API calls | ⬜ our push batches per day-range; needs a bulk path |
| Delta-only pushes (no timer-based full syncs) | ⬜ auto-push currently resends the whole window |
| Rate-limit compliance | ⬜ add backoff / batching |
| Booking-revision **feed** (`/booking_revisions/feed`) | ⬜ we pull via `/bookings`; the feed is the certified path |

The first three are done. The rest are the connectivity-layer gaps to close before scheduling the
certification call — none of them block testing on staging, which is fully working today.
