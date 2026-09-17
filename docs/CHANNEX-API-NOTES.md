# Channex API — what it does, what it refuses, and what we have not asked it for

Everything here was **verified against the live API on 2026-09-17**, not read from documentation.
Where a claim came from a probe, the probe is described so it can be repeated.

> ⚠️ Every mistake in this file failed the same way: **a 200 that was wrong**. Not one of them threw,
> logged, or turned a pill red. That is the class to test for.

---

## The four that cost us a day

### 1. Every collection paginates, and the wrong parameter is silently ignored

`pagination[page]` and `pagination[limit]`. Default page size **10**.

`page[page]`, `page[limit]`, `page`, `limit` are all accepted with **HTTP 200 and ignored** — the
response comes back looking healthy, still on page 1, still capped at 10.

```
GET /rate_plans?filter[property_id]=…            → 10 rows, meta {"total":12,"limit":10,"page":1}
GET /rate_plans?filter[property_id]=…&page[limit]=100  → 10 rows, meta unchanged   ← silently ignored
GET /rate_plans?filter[property_id]=…&pagination[limit]=100 → 12 rows, meta {"limit":100}
```

Cabacum Beach Residence has 12 rate plans and this platform saw 10 of them for weeks. Trust
`meta.total`, never `data.length`.

**Affected and fixed:** `/rate_plans`, `/room_types`, `/properties`, `/bookings`,
`/booking_revisions/feed`. `/bookings` is the `forceFullFetch` path behind **Re-import bookings**, so
a hotel with 11 bookings in the window would have recovered 10 and been told it worked.

### 2. `room_type_id` is in `relationships`, not `attributes`

```
data[].relationships.room_type.data.id          ← the room this rate plan belongs to
data[].relationships.parent_rate_plan.data.id   ← set when Channex derives it from another
```

`attributes.room_type_id` **does not exist**. Reading it yields `undefined`, which in TypeScript is
indistinguishable from a legitimate "the channel did not say". The 13 September fix for the €666
incident read `attributes` and therefore produced a null on every plan of every property from the day
it shipped.

### 3. An unauthenticated request is `401` with **no `data` key**

So `body.data?.length ?? 0` reads *zero rows* for a dead key exactly as for an empty account. This has
caused three incidents, the worst being **411 consecutive "Pulled 0 revisions · success"** events on a
real hotel. **Check the status code, never the array.**

### 4. A filter on an id that does not exist is **not** an error

```
GET /booking_revisions/feed?filter[property_id]=<deleted-property>   → 200, data: []
GET /properties/<deleted-property>                                   → 404
```

Ventsi Group · Chervena Vila logged "Pulled 0 revisions · success" every five minutes against a
property Channex had deleted. Status code fine, array honestly empty, both wrong. The only question
that separates a quiet morning from a dead pointer is **does the property still exist** —
`verifyProperty()`, run nightly by `mapping-audit`.

---

## Billing, rate limits, and how often we may ask

- **Channex bills per PROPERTY with an active channel.** Not per API call. Polling more often costs
  nothing in fees.
- Our adapter self-limits to **≤ 4 requests/second** with a 250 ms minimum gap, serialized through one
  promise chain (`ChannexChannelAdapter.schedule`).
- The scheduled booking pull runs **every 5 minutes** and is a *pull*, not an ARI push — worth saying
  unprompted in any certification conversation, because a timer-driven full ARI push is forbidden by
  the spec and this reads like one until explained.
- Since 2026-09-17 a **webhook** rings us the moment a booking arrives. It does not replace the poll;
  see below.

---

## Webhooks

```
POST /webhooks  { webhook: { property_id, callback_url, event_mask, is_active, send_data, headers } }
```

Verified on the **sandbox**, created and deleted again:

| field | what we send | why |
| --- | --- | --- |
| `event_mask` | `"*"` | An event type we have not heard of is still a reason to re-pull, and the handler only pulls. A bad value answers `422 contains invalid events`. |
| `is_active` | `true` | Channex creates a webhook **switched off** by default, like a channel. |
| `send_data` | `false` | ⚠️ **We do not want the booking in the ring.** See below. |
| `headers` | `{ "x-revio-webhook": <secret> }` | Custom headers persist and are sent back. This is how the endpoint knows it is really Channex. |

⚠️ **The webhook is a doorbell, not a delivery.** When it rings we do our own authenticated pull and
trust that. A forged request can therefore cause at most one extra pull, which is idempotent; it
cannot invent a booking, cancel one or change a price. The webhook and the cron take the *same* code
path, so there is no second import routine to drift from the first.

