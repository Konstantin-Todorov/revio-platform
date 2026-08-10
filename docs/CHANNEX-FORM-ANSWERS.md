# Channex certification form — the answers

Everything to paste, in the form's own order. **Derived from what the code emits, not written from
memory** — the previous submission failed Test 5 because the Extra Notes said one thing
(`no Min Stay support`) and the integration sent another (`min_stay_arrival`, `min_stay_through`).

> Verify each claim below against `packages/connectivity/src/channex-mappers.ts` before submitting.
> If the code changes and this file does not, we are back to the failure we already had.

---

## Pre-flight checklist — answer "yes" with file paths

**1. When a user saves a price change in your PMS UI, does your code emit a domain event your
integration observes?**

Yes. A calendar edit calls `saveCell` → `recordPush(..., scope)` →
`syncRealChannels(propertyId, scope)` → `syncChannel`.
`apps/channel-manager/lib/actions-calendar.ts` · `apps/channel-manager/lib/mutation-helpers.ts` ·
`packages/connectivity/src/sync.ts`.
The same path is triggered by RevioCRS and RevioPMS writes (`apps/reservation/lib/mutation-helpers.ts`,
`apps/pms/lib/mutation-helpers.ts`), so a booking taken in any product reaches Channex without a
manual sync.

**2. Do you have an outbox/queue between PMS and Channex, or does code call the API directly?**

Direct calls, through a **serialised, throttled adapter** rather than an outbox.
`ChannexChannelAdapter.schedule()` in `packages/connectivity/src/channex-channel-adapter.ts` runs
every request through one promise chain with a minimum gap (`minRequestGapMs`, default 250ms), so
requests can never overlap or burst. Push failures never block the user's write — they are caught in
`syncRealChannels`, recorded as a `SyncEvent` and surfaced in the Sync Center and Error Center.

*Stated plainly rather than dressed up: a durable outbox would survive a process restart mid-push and
this does not. It is on our roadmap; today a failed push is visible and re-runnable from the UI.*

**3. If Channex returns 429, does retry logic back off or silently drop updates?**

Neither silently. The rate limiter is preventive — one in-flight request at a time with a 250ms floor
(≈4 req/s), plus batching that keeps a 500-day full sync to 2 calls. A non-2xx response (including
429) returns `{ ok: false, error }` from the adapter, which `syncChannel` records as a failed
`SyncEvent` plus an `ErrorItem` per rejected update. Nothing is dropped without a visible trace, and
the push is repeatable from the Sync Center.

**4. Where in your codebase does `POST /availability` get called from?**

`ChannexChannelAdapter.pushAvailability()` —
`packages/connectivity/src/channex-channel-adapter.ts`. Its only caller is `pushAri()`, called from
`syncChannel()` in `packages/connectivity/src/sync.ts`. One path, no other call sites.

**5. If you deleted all certification test code, would your PMS still push updates correctly?**

Yes. The integration is `packages/connectivity` and is called by the products' own server actions.
The scripts under `packages/connectivity/scripts/` are diagnostics only; deleting them changes no
behaviour.

*This is the question we failed in spirit last time — the integration was real, but the task IDs we
submitted came from a script. Every task ID in this submission comes from an action performed in the
RevioLink UI.*

---

## Test 12 — Rate limits

> *Can you stay in rate limits?*

Yes. All Channex requests are serialised through a single promise chain with a minimum 250ms gap
(≈4 req/s) — `ChannexChannelAdapter.schedule()`. Pushes are additionally batched: an edit of any size
produces at most one `/restrictions` call and one `/availability` call, so a 500-day full sync is 2
requests rather than 1,000.

---

## Test 13 — Update logic

> *Do you agree to only send updated changes to Channex?*

Yes. Pushes are **delta, event-driven**: `PushScope` (`packages/connectivity/src/sync.ts`) carries the
dates, room types, rate plans and fields a user actually edited, and the push contains only those. A
price change on one date sends one date's rate.

Full sync is a **manual action**, never a timer, and we will keep it to at most once per 24h
off-peak.

⚠️ **One clarification to avoid a misreading:** we run a scheduled job every 5 minutes, but it is a
**booking PULL** (`GET /booking_revisions`), not an ARI push. It sends no availability or rates.

---

## Test 14 — Extra notes

**1. Do you support both Min Stay Through and Arrival? If only one, specify which.**

**Both.** `toRestrictionValue` sets `min_stay_arrival` and `min_stay_through` together from our
single `minLos` value, so the two are always equal. We do not currently model them independently — if
a hotel needs a different arrival minimum from a through minimum, we would send the same number for
each.

*This is the answer that was wrong last time and caused the Test 5 failure.*

**2. Which restrictions do you NOT support?**

We send: `rate`, `min_stay_arrival`, `min_stay_through`, `max_stay`, `closed_to_arrival`,
`closed_to_departure`, `stop_sell`, and availability.

Not supported: **advance purchase** (min/max days before arrival). We model it internally, but Channex
has no equivalent field, so rather than dropping it silently we surface it as a rejection in our Error
Center — `unsupportedReason()` in `packages/connectivity/src/channex-mappers.ts`.

**3. Do you support multiple room types and multiple rate plans per room type?**

Yes. Mapping is two-stream — room types and rate plans map independently
(`ChannelRoomTypeMapping` / `ChannelRatePlanMapping`), and a product is sendable when both are
mapped. The certification property runs 2 room types × 2 rate plans = 4 rate plans.

**4. Do you require credit card details with bookings?**

No. We accept bookings without card details.

**5. Are you PCI Certified or use a PCI service?**

We do not handle card data. RevioLink stores no card fields at all; where the wider platform takes a
card guarantee it uses **Stripe** (test mode today) and stores only a gateway token plus brand and
last-4 — never a PAN, CVV or expiry. **PCI DSS is therefore not applicable to the ARI integration.**

---

## Tests 1–11 — task IDs

Filled in from the UI drive. **Do not paste an ID that has not been through the verifier** — see
`CHANNEX-CERTIFICATION.md` §7 and `packages/connectivity/src/cert-expectations.ts`.

| Test | Field | Task ID |
| --- | --- | --- |
| 1 | Availability (500 days, all rooms) | |
| 1 | Rates & restrictions (500 days, all rates) | |
| 2 | Single date, single rate | |
| 3 | Single date, multiple rates | |
| 4 | Multiple dates, multiple rates | |
| 5 | Min stay | |
| 6 | Stop sell | |
| 7 | Multiple restrictions | |
| 8 | Half-year | |
| 9 | Single date availability | |
| 10 | Multiple date availability | |

⚠️ **Test 1 has two fields and they are easy to swap.** A rates payload in the availability field is
exactly what produces *"expected exactly one Availability update, found 0"* — the failure we got. The
Sync Center now prints each id labelled (`rates task … · availability task …`) so the label travels
with the number; copy them from there, not from a script's output order.

### Test 11 — bookings ✅ already passed

| | |
| --- | --- |
| Booking ID | `b5ca82a0-625f-4edc-9d68-bd28e45198f0` |
| Revision · new | `ba5897ef-10ae-490c-bb6c-2dced37c9db8` |
| Revision · modified | `4343c774-6de1-41c3-be38-367c31bf80e1` |
| Revision · cancelled | `30912387-7a62-4925-bf15-310546f4e28b` |

Screenshots: RevioLink → **Revio Cert Hotel** → Reservations (Maria Ivanova, 20→23 Aug, $390,
cancelled) and Sync Center (the three pulls reading `1 new` · `1 updated` · `1 updated`).
