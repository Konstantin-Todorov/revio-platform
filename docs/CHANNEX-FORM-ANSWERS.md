# Channex certification form — every question, answered

> ## ✅ SUBMITTED 2026-08-11
>
> Every answer below is what went in. All ten ARI tests had passed
> `channex:cert-verify` first — *All 10 checked tests match the spec.*
>
> **Two things this file should be read for next time.**
>
> Google Forms' saved draft preserves **text answers only**. Radios and checkboxes came back
> blank on resume, including the eight restriction ticks. If the form is ever reopened, re-check
> every non-text answer before trusting the draft.
>
> And a **verification pass caught a truncated answer**: test 10 had silently become the single
> character `e`, because a synthetic keystroke sequence got cut off. It looked filled in when
> passed. Reading every field back — rather than trusting that typing worked — is what caught it,
> and is the reason to do a full Back-walk before submitting anything long.

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
| — | Email Address *(required)* | `konstantin.todoroff@gmail.com` |
| **Q1** | Product name | **RevioLink** |
| **Q2** | Contact Person Name | **Konstantin Plamenov Todorov** |
| **Q3** | Contact Person Email | `konstantin.todoroff@gmail.com` |

### The legal entity behind it

Channex's form asks only for a product name and a contact, but the contract, the invoices and the
production API keys are issued to a company — so keep these to hand for the agreement that follows
certification, and reuse them verbatim so nothing has to be corrected later.

| | Cyrillic (as registered) | Latin (for the English form) |
| --- | --- | --- |
| Company | УЕБЪР БГ ЕООД | **WEBER BG EOOD** *(EOOD = single-member limited liability company)* |
| EIK / company number | 205090014 | `205090014` |
| VAT number | BG205090014 | `BG205090014` |
| Registered address | БЪЛГАРИЯ, гр. Русе (7000), Преслав 6 | **6 Preslav St, Ruse 7000, Bulgaria** |
| Manager / director | КОНСТАНТИН ПЛАМЕНОВ ТОДОРОВ | **Konstantin Plamenov Todorov** |

Two things to decide before signing anything:

- **The contact email is a personal Gmail.** It is fine for the certification thread, but the
  billing and API-key notifications should go somewhere that survives one person — `billing@` or
  `ops@` on the company's own domain. Channex sends unacknowledged-booking warnings to this address.
- **Whose name is on the account.** The keys issued here are the ones every hotel's distribution
  will run through, so the account should belong to WEBER BG EOOD rather than to an individual.

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

Property is `Test Property - Revio`, currency **USD**. Twin Room 8 rooms, Double Room 6 rooms, each
with **Best Available Rate** ($100) and **Bed & Breakfast** ($120), all four plans **USD**.

> ⚠ **The four rate-plan ids below are NEW as of 2026-08-10.** A Channex rate plan's currency is
> fixed at creation — `PUT /rate_plans/{id}` accepts the field and ignores it, and the dashboard
> renders the same select disabled — so four plans left in EUR under a USD property could only be
> corrected by deleting and recreating them. **Any earlier note listing `f1413ce8…`, `f9501de0…`,
> `c650ca88…` or `1659e89b…` is stale: those ids no longer resolve.** The room type and property
> ids are unchanged. Verified against `relationships.room_type`, not creation order.

| Q | Question | Answer |
| --- | --- | --- |
| **Q9** | Property ID at Channex | `a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9` |
| **Q10** | Twin Room ID | `9a029a40-1629-471a-9e14-dd65c55660b9` |
| **Q11** | Twin Room Best Available Rate ID | `ef3afc26-5f6f-4f76-b074-b9f5b4d7b13f` |
| **Q12** | Twin Room Bed & Breakfast Rate ID | `d3b84ca7-39ac-4d0d-8da9-8f0a5fa75b81` |
| **Q13** | Double Room ID | `1e2f3c2b-94ca-4ae3-97db-ab0f7748ad9b` |
| **Q14** | Double Room Best Available Rate ID | `f415d8f1-2f1e-47e2-84a2-6135de71795b` |
| **Q15** | Double Room Bed & Breakfast Rate ID | `4df2cbcd-df01-4502-8e10-34be81656d24` |

## Pages 4–32 — The test cases

> **"Certification results with full response copy&paste will be ignored!"** — paste only the `id`
> value, one per line. Nothing else.

**All ten verified 2026-08-11** — `channex:cert-verify` reports *All 10 checked tests match the spec.*
Paste exactly these, nothing else in the field:

| Q | Page | Answer |
| --- | --- | --- |
| **Q16** | Test 1 · Full Sync — results | `1f05a5d5-0722-4a36-b064-33f44ad456fd`<br>`cfc73e27-4216-4ec5-ac18-44e2a530f79c` ⚠️ two lines, availability first — see below |
| **Q17** | Test 2 · applicable? | **Yes** |
| **Q18** | Test 2 · results | `38de012a-cb86-4a22-827b-dbac3a13d62e` |
| **Q20** | Test 3 · applicable? | **Yes** |
| **Q21** | Test 3 · results | `5b970e08-4fc6-40a3-86ad-eb8c5e72e2fa` |
| **Q23** | Test 4 · applicable? | **Yes** |
| **Q24** | Test 4 · results | `180ec0b0-2949-48e6-97a1-8c7c4f1e3ff6` |
| **Q26** | Test 5 · applicable? | **Yes** |
| **Q27** | Test 5 · results | `d12d4363-4933-4704-8fa5-bc23271c255b` |
| **Q29** | Test 6 · applicable? | **Yes** |
| **Q30** | Test 6 · results | `8bbc2f69-e476-4a85-ab29-5dc61a726a23` |
| **Q32** | Test 7 · applicable? | **Yes** |
| **Q33** | Test 7 · results | `9daa255e-5feb-4c1b-8f04-0796f61e95fc` |
| **Q35** | Test 8 · applicable? | **Yes** |
| **Q36** | Test 8 · results | `60372036-e22d-4bc9-b01c-1bdd2a1d95a8` |
| **Q38** | Test 9 · applicable? | **Yes** |
| **Q39** | Test 9 · result | `c17080a7-f093-4632-8384-869c19f3c5ee`<br>`84d227ce-48b7-49a7-806c-d09d38bffbd9` *(Twin 21 Nov → 7, Double 25 Nov → 0)* |
| **Q41** | Test 10 · applicable? | **Yes** |
| **Q42** | Test 10 · results | `e43ed088-16f7-49c2-a0d2-2baa08031f85` |

*Not reached (the "No" branch): Q19, Q22, Q25, Q28, Q31, Q34, Q37, Q40, Q43.*

### ⚠️ Q16 — the two Full Sync IDs

One field, two IDs, one per line. The order is **not** labelled by the form, so put the
**availability** task first and the **rates & restrictions** task second, matching how the page states
the requirement:

```
1f05a5d5-0722-4a36-b064-33f44ad456fd     ← 1 × 500 days Availability (All Rooms)
cfc73e27-4216-4ec5-ac18-44e2a530f79c     ← 1 × 500 days Rates & Restrictions (All Rates)
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
