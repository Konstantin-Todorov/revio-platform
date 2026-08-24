# **RevioLink — Occupancy-Based Pricing (OBP) implementation**

*Standalone spec for the channel manager. Third of the OBP trilogy: the****CRS guide (§6)****owns the shared model, field reference, and the full Channex contract; the****PMS guide (§4)****owns operational consumption (folio/night-audit);****this doc****owns the****distribution layer****— rate authorship & precedence, pricing-model propagation, the Calendar/Bulk occupancy surfaces, occupancy→OTA Mapping, per-channel capability, the Channex sync, and inbound reservation verification. Cross-references marked "CRS §6.x" / "PMS §4.x" point at those docs; nothing already defined there is redefined here.*

## **L1. Rate authorship & precedence — the foundational model (all rates; occupancy just inherits it)**

RevioLink can run **two ways**, and the authorship rule flips between them. This governs *all* rates and restrictions, not only OBP — OBP occupancy rates follow it unchanged.

**Connected to a CRS (RevioCRS upstream):**

**The CRS is authoritative.** It authors rates — including per-occupancy rates — and pushes an authoritative ARI state down to Link, which executes distribution to the OTAs.

**Link can still edit**, so an operator is never blocked. But a Link edit is a **transient local override**: it takes effect immediately, and on the CRS's next authoritative push **any discrepancy resolves in the CRS's favour** — the CRS value reasserts. **[interpretation — confirm]** This is how I read "Link can set it, but on discrepancy the CRS overrides": Link edits act now, don't survive the CRS, and the override is **logged and surfaced, never silent** (so a Link user sees *why* their value changed, rather than watching it vanish).

**The pricing model itself (per-room / per-person) is CRS-owned and read-only in Link while connected. [interpretation — confirm]** Rates may diverge-then-reconcile, but the *model* cannot: if the CRS is per-person and Link flipped to per-room, the occupancy rows stop existing and the sync desyncs. So model = hard CRS-owned when connected; only rate *values* are Link-editable (and overridable).

**Standalone (no CRS connected):**

**Link is the source of truth** — full authoring of the pricing model *and* every rate/occupancy value. No override layer; Link's own precedence chain (below) is final.

**Precedence — two orthogonal axes.** Link already resolves a value with a within-system chain (shown on the Bulk screen): *date-scoped edit (calendar or bulk, most recent) > restriction rule > rate-plan default > property default.* OBP/authorship adds a **source axis above it**:

**Source axis (new):** connected → CRS-authoritative feed wins wholesale over Link; standalone → Link only.

**Within-system axis (existing):** runs *inside* whichever system is authoritative — the CRS's feed when connected, Link's own when standalone (or in the transient window before the CRS reasserts).

