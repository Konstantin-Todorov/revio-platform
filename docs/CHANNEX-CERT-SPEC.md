# Channex PMS Certification — the actual spec

Transcribed from <https://docs.channex.io/api-v.1-documentation/pms-certification-tests> on 2026-08-06,
**after our first submission was rejected**. Kept verbatim because the first attempt failed partly by
working from a summary instead of this.

---

## ⛔ The thing we got most wrong

> **"This document is not an API testing script. It verifies that a PMS product correctly pushes data
> to Channex in response to real user actions inside the PMS UI, not from standalone test code."**

And their explicit **anti-patterns that fail certification**:

- **Standalone script, CLI, or Postman collection posting exact table values** ← *this is exactly what
  `pnpm channex:cert` is, and every task ID we submitted came from it*
- A "certification UI" built solely to trigger test events
- Full-sync on a timer instead of delta updates on change events
- Per-date or per-rate API calls where the test specifies "1 API call"
- **Hardcoded UUIDs or values from this document**
- Integration logic in test files rather than the main PMS codebase

So the payload bugs in the rejection email are only half the story. Even with every payload perfect,
task IDs produced by a script fail at Stage 4, when Channex watches the calls fire while we drive the
product. **Every submitted task ID must come from a real action in the RevioLink UI.**

The saving grace: our integration logic already lives in the product (`packages/connectivity/src/sync.ts`,
called by CM calendar/bulk edits and by CRS/PMS writes). The script was never the integration — it was
just the wrong way to demonstrate it.

## Pre-flight checklist — answer "yes" **with file paths**

1. When a user saves a price change in your PMS UI, does your code emit a domain event your integration observes?
2. Do you have an outbox/queue between PMS and Channex, or does code call the API directly?
3. If Channex returns 429, does retry logic back off or silently drop updates?
4. Where in your codebase does `POST /availability` get called from?
5. **If you deleted all certification test code, would your PMS still push updates correctly?**

## Stages

1. Build against staging; complete when the PMS pushes real ARI **in response to UI actions**.
2. Run the scenarios **in your PMS UI**, record the task IDs. Data must be realistic — varied prices,
   inventory and restrictions, *not* uniform values.
3. Submit the form with task IDs and notes; flag anything skipped.
4. **Live screenshare** — perform the actions in the UI while Channex watches the calls fire.
5. Production access.

---

## Test property setup (ours does not match yet)

| | Spec | Ours today |
| --- | --- | --- |
| Property name | `Test Property - (Provider Name)` | "Revio Test Hotel" |
| **Currency** | **USD** | **EUR** ← the rejection quotes dollars |
| Room types | Twin Room (occ 2), Double Room (occ 2) | ✅ both exist |
| Rate plans | Twin: Best Available Rate **$100**, Bed & Breakfast **$120**<br>Double: Best Available Rate **$100**, Bed & Breakfast **$120** | named "Breakfast", not "Bed & Breakfast"; prices not set to the baseline |

---

## The tests, with their prescribed values

**Rule read out of the failures: each update must carry only the fields the test names.** A rate test
that also ships `stop_sell: false` is rejected. Tests 7 and 8 name restrictions *and* rates, so there
the combination is correct — the rule is "only what is named", not "never combine".

### 1 · Full Data Update (Full Sync)
500 days of availability, rates and restrictions for all rooms and rates. **2 API calls**: one
500-day availability (all rooms), one 500-day rates & restrictions (all rates). Data must be varied —
not every room at 1 and $100.

### 2 · Single Date Update for Single Rate — **1 call**
| Room | Rate plan | Date | Value |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 22 Nov 2026 | **$333** |

### 3 · Single Date Update for Multiple Rates — **1 call, batched**
| Room | Rate plan | Date | Value |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 21 Nov 2026 | **$333** |
| Double | Best Available Rate | 25 Nov 2026 | **$444** |
| Double | Bed & Breakfast | 29 Nov 2026 | **$456.23** |

### 4 · Multiple Date Update for Multiple Rates — **1 call**
| Room | Rate plan | Range | Value |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 01–10 Nov 2026 | **$241** |
| Double | Best Available Rate | 10–16 Nov 2026 | **$312.66** |
| Double | Bed & Breakfast | 01–20 Nov 2026 | **$111** |

### 5 · Min Stay Update — **1 call**
| Room | Rate plan | Date | Min stay |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 23 Nov 2026 | 3 |
| Double | Best Available Rate | 25 Nov 2026 | 2 |
| Double | Bed & Breakfast | 15 Nov 2026 | 5 |

### 6 · Stop Sell Update — **1 call, stop_sell only**
| Room | Rate plan | Date | Stop sell |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 14 Nov 2026 | true |
| Double | Best Available Rate | 16 Nov 2026 | true |
| Double | Bed & Breakfast | 20 Nov 2026 | true |

### 7 · Multiple Restrictions Update — **1 call**
| Room | Rate plan | Range | Restrictions |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 01–10 Nov 2026 | cta **true**, ctd **false**, **max_stay 4**, min_stay 1 |
| Twin | Bed & Breakfast | 12–16 Nov 2026 | cta false, **ctd true**, min_stay 6 |
| Double | Best Available Rate | 10–16 Nov 2026 | **cta true**, min_stay 2 |
| Double | Bed & Breakfast | 01–20 Nov 2026 | min_stay 10 |

### 8 · Half-Year Update — **1 call**
| Room | Rate plan | Range | Details |
| --- | --- | --- | --- |
| Twin | Best Available Rate | 01 Dec 2026 – 01 May 2027 | rate **$432**, cta false, ctd false, min_stay 2 |
| Double | Best Available Rate | 01 Dec 2026 – 01 May 2027 | rate **$342**, min_stay 3 |

### 9 · Single Date Availability Update — **1–2 calls**
Simulate **by making a booking in the PMS**. Baseline Twin 8, Double 1.
| Room | Date | Value |
| --- | --- | --- |
| Twin | 21 Nov 2026 | 7 |
| Double | 25 Nov 2026 | 0 |

### 10 · Multiple Date Availability Update — **1–2 calls**
| Room | Range | Value |
| --- | --- | --- |
| Twin | 10–16 Nov 2026 | 3 |
| Double | 17–24 Nov 2026 | 4 |

### 11 · Booking Receiving — ✅ **passed**
Create, modify, cancel; acknowledge each; use `GET /booking_revisions`, not `/bookings`; webhooks
preferred. Submit booking ID + screenshots from our system.

### 12 · Rate limits — confirm the queue prevents exceeding them.

### 13 · Update logic — **no full sync on a timer. Only send changes.** Full sync at most once per
24h, off-peak, with delays between properties.

### 14 · Extra notes (capability questions — our answers must match what the code actually sends)
1. Both Min Stay Through and Arrival? If only one, which?
2. Which restrictions do you **not** support?
3. Multiple room types and multiple rate plans per room type?
4. Do you require credit card details with bookings?
5. PCI certified, or using a PCI service?

---

## Cross-cutting requirements from the rejection

- **`date_range` syntax with merged consecutive sequences**, not one object per date. Warned on
  tests 4, 7, 8 and 10.
- **Only the named fields.** Our `ChannexRestrictionValue` currently makes `closed_to_arrival`,
  `closed_to_departure` and `stop_sell` mandatory and emits `?? false`, so every rate push carries
  three restrictions it was never asked to change. Beyond certification this is destructive: it
  silently clears restrictions set anywhere else.
- **Declared capabilities must match what we send.** `max_stay` was declared and never sent
  (2000/2000 objects missing it); min stay was sent while the form said we do not support it.
