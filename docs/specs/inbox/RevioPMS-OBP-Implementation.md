# RevioPMS — Occupancy-Based Pricing (OBP) implementation

*Addendum to the RevioPMS refinement guide. Extends the ecosystem OBP spec authored in the CRS guide (§6 there) onto RevioPMS surfaces. Cross-references marked "CRS §6.x" point at that shared spec; do not redefine anything already defined there.*

---

## P1. Framing — the PMS consumes the model, it doesn't own it
OBP's configuration and data model live **once**, shared across the suite (CRS §6.2–6.3): the property/plan **pricing model**, `primary_occupancy`, room-type `max/default_occupancy`, and the per-date **occupancy rates**. RevioPMS **reads** all of this. It does **not** store its own pricing model or its own rate table — same single-source discipline as the shared guest record.

So the PMS work is not "build OBP." It's four operational jobs:
1. **Capture** occupancy accurately on every reservation (P2).
2. **Resolve** rate = f(room type, rate plan, date, occupancy) at each posting moment (P3).
3. **Honour the quoted rate** — bill what was confirmed, re-resolve only on a real occupancy change (P4). *This is the PMS-specific crux.*
4. **Display / re-resolve** at the operational touchpoints — check-in, room move, night audit, calendar (P5–P9).

## P2. Occupancy capture — every reservation carries an occupancy
- A reservation must always hold **adults** (and, per the age policy, **children/infants** — the separate axis, CRS §6.9). No reservation without an occupancy once OBP is on for the property.
- **Inbound** (from CRS, RevioLink/OTA): the guest count arrives with the booking; store it as-booked. RevioLink already captures occupancy on ingestion (CRS §6.6).
- **PMS-created** (walk-in, phone, rebook): capture occupancy at creation, exactly as the CRS availability search does (CRS §3 / §6.6). The "doesn't fit" guard (party > room `max_occupancy`) applies here too.

## P3. Rate resolution — the core function
Define one resolver used everywhere: `resolve_rate(room_type, rate_plan, date, occupancy) → rate`.
- Per-**person** plan → the occupancy row for that adult count on that date.
- Per-**room** plan → the single max-occupancy row (occupancy is irrelevant), so per-room stays behave exactly as today.
- **Precedence (highest first):** manual per-stay override → snapshot rate on the reservation (P4) → resolved occupancy rate → plan fallback. Comp/house-use = 0 regardless of occupancy (P11).

## P4. Honour the quoted rate — the parity-within-the-stay rule (PMS-specific, do this right)
**Store a rate snapshot on the reservation at booking time.** The PMS bills that snapshot; it does **not** silently re-resolve against the live rate table.
- Why: rates move after a booking is made. If the PMS re-resolved on every folio render, a guest **confirmed at €120** could be **billed €132** because the occupancy table changed in between — the folio would disagree with the confirmation and the OTA record. Unacceptable.
- Rule: **the reservation's rate is locked to what was quoted** (per night, per occupancy). The PMS re-resolves **only** when the occupancy (or room type) actually changes (P6–P8), and then only from the change forward.
- Contrast with CRS: the CRS **quotes** (live resolution at shop time, CRS §6.6); the PMS **bills what was quoted**, adjusting only for real changes. Keep the two roles distinct.
- Snapshot granularity: per night (a stay can span dates with different occupancy rates), so store the resolved nightly rates, not a single figure.

## P5. Reservations / availability calendar
- **Reservation blocks** on the tape chart carry an **occupancy badge** (e.g. `2p`) so staff see at a glance what each stay is priced at.
- **Creating a reservation from the calendar** runs the same occupancy capture + resolve as P2–P3.
- **If the calendar surfaces a rate/availability strip**, render per-occupancy following the CRS display rules (CRS §6.5). Availability itself has **no** occupancy dimension (it's per room type — CRS §6.7a), so only the rate strip changes, not the availability row.

## P6. Mid-stay occupancy change — atomic with the folio
Adding/removing a guest or an extra bed changes occupancy → **re-resolve from the change date forward** (already-posted past nights are not retroactively repriced unless explicitly adjusted).
- **This is a state transition and must be atomic** — hook it into the existing checkout/folio/overstay state machine. The occupancy change and the folio recalculation **commit together or not at all**.
- The new nightly rates become the reservation's snapshot from the change date (P4).

## P7. Room move / upgrade / room-type change
- Moving to a **different room type** re-resolves the rate against the **new** room type's occupancy rates (and its `max_occupancy`, which may change what's valid).
- Same-room-type moves don't reprice.
- Runs inside the same atomic transition as the move itself.

## P8. Check-in / registration — confirm actual occupancy
- At check-in, **confirm the occupancy**; actual adults can differ from the booked count.
- If it differs → re-resolve from arrival and adjust the folio (atomic, per P6). If unchanged → the P4 snapshot stands.
- Capture **children/infants** here for age-policy fees (CRS §6.9), posted as separate folio lines (P11).

## P9. Night audit — post the occupancy rate per night
- The nightly room-charge posting uses the **reservation's snapshot nightly rate** (P4) for that date — not a fresh live lookup.
- Audit must handle per-occupancy correctly across a stay whose occupancy varies by night.
- Roll-forward and date-open behave as today; only the amount source changes.

## P10. Folio presentation
- The room-charge line shows the **occupancy it was priced at** (e.g. "Deluxe Double · 2 guests · €120/night") for transparency and dispute-proofing.
- Nights at different occupancies/rates itemise per night (or group where identical).
- Children/infant fees are **separate lines** (P11), never folded into the adult-occupancy rate.

## P11. Children / infants — the adjacent axis
- Adult occupancy (P2–P9) and child/infant pricing are **separate** (CRS §6.9). Child/infant fees come from the rate plan (`children_fee` / `infant_fee`) applied per the property **age policy**.
- Surface them as their own folio lines on top of the adult-occupancy room rate. Ship after adult OBP.

## P12. Reporting
- PMS reports read **actual posted** amounts, so they reflect occupancy-resolved rates automatically — no report rework required.
- Optional upside: a new **ADR-by-occupancy** / single-vs-double lens becomes possible from PMS data.

## P13. Edge cases & validation
- **Occupancy > room `max_occupancy`** (rollaway/overbooking): block or require an explicit override.
- **Single-occupancy discount**: expressed naturally as the occupancy-1 row being lower than occupancy-2 — no special-casing.
- **Group blocks with mixed occupancy**: each room resolves its own occupancy rate independently.
- **Comp / house-use**: rate 0 regardless of occupancy (P3 precedence).
- **Per-room properties**: everything collapses to today's behaviour; zero change for hotels not using OBP.

## P14. Build order (PMS)
1. Read the shared model — no local config store.
2. Occupancy on the reservation entity + capture on create/inbound (P2).
3. `resolve_rate(...)` resolver + **rate snapshot on the reservation** (P3–P4).
4. Wire re-resolution into the existing atomic state machine: mid-stay change, room move, check-in adjustment (P6–P8).
5. Night audit posts snapshot nightly rates (P9); folio shows occupancy (P10).
6. Calendar occupancy badges + per-occupancy rate strip if present (P5).
7. (Later) children/infant fees via age policy (P11).

## P15. Net
The PMS doesn't build OBP — it **consumes** the shared model at operational moments. The rule that carries the most weight is P4: **the reservation stores the quoted nightly rate and the PMS bills that, re-resolving only on a genuine occupancy or room-type change, always atomically with the folio.** Get that right and the folio can never silently disagree with the confirmation, the OTA, or the CRS quote.