Net effective value = *[authoritative system's within-system resolution]*, with Link overrides transient when a CRS is connected.

**[build note]** Link must know and display its **connection state** (CRS-linked vs standalone), because it flips authorship. In CRS-linked mode, rate surfaces (Calendar, Bulk) mark values **"managed by CRS"** and warn on edit ("this will be overridden on the next CRS sync"); in standalone they're plain-editable. Extend the Bulk screen's "which value wins" line to name the source axis when connected.

## **L2. Pricing-model propagation (per-room / per-person)**

**Shared config** (CRS §6.2). **Connected:** model flows CRS → Link → Channex (sell_mode), Link read-only on the model (L1). **Standalone:** model set in Link (Rooms & Rates / Settings) → Channex.

**Rooms & Rates already surfaces****MAX****occupancy per type** (DDR 2, STR 2, FAM 4, SUI 3, SSR 1, APT 3) — that's the ceiling for occupancy rows. Add **default_occupancy** (the primary occupancy) alongside it (CRS §6.3). MAX = how many occupancy rows a per-person plan carries; default = which one is primary.

**Per-plan override respected** — Channex sell_mode is per rate plan, so a property can run some plans per-room and some per-person (CRS §6.2).

## **L3. Calendar — per-occupancy rate display (Link's calendar*****does*****show rates)**

Unlike the PMS tape chart (which shows no rates, PMS §4.5), the **CM calendar shows rates and restrictions** — so OBP surfaces here in full.

Each **rate-plan row becomes occupancy-aware** under per-person: the plan's row expands to per-occupancy rates (Standard Rate · 1p / 2p / …), following the CRS display rules (CRS §6.5) — primary shown by default, expand for the rest; per-room plans render one rate exactly as today. The existing **Display: N selected** control is the natural home for an occupancy toggle.

**Derived plans already compute off Standard** here (Non-Refundable €96 = €120 − 20%). That's the **plan-derivation axis**; OBP adds the **occupancy axis beneath each plan** — keep the two visually distinct (CRS §6.1), never conflated.

**Restriction rows (Min LOS, CTA, CTD, Stop Sell) stay per-plan, not per-occupancy** (Channex: restrictions have no occupancy dimension, CRS §6.7a) — only the rate rows gain occupancy.

**Editing:** standalone → editable; connected → "managed by CRS", edit warns per L1. Both per-cell edit and the bulk modal gain the occupancy dimension.

## **L4. Bulk update — occupancy rows**

Same modal as CRS §6.4, and the copy is already OBP-ready — *"Rate plans (price changes are manual plans only)"* and *"derived plans, which are never listed here"* match the model exactly.

**When the targeted plan(s) are per-person, the Price control becomes the occupancy matrix** — rows 1 … max_occupancy, each with the existing operation set (Set exact / ±% / ±€), or **primary + per-occupancy offsets** (the faster path, CRS §6.4).

**Mixed max across selected room types** (e.g. FAM max 4, DDR max 2): show rows up to the **highest** cap and **skip** occupancies beyond a given type's max on apply — never send occupancy 4 to a 2-cap room (CRS §6.4). State it in Preview.

**Restrictions side unchanged** — Min/Max stay, advance, CTA/CTD, rate-plan status are per-plan, so the restriction half of the modal gains no occupancy rows.

**Preview & apply** shows the occupancy × plan cascade before commit; under CRS-connected mode it also flags that applied values are overridable by the CRS (L1).

## **L5. Mapping — occupancy → OTA rate lines (the CM-specific core of OBP)**

This is where OBP does real distribution work. Today Mapping links room types (external room ID) and rate plans (external rate ID) per channel, all showing "complete." Under OBP a **per-person rate plan must map its occupancy options** to the channel:

**Full-occupancy channels (Booking.com, Expedia, Agoda, Hotelbeds…):** map each occupancy, and **select which occupancy is primary** — the primary carries the shared restrictions to the channel (Channex's own mapping screen has a primary-occupancy selector; mirror it). So Mapping gains a **primary-occupancy selector per mapped per-person plan.**

**Single-rate channels (Airbnb-class; general rule even if not in the current six):** map the **primary/lowest** occupancy only; the channel's own "included guests + price per extra guest" handles increments (CRS §6.8). One flat increment, no per-step curve.

**Mapping completeness redefined:** a per-person plan is not "fully mapped" until its occupancy options **and** its primary are set — so the 13/13 / "All mapped" metric must count occupancy mapping, or it will show green while occupancies are unmapped.

## **L6. Channels — per-channel occupancy capability (extends the "channel limitations" line)**

The calendar already carries a **channel-limitations** line (*"Agoda ignores CTD, Adv. purchase max · WebBeds ignores CTD…"*) — the right home for occupancy capability too.

Add per channel: **full per-occupancy** vs **primary + extra-guest only.** e.g. *"Booking.com / Expedia / Agoda: full per-occupancy · [single-rate channel]: primary + extra-guest."*

This capability **drives Channex delivery degradation** (the capability gate, CRS §6.7): a channel that can't do per-occupancy receives the **primary occupancy rate + extra-guest offset**, and the UI states it as a **limitation, not an error** — consistent with how CTD/Adv-purchase limits already read.

The per-channel card (Channels screen) can show **occupancy-pricing mode** alongside commission / FX markup / mapping health.

## **L7. Channex sync — Link's core job (contract in CRS §6.7 / §6.7a — implement, don't redefine)**

RevioLink is the writer of OBP to Channex. Responsibilities, per the verified contract:

On plan create/edit: set **sell_mode** (per_room / per_person), build the **occupancy****options** (occupancy, is_primary, rate, optional derived_option), and **rate_mode** — manual, or derived/cascade for parented plans (**cascade****when a plan is both derived-from-a-parent and per-person**, CRS §6.1/6.7).

On daily ARI push (POST /restrictions): **per-person → the****rates****array** of {occupancy, rate} in one change object (not N calls); **per-room → scalar****rate** (CRS §6.7a). Restrictions ride the same object, **per-plan, not per-occupancy.**

**Parse****meta.warnings****on every push** — Channex returns rejected values as warnings inside a **200 OK**; a naïve "200 = success" silently drops bad per-occupancy rates (CRS §6.7a). Surface partials.

**Batch** into the queue/outbox — 20 ARI/min per property, 10 MB/call, date-range + Last-Win overrides (CRS §6.7a). Bulk-edit's occupancy × date changes must batch, never fire per-cell.

**Respect the capability gate per channel** (L6) — degrade to primary occupancy where a channel can't take per-occupancy.

## **L8. Reservations monitor — inbound occupancy verification**

The Reservations screen is a **channel-bookings monitor** ("did each booking land and was it acknowledged? — canonical list lives in RevioCRS"). Under OBP:

An inbound booking carries the **occupancy it was sold at.** Surface occupancy in the **ROOM · RATE** column (or a new column) so an operator can verify the **right per-occupancy rate** was received/acknowledged.

**This is the catch-point for a pricing mismatch** — booked as 2-adult but priced at the 1-adult rate = a mapping/primary error (L5); the monitor is where it surfaces before it becomes a folio dispute (PMS §4.4). Ties to CRS §6.6 inbound occupancy capture.

## **L9. Dashboard — occupancy-aware mapping health (light)**

**Active Products****= room types × rate plans** and **Unmapped Products** must both count occupancy mapping under OBP — a per-person plan with unmapped occupancies is not fully active/mapped. Extend the metric definitions so the dashboard's green state can't hide unmapped occupancies. Otherwise no new dashboard surface required.

## **L10. Build order & flags**

Prereq: the shared model + Channex contract from **CRS §6**.

**Connection-state + authorship/precedence model (L1)** — foundational, governs *all* rates, not just OBP. Do first.

**Pricing-model propagation + Rooms & Rates occupancy fields** (L2).

**Channex sync** — occupancy options + rates[] daily push + warnings parsing (L7).

**Mapping** — occupancy options + primary-occupancy selector + completeness redefinition (L5).

**Calendar + Bulk** — occupancy display and occupancy matrix (L3–L4).

**Channels** — per-channel capability + limitations line + delivery degradation (L6).

**Reservations** — inbound occupancy verification (L8); **Dashboard** metric definitions (L9).

**Flags to confirm (interpretations, L1):**

**(a)** Pricing *model* is **CRS-owned / read-only in Link when connected** (only rate values are Link-editable).

**(b)** Link edits are **transient, reasserted by the CRS on discrepancy, and surfaced — not blocked, not silent.**

**(c)** Per-channel occupancy capability rides the **existing channel-limitations line**, degrading single-rate channels to primary + extra-guest automatically.

## **L11. Net**

RevioLink adds the **distribution half** of OBP on top of the shared model. Two things carry the weight: the **authorship/precedence model (L1)** — CRS-superior when connected, Link-sovereign standalone, model hard-owned by CRS, rate edits transient-and-surfaced — which governs every rate not just occupancy; and the **Mapping + capability layer (L5–L6)** where occupancy actually reaches the OTAs, with graceful degradation for single-rate channels. The sync itself (L7) is already fully specified in CRS §6.7a — Link implements it. Everything else (Calendar, Bulk, Reservations, Dashboard) is the occupancy dimension surfaced on screens that already exist.
