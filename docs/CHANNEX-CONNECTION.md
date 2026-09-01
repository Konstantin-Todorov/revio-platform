# How a hotel actually gets connected to Channex

Written 2026-09-01, during the first real hotel's onboarding, because every question in this
document was asked out loud that day and none of it was written down anywhere.

---

## The two hops

The single most common misunderstanding: **Channex is not an OTA.** It is the middleman. There are
two connections, and we own exactly one of them.

```
  Revio  ──hop 1──►  Channex  ──hop 2──►  Booking.com / Airbnb / Expedia
        (ours,                    (the hotel's own OTA accounts,
     automatic)                    authorised in each OTA's extranet)
```

### Hop 1 — Revio → Channex. Ours, and automatic.

**RevioLink → Channels → "Set up on Channex"** creates, through the API and with nobody touching the
Channex dashboard:

- the **property**
- every **room type** that exists at that moment
- every **rate plan** that exists at that moment

The hotel does not create these by hand. If somebody is creating room types in the Channex portal,
something has gone wrong — or hop 1 was never run.

### Hop 2 — Channex → each OTA. Not ours, and not automatable.

Connecting Booking.com needs three things only the hotel has:

1. **Their own account** with that OTA — their contract, their commission rate.
2. **Authorisation inside the OTA's own extranet.** The hotel logs into Booking.com and approves
   Channex as its connectivity provider. A third party cannot self-authorise; that is the OTA's
   security model, not a gap in ours.
3. **Mapping their listing to our room type**, because their "Villa 3BR" and our "Villa, 3 Bedrooms"
   are different records.

`RevioLink → Channels → Connect a channel` asks Channex what that OTA needs and tests it. Channels
are created **switched off** — nothing sells until somebody activates it.

---

## ⚠️ Provisioning is ONE-SHOT

`provisionChannexProperty` is the **only** code in the platform that creates room types or rate plans
in Channex. It runs once, from that button, and it sends whatever exists **at that moment**.

**A room type or rate plan added afterwards is never created in Channex.** There is no path that
pushes a new product. This bit the first hotel: the room type was provisioned, a rate plan was added
later, and it never reached Channex.

**So: finish Rooms & Rates BEFORE pressing "Set up on Channex".**

---

## The two API keys, and which one is used

| Key | Where it lives | Used by |
| --- | --- | --- |
| **Platform key — THE NORMAL CASE** | `CHANNEX_PROD_KEY` / `CHANNEX_SANDBOX_KEY` on Railway (`channel-manager`, `reservation`, `pms`; `operator` holds a reference so the console can test it) | Every hotel we onboard. |
| **Per-tenant — THE EXCEPTION** | `ConnectivityCredential`, AES-256-GCM encrypted, set in **Operator → Connectivity** | Only a hotel that arrives already owning a Channex account. **Overrides** the platform key for that tenant. |

**We are the Channex customer, not the hotel.** We are certified as a PMS partner: one organisation,
one key scoped to all properties, and Channex bills **us** per property with an active channel. A
hotel does not need a Channex account and is never asked for one.

⚠️ A per-tenant key set by mistake points that hotel at a **different Channex account**. The property
we provisioned under our organisation is then invisible to it, and every push fails with
`property_id Not found property for this change` — which reads like a mapping bug and is not one.

A hotel with its own key **does not care** whether the Railway variable is valid. Both were dead on
2026-09-01 and only the per-tenant one mattered for the villa.

Sandbox and production are **different Channex accounts with different keys and different hosts**
(`staging.channex.io` vs `secure.channex.io`). A property created in one does not exist in the other.

---

## Two different things, and only one of them is per-hotel

The console conflated these for a week, and it is the root of the confusion:

| | What it is | How many | Where it lives |
| --- | --- | --- | --- |
| **API key** | Authenticates **us** to Channex (`user-api-key` header) | **ONE, ours** | `CHANNEX_*_KEY` on Railway |
| **Property ID** | Identifies one villa inside our organisation | **One per property** | `Channel.externalPropertyId`, a UUID Channex generates during provisioning |

**The thing that varies per villa is the property ID, not the key.** The property ID is created
automatically by provisioning and is already stored in the right place. Nobody types it.

Operator → Connectivity now shows the **Channex property ID** per client — the id to quote when
Channex says "not found" — and labels the per-client key columns *(rare)*. Before this the only
per-client thing on the screen was a key that should almost never be set, which implied the wrong
thing was per-hotel.

## ⚠️ Provisioning used to copy the platform key (fixed 2026-09-01)

Step 1 of provisioning stored a per-tenant copy of whichever key it authenticated with — normally
**our platform key**. That copy then **overrides** the platform key for that tenant forever, because
the lookup reads the per-tenant row first.

**Rotate the platform key and every previously-provisioned hotel silently keeps the old dead one.**

Verified on the first real hotel: its "own key" was byte-identical to the platform key (`38e7b7fc`
both). Nobody had pasted it. The console displayed it as a per-client credential as though somebody
had chosen it, which sent the whole investigation down the wrong path for an hour.

Provisioning no longer writes credentials at all. **If you see a per-tenant key on a hotel that was
provisioned before 2026-09-01, delete it** — it is a stale copy, not a decision.

## ⚠️ The trap this codebase keeps falling into

**An unauthenticated Channex request returns `401` with no `data` key.**

So `body.data?.length ?? 0` reports **zero** for a dead key and for an empty account alike. This has
now caused three separate incidents:

1. A `200 "Success"` hiding a rejection in `meta.warnings`.
2. A key check reporting "0 properties" that was actually a 401.
3. **2026-09-01** — `pullRevisions` read `if (!res.ok) return []`, so every 401 arrived as an empty
   feed and the Sync Center wrote **411 consecutive "Pulled 0 revisions · success"** events. The
   hotel was told its channel was healthy for hours while nothing reached it.

I made mistake #2 *again* while diagnosing #3.

**ALWAYS CHECK THE STATUS CODE, NEVER THE ARRAY LENGTH.** Pinned by
`apps/operator/lib/channex-key-check.test.ts` and `packages/connectivity/src/pull-failure.test.ts`.

---

## Reading the symptoms

| What you see | What it means |
| --- | --- |
| `property_id Not found property for this change` | The key cannot see that property — revoked, regenerated, or **a different Channex account**. Not a mapping fault. |
| Pushes `12/14` or `363/365` | Partial. The rejected ones are in **Error Center** with the reason; the SyncEvent summary alone will not tell you. |
| Sync Center all green, nothing happening | Since 2026-09-01 a failed pull says so. If you see this on an older deployment, distrust it. |
| Key saved but nothing works | Before 2026-09-01 the Operator stored keys **without testing them**. Now a rejected key is refused on save, and every key shows **working / rejected / never tested**. |

---

## Before onboarding a new hotel — the checklist

1. **Operator → Connectivity** — paste that hotel's Channex key. It is tested on save; a key Channex
   rejects is **not stored**. The pill must read **working**.
   - "working, sees 0 properties" is expected *before* provisioning.
2. **Confirm the tenant is not a demo.** Provisioning refuses a demo tenant, by design.
3. **Finish Rooms & Rates completely** — every room type and every rate plan. Provisioning is
   one-shot (see above).
4. **RevioLink → Channels → Set up on Channex.** Now the pill should say it sees 1 property.
5. **Check Sync Center**: the first push should be `success`, not `n-2/n`. Any rejection is in Error
   Center with a reason.
6. **Only then** connect an OTA — and the hotel must first authorise Channex inside that OTA's own
   extranet.

If step 1 will not go green, **stop**. Everything after it will fail in ways that look like
mapping bugs.
