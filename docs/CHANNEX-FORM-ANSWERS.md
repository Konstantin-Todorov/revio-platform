# Channex certification form — every question, answered

**49 questions across 34 pages.** Extracted from the form's own structure, so this is the real list
and its real order, not a reconstruction.

**Answers are derived from what the code emits, not from memory.** The previous submission failed
Test 5 on a contradiction we authored ourselves: the form declared no Min Stay support while the
integration was sending `min_stay_arrival` and `min_stay_through`. Every capability claim below is
checkable against `packages/connectivity/src/channex-mappers.ts`.

> **The form branches.** Each test case asks "Is this test case applicable?" first. Answer **Yes** and
> it asks for task IDs; answer **No** and it asks why instead. We answer **Yes** to all nine, so the
> nine "why is this not applicable" pages (Q19, 22, 25, 28, 31, 34, 37, 40, 43) never appear. They are
> listed below only so nothing looks missing.

---

## Page 1 — Contact

| Q | Question | Answer |
| --- | --- | --- |
| — | Email Address *(required)* | *(your email)* |
| **Q1** | Product name | **RevioLink** |
| **Q2** | Contact Person Name | *(your name)* |
| **Q3** | Contact Person Email | *(your email)* |

## Page 2 — Information about PMS functionality

| Q | Question | Answer |
| --- | --- | --- |
| **Q4** | Do you support multiple Room Types per Property | **Yes** |
| **Q5** | Do you support multiple Rate Plans per Room Type | **Yes** |
| **Q6** | What restrictions is supported by your system *(checkboxes)* | **Tick all eight** — see below |
| **Q7** | Do you need credit card details with bookings? | **No** |
| **Q8** | Are you PCI Certified? | **"No, but we use PCI Service like Vaultera, PCI Booking or Tokenex"** |

### ⚠️ Q6 is the question that failed us last time

Tick **every one** of: `Availability` · `Rate` · `Min Stay Through` · `Min Stay Arrival` ·
`Max Stay` · `Closed To Arrival` · `Closed To Departure` · `Stop Sell`

That is exactly what `toRestrictionValue` emits — `rate`, `min_stay_arrival`, `min_stay_through`,
`max_stay`, `closed_to_arrival`, `closed_to_departure`, `stop_sell` — plus availability from
`toAvailabilityValue`. **Min Stay Arrival and Min Stay Through were evidently not ticked last time**,
which is why Test 5 came back *"Property declares no Min Stay support, but ran this test."*

On **Q8**: RevioLink handles no card data at all. Elsewhere on the platform a card guarantee goes
through **Stripe** and we store only a token plus brand and last-4 — never a PAN, CVV or expiry. Since
Q7 is "No", this is moot for the ARI integration, but the middle option is the accurate one.

## Page 3 — Setup Testing Property

Property is configured as `Test Property - Revio`, currency **USD**.

| Q | Question | Answer |
| --- | --- | --- |
| **Q9** | Property ID at Channex | `a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9` |
| **Q10** | Twin Room ID | `9a029a40-1629-471a-9e14-dd65c55660b9` |
| **Q11** | Twin Room Best Available Rate ID | `f1413ce8-5094-48fe-8722-6e54c709dc93` |
| **Q12** | Twin Room Bed & Breakfast Rate ID | `f9501de0-6559-47d5-97a2-4a06cb70fe47` |
| **Q13** | Double Room ID | `1e2f3c2b-94ca-4ae3-97db-ab0f7748ad9b` |
| **Q14** | Double Room Best Available Rate ID | `c650ca88-5762-4e93-baf5-d70e744b4d24` |
| **Q15** | Double Room Bed & Breakfast Rate ID | `1659e89b-a740-4ba7-8530-44000b24059a` |

## Pages 4–32 — The test cases

> **"Certification results with full response copy&paste will be ignored!"** — paste only the `id`
> value, one per line. Nothing else.

