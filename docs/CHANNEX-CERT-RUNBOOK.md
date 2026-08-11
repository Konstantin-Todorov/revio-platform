# Channex certification — the drive

Every task ID we submit must come from a **real action in the RevioLink UI**. Channex's own
anti-pattern list names "standalone script, CLI, or Postman collection posting exact table values",
and that is where all twelve of the first submission's IDs came from. This file is the sequence of
UI actions, in order, with the exact values.

**Nothing is submitted until `channex:cert-verify` passes it.** `success: true` from Channex means
the payload parsed, not that it said what the test asked.

---

## Where

**https://channel-manager-production-59bb.up.railway.app** → property **Revio Cert Hotel**, channel
**Channex Sandbox**. The sandbox is `Test Property - Revio` (USD), Twin Room (8) and Double Room (6),
each with **Best Available Rate** and **Bed & Breakfast** — all four rate plans now USD.

After each action: **Sync Center** shows the push with its Channex task ids, **each one labelled**
(`availability task … · rates task …`). Copy from there, never from the order something printed.

---

## Results so far — verified task ids

Every id below has passed `channex:cert-verify`. **Tests 4–10 still to drive.**

| Test | Task id | Push, as the Sync Center recorded it |
| --- | --- | --- |
| **1** Full sync · availability | `1f05a5d5-0722-4a36-b064-33f44ad456fd` | 2000/2000 · 2026-08-11 → 2027-12-23 (500 days) |
| **1** Full sync · rates | `cfc73e27-4216-4ec5-ac18-44e2a530f79c` | *(same push)* |
| **2** Single date, single rate | `38de012a-cb86-4a22-827b-dbac3a13d62e` | 1/1 · 2026-11-22 → 2026-11-22 (1 day) |
| **3** Single date, multiple rates | `5b970e08-4fc6-40a3-86ad-eb8c5e72e2fa` | 3/3 · 2026-11-21 → 2026-11-29 (3 days) |

Those counts are the delta work paying off: test 2 sends **one** update where the old code sent 56,
and test 3 puts three different prices on three different dates into a **single** API call with no
cross product — the requirement six of these tests turn on.

Q16 wants both test-1 ids in one field, **availability first**.

## The 499-day question — resolved

Test 1 now covers the full 500. The push records its own window, and the two runs that read 499
were taken while the rolling horizon sat one day outside the range the prices had been seeded over;
with the window printed on every sync event a recurrence is visible immediately instead of needing
to be reconstructed from payloads. Keep an eye on it when the seeded range and the horizon are ever
re-cut — it is the kind of off-by-one that hides behind a healthy-looking "2000/2000".

## Earlier findings — 2026-08-10

**Step 0 done.** Five bulk applies through the UI; the four real products carry 500 clean days each
(Twin BAR 100, Twin B&B 120, Double BAR 110, Double B&B 130, +25% over 20 Dec – 5 Jan).

**Test 1 driven twice**, and the verifier rejected both — which is the verifier doing its job:

1. **First run: availability 0 on every date, both rooms.** `PropertyDefaults.defStopSell`,
   `defCta` and `defCtd` were all `true` on this property, left over from earlier testing. They sit
   at the bottom of the restriction resolution, so the whole property was closed on every channel
   and every date. Fixed (all three now false, backed up first). **Worth a guard**: a property whose
   standing default is stop-sell is silently unsellable, and nothing on the screen says so.
2. **Second run: 499 days, not 500.** Payload covers `2026-08-11 → 2027-12-22` for both rooms and
   all four rate plans. Prices exist on `2026-08-10`, `08-11`, `2027-12-22` AND `2027-12-23`, so it
   is not missing data — it is the date-range generation in `syncChannel`, one day short of the
   property's `syncHorizonDays` of 500. **Open — diagnose before re-running test 1.** The two
   candidates are the first day (today) being dropped or the last day never being generated; a
   log of `dates[0]`/`dates.length` on one run settles it.

Task ids from these runs are **not** submittable. Tests 2–10 not yet driven.

## Step 0 — seed 500 days of varied ARI *(not submitted; test 1 needs data to sync)*

Channex's test 1 says the data must be varied — *"not every room at 1 and $100"*. Availability
already varies on its own (Twin 8, Double 6, derived from the room counts, so leave **Rooms to sell**
empty). Prices need five Bulk Update applies, each its own **Preview & apply**:

| # | Dates | Room | Rate plan | Price |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-10 → 2027-12-23 | Twin | Best Available Rate | Set **100** |
| 2 | 2026-08-10 → 2027-12-23 | Twin | Bed & Breakfast | Set **120** |
| 3 | 2026-08-10 → 2027-12-23 | Double | Best Available Rate | Set **110** |
| 4 | 2026-08-10 → 2027-12-23 | Double | Bed & Breakfast | Set **130** |
| 5 | 2026-12-20 → 2027-01-05 | both | all four | **Increase by % → 25** |

Five applies, five pushes. None of these ids goes in the form — they exist so the full sync has
something varied to send.

## Test 1 — Full Data Update · **2 task ids**

**Channels → Channex Sandbox → Sync now.** One action, 500 days, both endpoints.

The horizon comes from the property's own **Sync horizon** (Settings), which is 500. Submit both ids
in Q16, one per line, **availability first**:

