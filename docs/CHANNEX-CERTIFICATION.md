# Channex PMS Certification — Runbook & Status

> ## ✅ CERTIFIED — production account live (2026-08-24)
>
> The production organisation exists at app.channex.io as **konstantin.todoroff PMS**, plan
> **Standard**, and is currently **empty**: no properties, no channels.
>
> **Billing is per property with at least one active channel — that count is 0**, so nothing accrues
> until a real hotel connects. Creating a property alone does not bill; activating a channel does.
>
> **API key `Revio Platform — production`** was created (all properties, any IP — Railway has no
> stable egress address, so an IP whitelist would break on every redeploy). Verified against
> `GET /api/v1/properties` → HTTP 200. **A Channex key is shown once**; if it is lost, withdraw it and
> create another — that costs nothing.
>
> ### ⚠️ Still to do — the key is not yet stored in the platform
>
> Preferred: **Operator console → Connectivity → Channex production** for the tenant, which encrypts
> it at rest per tenant (`ConnectivityCredential`, `operator_only` RLS).
> Fallback: `CHANNEX_PROD_KEY` on the `channel-manager`, `reservation` and `pms` services — those are
> the three that push ARI. The `jobs` service does not need it; it only calls their HTTP endpoints.
>
> ### No webhooks — deliberately
>
> The integration is **pull-based**: we call Channex on a 5-minute cron and acknowledge each booking
> revision. Channex never calls us, there is no callback URL registered, and adding one would mean a
> new public endpoint with signature verification to maintain for latency nobody has asked for.
> Leave **Property Webhooks** and **Global Webhooks** empty.
>
> ### Nothing else should be created yet
>
> All three tenants in production are **demo** tenants, and the rule in `factory.ts` is explicit:
> *never point a real adapter at demo data*. A production Channex property for a demo hotel would be
> wrong and would eventually bill. The next step belongs to the first real hotel, not to us.


Everything needed to complete the [Channex PMS certification form](https://forms.gle/xA8F3eSYBPBd8apYA)
and get **production** access. Source: Channex "PMS certification tests" (14 scenarios).

> **The one rule that decides pass/fail:** *"If a test cannot be reproduced from your UI (because the
> event is faked by a script), certification fails at the screenshare stage regardless of task IDs
> submitted."* Task IDs pre-fill the form; the **live screenshare** requires each ARI change to come
> from the **RevioLink UI**. See §4 — that wiring (calendar edit → Channex push) is the real gate,
> and the app already has the pieces for it.

---

## 0. Do we need multiple OTA channels? (the common misconception)

**No — Channex PMS certification is about the PMS ↔ Channex API, not OTA connections.** We (RevioLink)
are the PMS: we push ARI to Channex and receive bookings from Channex; Channex fans out to whatever OTAs
the hotel has connected. Of the 14 tests, **only Test 11 involves a channel**, and it accepts either a
**Booking.com test channel** *or* **manual booking creation** — we've done both. Tests 1–10 and 12–14
explicitly say "channel mapping: not required." Connecting real OTAs (each needs that OTA's own
credentials) is a per-hotel step done *after* certification, not a prerequisite.