| Q | Page | Answer |
| --- | --- | --- |
| **Q16** | Test 1 · Full Sync — results | **two IDs, one per line** ⚠️ see below |
| **Q17** | Test 2 · applicable? | **Yes** |
| **Q18** | Test 2 · results | *(1 ID)* |
| **Q20** | Test 3 · applicable? | **Yes** |
| **Q21** | Test 3 · results | *(1 ID)* |
| **Q23** | Test 4 · applicable? | **Yes** |
| **Q24** | Test 4 · results | *(1 ID)* |
| **Q26** | Test 5 · applicable? | **Yes** |
| **Q27** | Test 5 · results | *(1 ID)* |
| **Q29** | Test 6 · applicable? | **Yes** |
| **Q30** | Test 6 · results | *(1 ID)* |
| **Q32** | Test 7 · applicable? | **Yes** |
| **Q33** | Test 7 · results | *(1 ID)* |
| **Q35** | Test 8 · applicable? | **Yes** |
| **Q36** | Test 8 · results | *(1 ID)* |
| **Q38** | Test 9 · applicable? | **Yes** |
| **Q39** | Test 9 · result | *(1–2 IDs)* |
| **Q41** | Test 10 · applicable? | **Yes** |
| **Q42** | Test 10 · results | *(1–2 IDs)* |

*Not reached (the "No" branch): Q19, Q22, Q25, Q28, Q31, Q34, Q37, Q40, Q43.*

### ⚠️ Q16 — the two Full Sync IDs

One field, two IDs, one per line. The order is **not** labelled by the form, so put the
**availability** task first and the **rates & restrictions** task second, matching how the page states
the requirement:

```
<availability task id>     ← 1 × 500 days Availability (All Rooms)
<rates task id>            ← 1 × 500 days Rates & Restrictions (All Rates)
```

This is where the last submission most likely went wrong: *"expected exactly one Availability update,
found 0"* is what a reviewer sees when a rates payload sits in the availability position. Our
availability task itself was correct — 2,000 values, 500 dates, both room types. **The Sync Center now
prints each id labelled** (`availability task … · rates task …`) so copy from there, never from the
order a script happened to print.

## Page 33 — Test Case #11. Booking Receiving ✅ already passed

| Q | Question | Answer |
| --- | --- | --- |
| **Q44** | Booking ID | `b5ca82a0-625f-4edc-9d68-bd28e45198f0` |
| **Q45** | Revision ID · New | `ba5897ef-10ae-490c-bb6c-2dced37c9db8` |
| **Q46** | Revision ID · Modified | `4343c774-6de1-41c3-be38-367c31bf80e1` |
| **Q47** | Revision ID · Cancelled | `30912387-7a62-4925-bf15-310546f4e28b` |

## Page 34 — Rate Limits and Update logic

| Q | Question | Answer |
| --- | --- | --- |
| **Q48** | Can you stay in rate limits? | **Yes** |
| **Q49** | Do you agree to only send updated changes to Channex? | **Yes** |

Both are honest now, and were not entirely honest before:

- **Q48** — every request is serialised through one promise chain with a 250ms floor (≈4 req/s) in
  `ChannexChannelAdapter.schedule()`, and pushes are batched so a 500-day full sync is 2 calls.
- **Q49** — pushes are delta and event-driven. `PushScope` carries the dates, rooms, rate plans and
  fields a user actually edited. Until this week a single price edit re-pushed the whole 14-day
  horizon for every product; answering "Yes" then would have been wrong.

---

## If they ask about the 5-minute job

We run a scheduled task every five minutes, but it is a **booking pull** (`GET /booking_revisions`),
not an ARI push — it sends no rates or availability. Worth saying unprompted if it comes up on the
screenshare, because unexplained it reads exactly like the timer-driven full sync the spec forbids.

## Before pasting a single ID

Run every task ID through the verifier — `packages/connectivity/src/cert-expectations.ts`. It checks
the exact rates, the exact dates, and that no test carries a field it was not asked for. **An ID that
has not passed the verifier does not go in the form.** Submitting on the strength of Channex
returning `success: true` is what produced the last rejection.