```
<availability task id>
<rates task id>
```

## Tests 2–8 — Bulk Update

Each test is **one** Apply. Where a test names several different values, queue them with
**"Add another change"** and apply once — that is what makes it one API call.

**Test 2** · 1 change
| Dates | Room | Plan | Field |
| --- | --- | --- | --- |
| 2026-11-22 | Twin | Best Available Rate | Price → Set **333** |

**Test 3** · 3 queued changes
| Dates | Room | Plan | Field |
| --- | --- | --- | --- |
| 2026-11-21 | Twin | Best Available Rate | Set **333** |
| 2026-11-25 | Double | Best Available Rate | Set **444** |
| 2026-11-29 | Double | Bed & Breakfast | Set **456.23** |

**Test 4** · 3 queued changes
| Dates | Room | Plan | Field |
| --- | --- | --- | --- |
| 2026-11-01 → 11-10 | Twin | Best Available Rate | Set **241** |
| 2026-11-10 → 11-16 | Double | Best Available Rate | Set **312.66** |
| 2026-11-01 → 11-20 | Double | Bed & Breakfast | Set **111** |

**Test 5 — Min stay** · 3 queued changes. Price left on "No change".
| Dates | Room | Min stay |
| --- | --- | --- |
| 2026-11-23 | Twin | **3** |
| 2026-11-25 | Double | **2** |
| 2026-11-15 | Double | **5** |

**Test 6 — Stop sell** · 3 queued changes. **Only** "Rate plan status → Close (stop-sell)".
| Dates | Room |
| --- | --- |
| 2026-11-14 | Twin |
| 2026-11-16 | Double |
| 2026-11-20 | Double |

**Test 7 — Multiple restrictions** · 4 queued changes, no price.
| Dates | Room | Fields |
| --- | --- | --- |
| 2026-11-01 → 11-10 | Twin | CTA **Closed** · CTD **Open** · max stay **4** · min stay **1** |
| 2026-11-12 → 11-16 | Twin | CTA **Open** · CTD **Closed** · min stay **6** |
| 2026-11-10 → 11-16 | Double | CTA **Closed** · min stay **2** |
| 2026-11-01 → 11-20 | Double | min stay **10** |

**Test 8 — Half year** · 2 queued changes, price **and** restrictions together.
| Dates | Room | Plan | Fields |
| --- | --- | --- | --- |
| 2026-12-01 → 2027-05-01 | Twin | Best Available Rate | Set **432** · CTA Open · CTD Open · min stay **2** |
| 2026-12-01 → 2027-05-01 | Double | Best Available Rate | Set **342** · min stay **3** |

> ⚠ **Known deviation, tests 5–8.** Date-scoped restrictions are stored per **room type**, not per
> rate plan (`DailyCell` is keyed on room type + date). So a min stay set for Twin also reaches Twin
> Bed & Breakfast. Every value the test names is correct and no forbidden field is carried; the
> payload simply also contains the room's sibling rate plan. Rate changes are unaffected — those
> are per rate plan and land on exactly the plans named. If Channex objects, the fix is a
> `ratePlanId` on `DailyCell` (nullable = "all plans of this room", so it migrates cleanly).
> The narrower tool that exists today is a **restriction rule**, which can name one rate plan — but
> one rule per row is one push per row, and these tests allow a single call.

## Test 9 — Single date availability · from a **booking**

The spec says to simulate this by making a booking. Two bookings in **RevioCRS** (Reservations →
Availability Search → Hold → Confirm) against Revio Cert Hotel:

| Room | Stay | Result |
| --- | --- | --- |
| Twin | 2026-11-21 → 11-22 | 8 → **7** |
| Double | 2026-11-25 → 11-26 | 6 → **5** — see below |

The test wants Double at **0** on 25 Nov. Six rooms means six nights sold, so first take the Double
down to one bookable room on that date: a Bulk Update on 2026-11-25, Double, **Rooms to sell → 1**
(that apply's task id is not submitted). The booking then takes it to 0, which is the availability
push we do submit.

## Test 10 — Multiple date availability · Bulk Update · 2 queued changes
| Dates | Room | Rooms to sell |
| --- | --- | --- |
| 2026-11-10 → 11-16 | Twin | **3** |
| 2026-11-17 → 11-24 | Double | **4** |

## Test 11 — already passed
Booking `b5ca82a0-625f-4edc-9d68-bd28e45198f0`, revisions new / modified / cancelled recorded in
`CHANNEX-FORM-ANSWERS.md`. The booking survived the rate-plan rebuild — re-checked after.

---

## Then, before the form

```bash
pnpm --filter @revio/connectivity channex:cert-verify results.json
```

`results.json`, task ids copied from Sync Center:

```json
{
  "1":  { "availability": "…", "rates": "…" },
  "2":  ["…"], "3": ["…"], "4": ["…"], "5": ["…"],
  "6":  ["…"], "7": ["…"], "8": ["…"], "9": ["…"], "10": ["…"]
}
```

It checks the exact rates in minor units, the exact dates, that no test carries a field it was not
asked for, and that the full sync covers 500 days across every product with data that actually
varies. **An id that has not passed it does not go in the form.**