⚠️ **It never replaces the poll.** A webhook that never arrives is silent. The 5-minute pull stays as
the safety net that notices what the doorbell missed.

⚠️ **One webhook per PROPERTY.** Channex keys it on `property_id`, and one property can carry
Booking.com and Expedia at once — per channel would ring us twice for one booking.

⚠️ **It is re-checked nightly**, not registered once. A webhook deleted on their side produces no
error anywhere; bookings quietly go back to arriving up to five minutes late and nobody notices.

---

## The endpoints we do NOT use yet

Surveyed read-only on 2026-09-17. Status is what the production key actually got back.

| Endpoint | Status | What it holds | Worth doing? |
| --- | --- | --- | --- |
| `/tasks` | **200 · 296 rows** | Channex's own record of every change we pushed: `success`, `errors[]`, `task`, `received_at`, `executed_at`, `finished_at`, `user_email`. | **Yes — the strongest one.** It is the destination's account of whether a push landed, independent of our `SyncEvent`. Everything we fought today was "our side says success". |
| `/booking_revisions` | 200 | Full revision history per booking — every version Channex holds, not only the unacked ones. | Useful for "what happened to this booking", and a second recovery path when the feed cannot help. |
| `/cancellation_policies` | 200 · 2 | Real terms: `cancellation_policy_logic`, `deadline`, `deadline_type`, `guarantee_payment_policy`, `non_show_policy`. | **Yes.** Our cancellation model is a *label with no terms*, which is why the booking engine has no cancellation screen. These are the terms. |
| `/taxes`, `/tax_sets` | 200 · 1 each | `rate`, `is_inclusive`, `logic`, `max_nights`, `applicable_date_ranges`. | Cross-check against the hotel's own tax configuration in CRS/PMS — a mismatch means the OTA quotes a different total from our own engine. |
| `/reviews` | **403 Forbidden** | OTA guest reviews. | The endpoint exists and our organisation is not entitled. **Worth asking Channex to enable** — reviews in RevioPMS/CRS would be real value and cost us no new integration. |
| `/groups` | 200 | Property groups. | Only once we have a chain. |
| `/applications` | 200 | Channex marketplace apps. | Not now. |
| `/availability`, `/restrictions` | 422 | Read back what is actually live at the channel. | The parameters need working out; `published-check.ts` already wants exactly this. |
| `/messages` | 404 | — | Not available on this plan/version. |

---

## How to test anything here, without breaking a live hotel

1. **Probe with an id that cannot exist.** `POST /channels/00000000-0000-4000-8000-000000000000/deactivate`
   returns `404 resource_not_found` — which proves the route exists while touching nothing. A route
   that does not exist answers differently (`PUT /channels/<ghost>` gives `422`, not `404`).
2. **Let validation teach you the contract.** `POST /webhooks {}` → `webhook can't be blank`; then
   `{webhook:{}}` → `property_id is required`; then → `callback_url and event_mask can't be blank`.
   Three requests, zero guesses, nothing created.
3. **Rehearse writes on the sandbox** (`staging.channex.io`, `CHANNEX_SANDBOX_KEY`) **and delete the
   rehearsal.** A webhook left pointing at a route that does not exist is exactly the orphan we spend
   days cleaning up.
4. **Never test a destructive call against production.** There is one live channel
   (`Cabacum Beach Residence · Booking.com`) and switching it off is a real hotel's rooms.
5. **Verify against the live API before reporting a fault.** `secure.channex.io` is not a Channex
   host; using it produced a confident, wrong report that a healthy production key was revoked.
   Production is **`app.channex.io`**.

## The test that would have caught each of these

| Fault | The test |
| --- | --- |
| Pagination cap | Stub a paginated collection of 12 with a page size of 10; assert 12 come back and that the request carried `pagination[page]`. |
| `relationships` vs `attributes` | Assert `roomTypeId` equals the id under `relationships.room_type.data.id` — a fixture shaped like the real response, not like the one we assumed. |
| 401 read as empty | Stub a 401 with no `data` key; assert the caller **throws or reports unknown**, never "0 rows". |
| Dead property pointer | Stub `verifyProperty` → 404; assert the audit says *the property is gone* and does **not** go on to call the catalogue empty. |
| Endpoint behind the login gate | Test the middleware matcher regex directly: `/api/webhooks/channex` must not match. It is the only place that decision is enforced. |