**Booking.com test channel — connected + mapped (Test 11's channel path):** using Channex's shared test
Hotel IDs (no external creds), a "Booking.com (test)" channel is connected (connection test passed) with
its rooms/rates mapped to ours — Holiday Home→Double Room (rates→Best Available Rate / Breakfast),
Studio→Twin Room (rate→Best Available Rate). It shows "Disabled" until the OTA side accepts the
connection (a shared-test-hotel limitation), but the connection + mapping — what cert checks — are done.

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
- [x] Test 11 booking lifecycle received + acknowledged by the deployed app (§7)
- [ ] Fill the form: task IDs (below — regenerate any time with `pnpm channex:cert`), booking IDs +
      screenshots from the cert property, written answers (§5)
- [ ] Schedule the screenshare and drive every scenario from the RevioLink UI on the cert property

### Task IDs — generated 2026-07-25 (all 10 ARI tests `success:true`)

Paste straight into the matching form fields. Re-run `pnpm channex:cert` for a fresh set if the form is
submitted later (task IDs stay verifiable at `GET /api/v1/tasks/{id}` on staging).

| Test | Task ID |
| --- | --- |
| 1 · Full sync (500 days, 2 rooms, 4 rates — 2 calls) | `0036ea57-a11f-414e-9569-99998399946f` |
| 1 · (second call) | `8487d70e-3524-4532-b84d-34f392983097` |
| 2 · Single date, single rate (Twin/BAR 22 Nov = €333) | `dd0f1e8b-0617-4297-96b8-db3ac0d31e30` |
| 3 · Single date, multiple rates (3 changes, batched) | `2ab4bf60-d317-4783-becf-69d36537418a` |
| 4 · Multi-date, multi-rate ranges (37 rate-days) | `1d99de32-440a-480b-80f2-2f79a5e18b21` |
| 5 · Min-stay (3 combos: 3/2/5 nights) | `72718070-fecc-461c-9887-5ae1dc75f5f6` |
| 6 · Stop-sell (3 pairs) | `14c97c7e-b88e-4523-afb6-5b4c88bc8592` |
| 7 · Multiple restrictions (CTA/CTD/min/max, 20 rate-days) | `ca12c7af-4d74-4c51-b2c7-0b90abd32e30` |
| 8 · Half-year update (Dec 26 → May 27, 364 rate-days) | `52c6e80b-b674-4116-851d-16cefe6a016d` |
| 9 · Single-date availability (Twin 8→7, Double 1→0) | `29b85844-c420-419b-85d3-019ee2b593c0` |
| 10 · Multi-date availability ranges (15 room-days) | `5b9f2697-6d0a-4ba6-9daa-295a6da2ead7` |

---

## 7. Fill-in sheet — every identifier the form and the call need

Verified against production and `packages/connectivity/.env.local` on 2026-08-06. The property UUID
below is the same value stored on the live `Channel.externalPropertyId`, so the sandbox, the runbook
and the running app cannot disagree.

### Environment

| | |
| --- | --- |
| Sandbox API base | `https://staging.channex.io/api/v1` |
| Production API base (after the pass) | `https://app.channex.io/api/v1` — **corrected 2026-08-15 by Channex**; it read `secure.channex.io` before, which was a guess never exercised against a real host |
| Channex property (sandbox) | **`a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9`** — **"Test Property - Revio"**, currency **USD** (renamed + switched 2026-08-06 to match the spec) |

⚠️ **One sandbox item is unresolved: the four rate plans are still EUR.** `PUT /rate_plans/{id}`
accepts a title change and silently ignores `currency`, so it is fixed at creation. The property is
USD; the rate plans are not. Two ways out, and it is a judgement call rather than an engineering one:

- **Leave it.** The rejection rendered our values as dollars (`rate is $125.0`) while the property was
  still EUR, which suggests the grader reads the number and formats it, not the plan's currency.
- **Recreate the four rate plans in USD.** Correct to the letter of the spec, but they get new UUIDs,
  so the RevioLink mappings must be redone and `.env.local` updated.

Check whether the Channex dashboard allows the edit the API refuses before recreating anything — the
UI sometimes permits what the API does not. **Also note `Channel.currency` on RevioLink's cert channel
is still EUR** and should follow whatever is decided, or the push and the property disagree.
| API key | **never written down here.** `CHANNEX_API_KEY` in `packages/connectivity/.env.local` (gitignored); the same value is set on Railway as `CHANNEX_SANDBOX_KEY` on the channel-manager service |

### The certified data model — 2 room types × 2 rate plans

| Room type | Rooms | Channex room-type UUID | Rate plan | Channex rate-plan UUID |
| --- | --- | --- | --- | --- |
| **Double Room** | 6 | `1e2f3c2b-94ca-4ae3-97db-ab0f7748ad9b` | Best Available Rate | `c650ca88-5762-4e93-baf5-d70e744b4d24` |
| | | | **Bed & Breakfast** | `1659e89b-a740-4ba7-8530-44000b24059a` |
| **Twin Room** | 8 | `9a029a40-1629-471a-9e14-dd65c55660b9` | Best Available Rate | `f1413ce8-5094-48fe-8722-6e54c709dc93` |
| | | | **Bed & Breakfast** | `f9501de0-6559-47d5-97a2-4a06cb70fe47` |

### The RevioLink side — what to show on the screenshare

| | |
| --- | --- |
| App | https://channel-manager-production-59bb.up.railway.app |
| Login | `admin@hotelsofia.demo` |
| Property | **Revio Cert Hotel** (mirrors the Channex model exactly) |
| Channel | **Channex Sandbox**, mode `channex_sandbox`, status connected |
| Mappings | 2 room types + 4 rate plans, all `complete` |

Drive every scenario from **this** property's Calendar / Bulk screens. A push from the UI is the whole
point of the call; a scripted event fails certification regardless of the task IDs submitted.

### Not domain-dependent

The integration is **pull-based** — we call Channex, Channex never calls us. There is no webhook and
no callback URL registered anywhere, so moving off the Railway subdomain to `revio.app` changes
nothing about the integration or the certification. The only thing a domain change touches is what the
screenshots and the screenshare happen to show.

### Test 11 — what to put in the form

| Form field | Value |
| --- | --- |
| **Booking ID** | `b5ca82a0-625f-4edc-9d68-bd28e45198f0` |
| **Revision ID · New** | `ba5897ef-10ae-490c-bb6c-2dced37c9db8` |
| **Revision ID · Modified** | `4343c774-6de1-41c3-be38-367c31bf80e1` |
| **Revision ID · Cancelled** | `30912387-7a62-4925-bf15-310546f4e28b` |

OTA code `REVIO-CERT-380239`, guest Maria Ivanova. Final state in RevioLink: **cancelled, 20→23 Aug,
3 nights, €390** — i.e. the modification is reflected, not just the cancellation.

⚠️ **Capture the revision IDs while the script runs.** An acknowledged revision leaves the feed
permanently and `GET /booking_revisions` with a filter is not an endpoint (404) — there is no way to
look one up afterwards. `channex:cert-booking` prints all three, in the window between Channex
publishing each one and RevioLink acknowledging it. The first run of this lifecycle had to be redone
for exactly this reason.

Every revision was received *and acknowledged by the deployed RevioLink itself* over
`GET /booking_revisions` — not by a script.

That distinction is the whole point of `pnpm channex:cert-booking`, which replaced `channex:lifecycle`
for cert purposes. `channex:lifecycle` acknowledges from the script process: it proves the adapter
works, but it consumes the revision so the product never sees it, and leaves nothing to screenshot.
The new script only plays the OTA and asks the deployed app to run its own pull.

**Running it found a real bug, which is exactly what Test 11 is for.** `pullChannel` updated only the
`status` of an existing reservation and discarded everything else, so a modification changed nothing.
Proven, then fixed (`abab428`), then proven again — the two bookings sit side by side on production:

| Booking | | Stay recorded by RevioLink |
| --- | --- | --- |
| `6b71927f…` | before the fix | 2 nights · €240 — **the modification was lost** |
| `f370d52f…` | after the fix | **3 nights · €390** — correct |

It was never only a certification problem: availability is computed from reservation lines, so the
extra night was never taken off the market. The room stayed sellable while a guest had it booked.

### Screenshots to attach

Log into RevioLink as `admin@hotelsofia.demo`, property **Revio Cert Hotel**:

1. **Reservations** — the row for Maria Ivanova, `b5ca82a0…`, showing 20→23 Aug, €390, cancelled,
   acknowledged.
2. **Sync Center** — the pulls at **11:23:04 · 11:23:07 · 11:24:49** reading `1 new`, `1 updated`,
   `1 updated`, all success. That is the create/modify/cancel lifecycle on one screen, which is the
   single most convincing image for this test.

⚠️ **Production also runs the scheduled pull every five minutes**, so the cron can consume a revision
between the script publishing it and the script's own pull. That is harmless — the app receives and
acknowledges either way — but it means the script must not assert "*my* pull counted the change".
It briefly did, and made a correct app look broken. Whether the content landed is a question about
the resulting reservation; check the database, not the pull counters.

### Still to produce

- Optionally a **fresh set of task IDs** (`pnpm channex:cert`) if the form is submitted long after the
  set below was generated. Old ones stay verifiable at `GET /api/v1/tasks/{id}`.

### Process — how contact actually works

1. **Submit the Google form** (link at the top) — that is the entry point; there is no cold email needed.
   It carries the task IDs above, the booking IDs + screenshots (Test 11), and the §5 written answers.
2. **Channex replies and arranges the screenshare** — the call is the real gate. Every scenario must be
   driven live from the RevioLink UI on the cert property; a scripted/faked event fails certification
   regardless of the task IDs submitted.
3. Only **after** a pass do per-hotel steps begin (each hotel's own Channex account/property, their own
   OTA credentials, mapping, and switching that channel `channex_sandbox` → `channex_prod`).
